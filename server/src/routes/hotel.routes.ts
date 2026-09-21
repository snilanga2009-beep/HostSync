import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// GET /api/hotel/network-info - Returns host machine LAN IP and mobile access URLs
router.get('/network-info', (req, res: Response) => {
  const { getLanIp } = require('../services/qrcode');
  const { CONFIG } = require('../config');
  const os = require('os');

  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('127.')) {
        ips.push(net.address);
      }
    }
  }

  const primaryIp = getLanIp();
  const clientPort = 5173;
  const lanBaseUrl = `http://${primaryIp}:${clientPort}`;

  res.json({
    lanIp: primaryIp,
    availableIps: ips,
    lanBaseUrl,
    configuredBaseUrl: CONFIG.BASE_URL,
    clientPort
  });
});

// GET /api/hotel
router.get('/', (req, res: Response) => {
  const hotel = db.prepare(`SELECT * FROM hotels LIMIT 1`).get() as any;
  if (!hotel) {
    return res.status(404).json({ error: 'Hotel configuration not found.' });
  }
  res.json({ hotel });
});

// PUT /api/hotel
router.put('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { name, resort_name, logo_url, address, phone, email, website, currency, timezone, country, default_lang, emergency_contact, guest_service_contact } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    db.prepare(`
      UPDATE hotels
      SET name = ?, resort_name = ?, logo_url = ?, address = ?, phone = ?, email = ?,
          website = ?, currency = ?, timezone = ?, country = ?, default_lang = ?,
          emergency_contact = ?, guest_service_contact = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, resort_name, logo_url, address, phone, email,
      website, currency, timezone, country, default_lang,
      emergency_contact, guest_service_contact, hotel.id
    );

    recordAuditLog({
      hotelId: hotel.id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'HOTEL_UPDATED',
      entity: 'hotel',
      entityId: hotel.id,
      details: { name, resort_name }
    });

    const updated = db.prepare(`SELECT * FROM hotels WHERE id = ?`).get(hotel.id);
    res.json({ hotel: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hotel/structure (Buildings and Floors)
router.get('/structure', (req, res: Response) => {
  const buildings = db.prepare(`SELECT * FROM buildings ORDER BY name ASC`).all() as any[];
  const floors = db.prepare(`SELECT * FROM floors ORDER BY floor_number ASC`).all() as any[];

  const structure = buildings.map(b => ({
    ...b,
    floors: floors.filter(f => f.building_id === b.id)
  }));

  res.json({ buildings: structure });
});

// POST /api/hotel/buildings
router.post('/buildings', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { name, code } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const id = `bldg-${uuidv4().substring(0, 8)}`;

    db.prepare(`INSERT INTO buildings (id, hotel_id, name, code) VALUES (?, ?, ?, ?)`).run(
      id, hotel.id, name, code || ''
    );

    res.status(201).json({ building: { id, hotel_id: hotel.id, name, code } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hotel/floors
router.post('/floors', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { building_id, floor_number, name } = req.body;
    const id = `floor-${uuidv4().substring(0, 8)}`;

    db.prepare(`INSERT INTO floors (id, building_id, floor_number, name) VALUES (?, ?, ?, ?)`).run(
      id, building_id, floor_number, name
    );

    res.status(201).json({ floor: { id, building_id, floor_number, name } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
