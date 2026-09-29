import { Router } from 'express';
import { q } from '../db.js';
import { auth } from '../middleware/auth.js';

export default (io) => {
  const r = Router();

  // Volunteer pushes their GPS location
  r.post('/:pickupId/location', auth('volunteer'), async (req, res) => {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat and lng required' });

    const { rows } = await q(
      `UPDATE volunteer_assignments
       SET current_lat=$1, current_lng=$2, location_updated_at=now()
       WHERE pickup_id=$3 AND volunteer_id=$4
       RETURNING pickup_id`,
      [lat, lng, req.params.pickupId, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found' });

    // Broadcast to the NGO and donor watching this pickup
    io.emit('tracking:location', {
      pickupId: req.params.pickupId,
      lat, lng,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  });

  // Anyone involved can get the current tracking info for a pickup
  r.get('/:pickupId/location', auth(), async (req, res) => {
    const { rows } = await q(
      `SELECT va.current_lat AS lat, va.current_lng AS lng, va.location_updated_at,
              u.name AS volunteer_name, p.status,
              f.lat AS pickup_lat, f.lng AS pickup_lng, f.address AS pickup_address
       FROM volunteer_assignments va
       JOIN users u ON u.id = va.volunteer_id
       JOIN pickups p ON p.id = va.pickup_id
       JOIN food_listings f ON f.id = p.listing_id
       WHERE va.pickup_id = $1`, [req.params.pickupId]);
    if (!rows[0]) return res.status(404).json({ error: 'No tracking info' });
    res.json(rows[0]);
  });

  // Volunteer confirms delivery (with optional note)
  r.post('/:pickupId/confirm-delivery', auth('volunteer'), async (req, res) => {
    const { note } = req.body;

    // First verify this volunteer owns the assignment
    const check = await q(
      `SELECT p.id, p.status FROM pickups p
       JOIN volunteer_assignments va ON va.pickup_id = p.id
       WHERE p.id = $1 AND va.volunteer_id = $2`,
      [req.params.pickupId, req.user.id]);

    if (!check.rows[0]) return res.status(404).json({ error: 'Assignment not found' });
    if (check.rows[0].status === 'delivered') return res.status(400).json({ error: 'Already delivered' });

    // Advance to delivered
    const upd = await q(
      `UPDATE pickups SET status='delivered', delivered_at=now(), delivery_note=$1
       WHERE id=$2 RETURNING *`,
      [note || null, req.params.pickupId]);

    // Also update the food listing
    await q(`UPDATE food_listings SET status='delivered' WHERE id=$1`, [upd.rows[0].listing_id]);

    await q('INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',
      [req.user.id, 'delivery.confirm', 'pickup', req.params.pickupId]);

    io.to(`user:${upd.rows[0].ngo_id}`).emit('delivery:confirmed', upd.rows[0]);
    io.emit('pickup:status', upd.rows[0]);
    res.json(upd.rows[0]);
  });

  // Get full delivery timeline for a pickup
  r.get('/:pickupId/timeline', auth(), async (req, res) => {
    const { rows } = await q(
      `SELECT p.status, p.created_at AS claimed_at, p.delivered_at, p.delivery_note,
              va.assigned_at, va.location_updated_at,
              f.food_name, f.quantity, f.address AS pickup_address,
              d.name AS donor_name, n.name AS ngo_name, v.name AS volunteer_name
       FROM pickups p
       JOIN food_listings f ON f.id = p.listing_id
       JOIN users d ON d.id = f.donor_id
       JOIN users n ON n.id = p.ngo_id
       LEFT JOIN volunteer_assignments va ON va.pickup_id = p.id
       LEFT JOIN users v ON v.id = va.volunteer_id
       WHERE p.id = $1`, [req.params.pickupId]);
    if (!rows[0]) return res.status(404).json({ error: 'Pickup not found' });
    res.json(rows[0]);
  });

  return r;
};
