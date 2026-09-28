import { Router } from 'express';
import { q } from '../db.js';
import { auth } from '../middleware/auth.js';

export default (io) => {
  const r = Router();

  r.get('/open', auth('volunteer'), async (_req, res) => {
    const { rows } = await q(
      `SELECT p.id, p.status, f.food_name, f.quantity, f.address FROM pickups p
       JOIN food_listings f ON f.id=p.listing_id WHERE p.status='pending' ORDER BY p.created_at`);
    res.json(rows);
  });

  r.post('/:id/accept', auth('volunteer'), async (req, res) => {
    const upd = await q(`UPDATE pickups SET status='assigned' WHERE id=$1 AND status='pending' RETURNING *`, [req.params.id]);
    if (!upd.rows[0]) return res.status(409).json({ error: 'Pickup already taken' });
    await q('INSERT INTO volunteer_assignments(pickup_id,volunteer_id) VALUES($1,$2)', [req.params.id, req.user.id]);
    io.to(`user:${upd.rows[0].ngo_id}`).emit('pickup:assigned', upd.rows[0]);
    res.json(upd.rows[0]);
  });

  const NEXT = { assigned: 'in_transit', in_transit: 'delivered' };
  r.patch('/:id/advance', auth('volunteer'), async (req, res) => {
    const cur = await q(
      `SELECT p.* FROM pickups p JOIN volunteer_assignments v ON v.pickup_id=p.id
       WHERE p.id=$1 AND v.volunteer_id=$2`, [req.params.id, req.user.id]);
    const next = NEXT[cur.rows[0]?.status];
    if (!next) return res.status(400).json({ error: 'Cannot advance this pickup' });
    const upd = await q('UPDATE pickups SET status=$1 WHERE id=$2 RETURNING *', [next, req.params.id]);
    if (next === 'delivered')
      await q(`UPDATE food_listings SET status='delivered' WHERE id=$1`, [upd.rows[0].listing_id]);
    io.emit('pickup:status', upd.rows[0]);
    res.json(upd.rows[0]);
  });
  return r;
};
