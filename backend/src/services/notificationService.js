import webpush from 'web-push';
import { q } from '../db.js';

// VAPID keys setup (default dev keys or read from env)
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:notifications@foodbridge.local';
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  const generated = webpush.generateVAPIDKeys();
  vapidPublicKey = generated.publicKey;
  vapidPrivateKey = generated.privateKey;
  console.log('📢 Generated WebPush VAPID keys for development:');
  console.log(`   Public: ${vapidPublicKey}`);
}

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

export const getVapidPublicKey = () => vapidPublicKey;

/**
 * Store a browser WebPush subscription
 */
export async function savePushSubscription(userId, subscription) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Invalid WebPush subscription object');
  }
  await q(
    `INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth)
     VALUES($1, $2, $3, $4)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh=$3, auth=$4, created_at=now()`,
    [userId, endpoint, keys.p256dh, keys.auth]
  );
  return { ok: true };
}

/**
 * Dispatch WebPush notification to a specific user across all their registered devices
 */
export async function sendPushToUser(userId, { title, body, icon = '/icons/icon-192.png', url = '/' }) {
  const { rows } = await q('SELECT * FROM push_subscriptions WHERE user_id=$1', [userId]);
  const payload = JSON.stringify({ title, body, icon, url, timestamp: Date.now() });

  const promises = rows.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or unsubscribed
        await q('DELETE FROM push_subscriptions WHERE id=$1', [sub.id]);
      }
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Broadcast WebPush notification to all users with a specific role
 */
export async function sendPushToRole(role, { title, body, icon, url }) {
  const { rows } = await q(
    `SELECT ps.* FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = $1`, [role]);

  const payload = JSON.stringify({ title, body, icon, url, timestamp: Date.now() });
  const promises = rows.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await q('DELETE FROM push_subscriptions WHERE id=$1', [sub.id]);
      }
    }
  });
  await Promise.allSettled(promises);
}

/**
 * SMS Dispatcher (Twilio / AWS SNS / Development Simulation)
 */
export async function sendSms(toPhone, message) {
  if (!toPhone) return false;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const body = new URLSearchParams({ To: toPhone, From: twilioFrom, Body: message });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      return res.ok;
    } catch (err) {
      console.error('Twilio SMS error:', err);
    }
  }

  // Development / Demo Simulation mode:
  console.log(`📱 [SMS SIMULATION] To: ${toPhone} | Message: "${message}"`);
  return true;
}

/**
 * Alert volunteers via SMS when a pickup is available
 */
export async function alertVolunteersViaSms(pickupData) {
  try {
    const { rows } = await q(
      `SELECT phone, name FROM users WHERE role='volunteer' AND phone IS NOT NULL AND phone != '' AND sms_alerts_enabled=TRUE`
    );
    for (const v of rows) {
      const msg = `FoodBridge Alert: New pickup ready for "${pickupData.food_name || 'Food'}" (${pickupData.quantity || '10'} servings). Open FoodBridge app to accept!`;
      await sendSms(v.phone, msg);
    }
  } catch (err) {
    console.error('Error alerting volunteers via SMS:', err);
  }
}
