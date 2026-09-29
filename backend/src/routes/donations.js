import { Router } from 'express';
import { q } from '../db.js';
import { auth } from '../middleware/auth.js';
import { sendPushToRole, sendPushToUser, alertVolunteersViaSms } from '../services/notificationService.js';

export default (io) => {
  const r = Router();

  // List available donations with lat/lng for map display
  r.get('/', auth(), async (req, res) => {
    const { rows } = await q(
      `SELECT f.*, u.name AS donor_name FROM food_listings f JOIN users u ON u.id=f.donor_id
       WHERE f.status='available' AND f.expires_at > now() ORDER BY f.pickup_until ASC`);
    res.json(rows);
  });

  // Nearby donations within a radius (km), using Haversine approximation
  r.get('/nearby', auth(), async (req, res) => {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng query params required' });
    const { rows } = await q(
      `SELECT f.*, u.name AS donor_name,
              (6371 * acos(cos(radians($1)) * cos(radians(f.lat)) *
               cos(radians(f.lng) - radians($2)) + sin(radians($1)) *
               sin(radians(f.lat)))) AS distance_km
       FROM food_listings f JOIN users u ON u.id=f.donor_id
       WHERE f.status='available' AND f.expires_at > now()
         AND f.lat IS NOT NULL AND f.lng IS NOT NULL
       HAVING (6371 * acos(cos(radians($1)) * cos(radians(f.lat)) *
               cos(radians(f.lng) - radians($2)) + sin(radians($1)) *
               sin(radians(f.lat)))) < $3
       ORDER BY distance_km`, [lat, lng, radius]);
    res.json(rows);
  });

  r.post('/', auth('donor'), async (req, res) => {
    const { foodName, quantity, unit, pickupFrom, pickupUntil, expiresAt, address, lat, lng } = req.body;
    if (!foodName || !(quantity > 0) || !pickupFrom || !pickupUntil || !expiresAt)
      return res.status(400).json({ error: 'Food name, quantity, pickup window and expiry are required' });
    if (new Date(pickupUntil) <= new Date(pickupFrom))
      return res.status(400).json({ error: 'Pickup end must be after pickup start' });
    const { rows } = await q(
      `INSERT INTO food_listings(donor_id,food_name,quantity,unit,pickup_from,pickup_until,expires_at,address,lat,lng)
       VALUES($1,$2,$3,COALESCE($4,'servings'),$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, foodName, quantity, unit, pickupFrom, pickupUntil, expiresAt, address, lat, lng]);
    await q('INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',
      [req.user.id, 'listing.create', 'food_listing', rows[0].id]);

    io.to('ngo').emit('donation:new', rows[0]);

    // Dispatch WebPush to NGOs
    sendPushToRole('ngo', {
      title: '🍱 New Food Donation Available!',
      body: `${rows[0].food_name} (${rows[0].quantity} servings) posted by nearby donor.`,
      url: '/',
    });

    res.status(201).json(rows[0]);
  });

  // The WHERE status='available' makes this safe if two NGOs click at once.
  r.post('/:id/claim', auth('ngo'), async (req, res) => {
    const upd = await q(
      `UPDATE food_listings SET status='claimed' WHERE id=$1 AND status='available' RETURNING *`, [req.params.id]);
    if (!upd.rows[0]) return res.status(409).json({ error: 'This donation was already claimed' });
    const p = await q('INSERT INTO pickups(listing_id,ngo_id) VALUES($1,$2) RETURNING *', [req.params.id, req.user.id]);

    io.to('volunteer').emit('pickup:open', p.rows[0]);
    io.to(`user:${upd.rows[0].donor_id}`).emit('donation:claimed', upd.rows[0]);

    // Send WebPush to Donor that food was claimed
    sendPushToUser(upd.rows[0].donor_id, {
      title: '🍽️ Your Donation Has Been Claimed!',
      body: `An NGO has claimed "${upd.rows[0].food_name}". A volunteer will be dispatched soon.`,
      url: '/',
    });

    // Alert Volunteers via WebPush & SMS
    sendPushToRole('volunteer', {
      title: '🚴 New Food Delivery Needed!',
      body: `Pickup ready for "${upd.rows[0].food_name}" (${upd.rows[0].quantity} servings).`,
      url: '/',
    });
    alertVolunteersViaSms(upd.rows[0]);

    res.status(201).json(p.rows[0]);
  });
  return r;
};
