import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';
import { db } from '../db/database';

export interface AuthenticatedUser {
  id: string;
  hotel_id: string;
  email: string;
  full_name: string;
  role: string;
  staff_id?: string;
  department?: string;
  job_title?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: { id: string; hotel_id: string; email: string; role: string; full_name: string }): string {
  return jwt.sign(
    {
      id: user.id,
      hotel_id: user.hotel_id,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    },
    CONFIG.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query?.token as string);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;
    
    // Lookup user in DB to ensure account is still active and retrieve staff details if applicable
    const userRow = db.prepare(`
      SELECT u.id, u.hotel_id, u.email, u.full_name, u.role, u.status,
             sp.id as staff_id, sp.department, sp.job_title
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.id = ? AND u.status = 'active'
    `).get(decoded.id) as any;

    if (!userRow) {
      return res.status(401).json({ error: 'User not found or account is deactivated.' });
    }

    req.user = userRow;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Super Admin has access to all routes
    if (req.user.role === 'Super Admin') {
      return next();
    }

    // Hotel Admin has access to hotel operations
    if (req.user.role === 'Hotel Admin' && !allowedRoles.includes('Super Admin Only')) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
}
