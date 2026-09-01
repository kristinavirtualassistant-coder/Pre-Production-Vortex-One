import { Request, Response, NextFunction } from 'express';
import { adminAuth } from './firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getPgPool } from '../db/db';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: string;
    organization_id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Check PostgreSQL for user authorization
    const pool = getPgPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    // Extract organization from request headers or default
    const orgId = req.headers['x-organization-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing organization context' });
    }
    
    const client = await pool.connect();
    try {
      // Find user in this org
      const { rows } = await client.query('SELECT * FROM users WHERE email = $1 AND organization_id = $2', [decodedToken.email, orgId]);
      
      if (rows.length === 0) {
        // Auto-provision user in DB for demo purposes if they log in via Google
        // In a real app this would be an invitation/signup flow
        const userId = decodedToken.uid; 
        await client.query(`
          INSERT INTO users (id, organization_id, email, name, role) 
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (organization_id, email) DO NOTHING
        `, [userId, orgId, decodedToken.email, decodedToken.name || 'Unknown', 'member']);
        
        const { rows: newRows } = await client.query('SELECT * FROM users WHERE email = $1 AND organization_id = $2', [decodedToken.email, orgId]);
        req.dbUser = newRows[0];
      } else {
        req.dbUser = rows[0];
      }
    } finally {
      client.release();
    }
    
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized: User not found in DB' });
    }
    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: `Forbidden: Requires one of roles: ${roles.join(', ')}` });
    }
    next();
  };
};
