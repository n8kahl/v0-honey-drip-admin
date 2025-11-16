import http from 'http';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import apiRouter from './routes/api';
import { createWebSocketProxies } from './ws/proxies';

const app = express();

// ===== Security & perf =====
const WEB_ORIGIN = process.env.WEB_ORIGIN || '*'; // set this in Railway
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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
const server = http.createServer(app);
createWebSocketProxies({ server });

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server listening on ${PORT}`);
  if (!process.env.MASSIVE_API_KEY) {
    console.warn('⚠️  MASSIVE_API_KEY is not set — REST/WS proxy will reject upstream calls');
  }
});

export default app;
