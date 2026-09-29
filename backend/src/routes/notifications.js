import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getVapidPublicKey,
  savePushSubscription,
  sendPushToUser,
  sendSms
} from '../services/notificationService.js';
import { q } from '../db.js';

export default () => {
  const r = Router();

  // Return public VAPID key so frontend Service Worker can subscribe
  r.get('/vapid-public-key', (_req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  // Register a browser WebPush subscription
  r.post('/subscribe', auth(), async (req, res) => {
    try {
      const { subscription } = req.body;
      if (!subscription) return res.status(400).json({ error: 'subscription is required' });
      await savePushSubscription(req.user.id, subscription);
      res.json({ ok: true, message: 'WebPush subscription registered' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test WebPush dispatch
  r.post('/test-push', auth(), async (req, res) => {
    try {
      await sendPushToUser(req.user.id, {
        title: '🍽️ FoodBridge Notification',
        body: 'Push notifications are successfully active on this device!',
        url: '/',
      });
      res.json({ ok: true, message: 'Test push notification dispatched' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test SMS alert dispatch
  r.post('/test-sms', auth(), async (req, res) => {
    try {
      const { phone } = req.body;
      const { rows } = await q('SELECT phone FROM users WHERE id=$1', [req.user.id]);
      const targetPhone = phone || rows[0]?.phone;
      if (!targetPhone) return res.status(400).json({ error: 'No phone number provided' });

      await sendSms(targetPhone, 'FoodBridge Test Alert: SMS integration is functioning properly.');
      res.json({ ok: true, phone: targetPhone, message: 'SMS alert sent (or simulated in console)' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return r;
};
