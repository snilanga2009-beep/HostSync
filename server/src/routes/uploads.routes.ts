import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { upload } from '../middleware/upload';
import { db } from '../db/database';

const router = Router();

// POST /api/uploads - Upload photo (guest or staff)
router.post('/', upload.single('photo'), (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const fileId = uuidv4();
    const publicUrl = `/uploads/${req.file.filename}`;

    db.prepare(`
      INSERT INTO file_uploads (
        id, hotel_id, original_name, stored_filename, file_path, file_size, mime_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      fileId,
      hotel ? hotel.id : 'hotel-ocean-pearl',
      req.file.originalname,
      req.file.filename,
      req.file.path,
      req.file.size,
      req.file.mimetype
    );

    res.status(201).json({
      success: true,
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'File upload failed.' });
  }
});

export default router;
