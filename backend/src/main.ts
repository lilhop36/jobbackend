// JobHunter Ethiopia — Backend server entry point
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { api } from './api/routes.js';
import { startPeriodicSync, syncAll } from './sync/syncWorker.js';

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use('/api', api);

app.get('/', (_req, res) => {
  res.send({ name: 'JobHunter Ethiopia API', docs: '/api/health' });
});

// Central error handler — never crash on unhandled errors
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[JobHunter] unhandled error:', err);
  res.status(500).json({ error: err?.message || 'internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[JobHunter] unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[JobHunter] uncaught exception:', err);
});

app.listen(port, () => {
  console.log(`[JobHunter] server listening on port ${port}`);
  if (process.env.AUTO_SYNC === 'true') {
    syncAll().catch((err) => console.error('[JobHunter] initial sync error', err));
  }
  startPeriodicSync();
});
