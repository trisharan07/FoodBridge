import { Router } from 'express';
import { q } from '../db.js';
import { auth } from '../middleware/auth.js';
import { sendPushToUser, sendSms } from '../services/notificationService.js';

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

  // -------------------------------------------------------------
  // OSRM Turn-by-Turn Route Optimization
  // -------------------------------------------------------------
  r.get('/:pickupId/route', auth(), async (req, res) => {
    const { rows } = await q(
      `SELECT va.current_lat, va.current_lng,
              f.lat AS pickup_lat, f.lng AS pickup_lng, f.address, f.food_name
       FROM pickups p
       JOIN food_listings f ON f.id = p.listing_id
       LEFT JOIN volunteer_assignments va ON va.pickup_id = p.id
       WHERE p.id = $1`, [req.params.pickupId]);

    if (!rows[0]) return res.status(404).json({ error: 'Pickup not found' });
    const item = rows[0];

    // Default coordinates if missing (e.g. Mumbai demo center)
    const vLat = item.current_lat || 19.076;
    const vLng = item.current_lng || 72.877;
    const pLat = item.pickup_lat || 19.085;
    const pLng = item.pickup_lng || 72.890;

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${vLng},${vLat};${pLng},${pLat}?overview=full&geometries=geojson&steps=true`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const osrmRes = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (osrmRes.ok) {
        const data = await osrmRes.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // OSRM returns [lng, lat], Leaflet polyline expects [lat, lng]
          const polyline = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          const steps = (route.legs?.[0]?.steps || []).map((s, idx) => ({
            step: idx + 1,
            instruction: s.maneuver.type === 'arrive' ? 'Arrive at destination' : (s.name ? `Head on ${s.name}` : `Turn ${s.maneuver.modifier || s.maneuver.type}`),
            type: s.maneuver.type,
            modifier: s.maneuver.modifier,
            distanceMeters: Math.round(s.distance),
            durationSec: Math.round(s.duration),
          }));

          return res.json({
            ok: true,
            distanceKm: +(route.distance / 1000).toFixed(2),
            durationMin: Math.ceil(route.duration / 60),
            polyline,
            steps,
            origin: [vLat, vLng],
            destination: [pLat, pLng],
            source: 'OSRM',
          });
        }
      }
    } catch (e) {
      console.warn('OSRM route fetch failed, using direct waypoint geometry:', e.message);
    }

    // Direct interpolation fallback
    const directPolyline = [
      [vLat, vLng],
      [(vLat + pLat) / 2 + 0.002, (vLng + pLng) / 2 - 0.001],
      [pLat, pLng],
    ];
    res.json({
      ok: true,
      distanceKm: 2.4,
      durationMin: 9,
      polyline: directPolyline,
      steps: [
        { step: 1, instruction: 'Start on current street toward pickup', distanceMeters: 800, durationSec: 180 },
        { step: 2, instruction: 'Continue on main avenue', distanceMeters: 1200, durationSec: 300 },
        { step: 3, instruction: 'Arrive at donor pickup address', distanceMeters: 400, durationSec: 60 },
      ],
      origin: [vLat, vLng],
      destination: [pLat, pLng],
      source: 'Direct-Fallback',
    });
  });

  // Volunteer confirms delivery (with optional note)
  r.post('/:pickupId/confirm-delivery', auth('volunteer'), async (req, res) => {
    const { note } = req.body;

    // Verify this volunteer owns the assignment
    const check = await q(
      `SELECT p.id, p.status, p.ngo_id, f.donor_id, f.food_name FROM pickups p
       JOIN volunteer_assignments va ON va.pickup_id = p.id
       JOIN food_listings f ON f.id = p.listing_id
       WHERE p.id = $1 AND va.volunteer_id = $2`,
      [req.params.pickupId, req.user.id]);

    if (!check.rows[0]) return res.status(404).json({ error: 'Assignment not found' });
    if (check.rows[0].status === 'delivered') return res.status(400).json({ error: 'Already delivered' });

    // Advance to delivered
    const upd = await q(
      `UPDATE pickups SET status='delivered', delivered_at=now(), delivery_note=$1
       WHERE id=$2 RETURNING *`,
      [note || null, req.params.pickupId]);

    // Update food listing
    await q(`UPDATE food_listings SET status='delivered' WHERE id=$1`, [upd.rows[0].listing_id]);

    await q('INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',
      [req.user.id, 'delivery.confirm', 'pickup', req.params.pickupId]);

    // Dispatch WebPush alerts to NGO and Donor
    const foodName = check.rows[0].food_name || 'Food';
    sendPushToUser(check.rows[0].ngo_id, {
      title: '✅ Food Delivered!',
      body: `Your claimed donation "${foodName}" has been successfully delivered.`,
      url: '/',
    });
    sendPushToUser(check.rows[0].donor_id, {
      title: '🎉 Surplus Food Delivered!',
      body: `"${foodName}" was delivered to the community NGO. Thank you for rescuing food!`,
      url: '/',
    });

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
