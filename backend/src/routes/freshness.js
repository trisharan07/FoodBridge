import { Router } from 'express';
import multer from 'multer';
import { q } from '../db.js';
import { auth } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'), false);
  },
});

/**
 * Simulated AI freshness scoring.
 * In production this would call a Python microservice running MobileNet.
 * For the MVP it analyses basic image properties and assigns a score.
 */
function simulateFreshnessScore(filePath) {
  const stats = fs.statSync(filePath);
  const sizeKB = stats.size / 1024;

  // Deterministic scoring based on file characteristics
  // A real implementation would use TensorFlow.js or call a Python service
  const seed = stats.size % 100;
  let score, label, confidence;

  if (seed < 25) {
    score = 90 + (seed % 10);
    label = 'Fresh';
    confidence = 0.92;
  } else if (seed < 55) {
    score = 70 + (seed % 20);
    label = 'Good';
    confidence = 0.85;
  } else if (seed < 80) {
    score = 50 + (seed % 20);
    label = 'Okay';
    confidence = 0.78;
  } else {
    score = 25 + (seed % 25);
    label = 'Wilted';
    confidence = 0.71;
  }

  return {
    score: Math.min(score, 99),
    label,
    confidence: +confidence.toFixed(2),
    analysedAt: new Date().toISOString(),
    note: 'Scored by FoodBridge AI (simulated for MVP)',
  };
}

export default () => {
  const r = Router();

  // Upload food image and get freshness score
  r.post('/analyze', auth('donor'), upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Image file required' });
    try {
      const result = simulateFreshnessScore(req.file.path);
      // If a listing id was sent, attach the score to it
      if (req.body.listingId) {
        await q(
          `UPDATE food_listings SET freshness_score=$1, freshness_label=$2, image_url=$3
           WHERE id=$4 AND donor_id=$5`,
          [result.score, result.label, `/uploads/${req.file.filename}`, req.body.listingId, req.user.id]);
      }
      res.json({
        ...result,
        imageUrl: `/uploads/${req.file.filename}`,
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to analyze image' });
    }
  });

  // Get freshness score for a listing
  r.get('/score/:listingId', auth(), async (req, res) => {
    const { rows } = await q(
      'SELECT freshness_score, freshness_label, image_url FROM food_listings WHERE id=$1',
      [req.params.listingId]);
    if (!rows[0]) return res.status(404).json({ error: 'Listing not found' });
    res.json(rows[0]);
  });

  return r;
};
