import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', apiRouter);

// Serve static files from Vite build
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Start server
app.listen(PORT, () => {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  HoneyDrip Admin Server                              ║
║  Port: ${PORT}                                       ║
║  Environment: ${process.env.NODE_ENV || 'development'}  ║
║  Time: ${new Date().toISOString()}                   ║
╚══════════════════════════════════════════════════════╝
    `);
  }
  
  // Check environment variables
  if (!process.env.MASSIVE_API_KEY) {
    console.warn('⚠️  MASSIVE_API_KEY not configured');
  }
  
  if (!isProd) {
    console.log('✓ Server ready');
  }
});

export default app;
