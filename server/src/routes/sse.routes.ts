import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { sseService } from '../services/sse';
import { CONFIG } from '../config';

const router = Router();

// GET /api/sse/stream - Real-time SSE channel
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Parse optional token or tracking query
  const token = req.query.token as string;
  const trackingToken = req.query.trackingToken as string;

  let role: string | undefined;
  let userId: string | undefined;

  if (token) {
    try {
      const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;
      role = decoded.role;
      userId = decoded.id;
    } catch (e) {
      // Unauthenticated or guest connection
    }
  }

  const clientId = uuidv4();
  sseService.addClient({
    id: clientId,
    role,
    userId,
    trackingToken,
    res
  });

  // Initial connection handshake
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);
});

export default router;
