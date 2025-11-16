import http from 'http';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import apiRouter from './routes/api';
import { attachWsServers } from './ws';

const app = express();

// ===== Security & perf =====
const WEB_ORIGIN = process.env.WEB_ORIGIN || '*'; // set this in Railway
const IMAGE_HOST = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com';
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          'https://ejsaflvzljklapbrcfxr.supabase.co',
          'https://hdadmin.up.railway.app',
          'https://api.massive.com',
          'wss://hdadmin.up.railway.app',
          'wss://socket.massive.com',
        ],
        imgSrc: ["'self'", 'data:', IMAGE_HOST],
        frameAncestors: ["'self'"],
      },
    },
  })
);
app.use(compression());
app.use(
  cors({
    origin: WEB_ORIGIN === '*' ? '*' : [WEB_ORIGIN],
    credentials: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Basic request logging (redact api keys)
app.set('trust proxy', 1);
app.use(
  morgan('tiny', {
    skip: (req: Request) => req.url.includes('/api/massive'),
  })
);

// Rate limit API paths
const limiter = rateLimit({ windowMs: 60_000, max: 1200 });
app.use('/api', limiter);

// ===== API routes =====
app.use('/api', apiRouter);

// ===== Static SPA (vite build) =====
const distDir = path.resolve(process.cwd(), 'dist');
const indexFile = path.join(distDir, 'index.html');
app.use(express.static(distDir));
app.get('/ping', (_req, res) => {
  console.log('[Server] /ping hit');
  res.json({ status: 'pong' });
});
app.get('*', (_, res, next) => {
  res.sendFile(indexFile, (err) => {
    if (err) {
      console.error('[Server] Failed to send index.html', err);
      next(err);
    }
  });
});

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('[Server] Express error handler', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ===== HTTP server + WS proxies =====
const httpServer = http.createServer(app);
attachWsServers(httpServer);

const defaultPort = process.env.NODE_ENV === 'development' ? 3000 : 8080;
const PORT = Number(process.env.PORT || defaultPort);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server listening on ${PORT} (${process.env.NODE_ENV || 'production'})`);
  if (!process.env.MASSIVE_API_KEY) {
    console.warn('⚠️  MASSIVE_API_KEY is not set — REST/WS proxy will reject upstream calls');
  }
});

export default app;
