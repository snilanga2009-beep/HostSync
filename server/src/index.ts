import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config';
import { initDatabase } from './db/database';

// Import Route Handlers
import authRoutes from './routes/auth.routes';
import hotelRoutes from './routes/hotel.routes';
import roomTypesRoutes from './routes/room-types.routes';
import roomsRoutes from './routes/rooms.routes';
import roomItemsRoutes from './routes/room-items.routes';
import guestRoutes from './routes/guest.routes';
import requestsRoutes from './routes/requests.routes';
import staffRoutes from './routes/staff.routes';
import tipsRoutes from './routes/tips.routes';
import paymentsRoutes from './routes/payments.routes';
import reportsRoutes from './routes/reports.routes';
import notificationsRoutes from './routes/notifications.routes';
import settingsRoutes from './routes/settings.routes';
import auditLogsRoutes from './routes/audit-logs.routes';
import uploadsRoutes from './routes/uploads.routes';
import sseRoutes from './routes/sse.routes';
import jobsRoutes from './routes/jobs.routes';
import webhooksRoutes from './routes/webhooks.routes';
import usersRoutes from './routes/users.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Ensure upload directory exists and serve static uploads
if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(CONFIG.UPLOAD_DIR));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hotel', hotelRoutes);
app.use('/api/room-types', roomTypesRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/room-items', roomItemsRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/maintenance', requestsRoutes);
app.use('/api/service-requests', requestsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/sse', sseRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/users', usersRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'ResortCare API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// In production or when client dist exists, serve client build
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal error occurred on the server.'
  });
});

// Start Server
app.listen(CONFIG.PORT, () => {
  console.log(`🚀 ResortCare Server running on http://localhost:${CONFIG.PORT}`);
  console.log(`📁 Uploads served from ${CONFIG.UPLOAD_DIR}`);
});

export default app;
