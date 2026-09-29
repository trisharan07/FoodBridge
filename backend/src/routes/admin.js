import { Router } from 'express';
import { q } from '../db.js';
import { auth } from '../middleware/auth.js';

export default (io) => {
  const r = Router();

  // --- User verification ---

  // List users pending verification (unverified donors & NGOs)
  r.get('/users/pending', auth('admin'), async (_req, res) => {
    const { rows } = await q(
      `SELECT id, name, email, role, phone, created_at
       FROM users WHERE is_verified = FALSE AND role IN ('donor','ngo')
       ORDER BY created_at`);
    res.json(rows);
  });

  // List all users (with optional role filter)
  r.get('/users', auth('admin'), async (req, res) => {
    const role = req.query.role;
    let sql = 'SELECT id, name, email, role, phone, is_verified, created_at FROM users';
    const params = [];
    if (role) { sql += ' WHERE role=$1'; params.push(role); }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await q(sql, params);
    res.json(rows);
  });

  // Approve a user
  r.post('/users/:id/verify', auth('admin'), async (req, res) => {
    const { rows } = await q(
      `UPDATE users SET is_verified=TRUE, verified_at=now(), verified_by=$1
       WHERE id=$2 RETURNING id, name, email, role, is_verified`,
      [req.user.id, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    await q('INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',
      [req.user.id, 'admin.verify_user', 'user', req.params.id]);
    io.to(`user:${req.params.id}`).emit('account:verified', { verified: true });
    res.json(rows[0]);
  });

  // Reject a user
  r.post('/users/:id/reject', auth('admin'), async (req, res) => {
    const reason = req.body.reason || '';
    const { rows } = await q(
      `UPDATE users SET is_verified=FALSE, rejection_reason=$1
       WHERE id=$2 RETURNING id, name, email, role`,
      [reason, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    await q('INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',
      [req.user.id, 'admin.reject_user', 'user', req.params.id]);
    res.json({ ...rows[0], rejection_reason: reason });
  });

  // --- Analytics ---
  r.get('/stats', auth('admin'), async (_req, res) => {
    const [users, listings, pickups, delivered] = await Promise.all([
      q('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role'),
      q(`SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN status='available' THEN 1 ELSE 0 END)::int AS available,
              SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END)::int AS delivered
         FROM food_listings`),
      q(`SELECT status, COUNT(*)::int AS count FROM pickups GROUP BY status`),
      q(`SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM food_listings WHERE status='delivered'
         GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 30`),
    ]);
    res.json({
      usersByRole: users.rows,
      listings: listings.rows[0] || {},
      pickupsByStatus: pickups.rows,
      deliveriesByDay: delivered.rows,
    });
  });

  return r;
};
