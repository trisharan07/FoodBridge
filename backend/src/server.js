import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import donationRoutes from './routes/donations.js';
import pickupRoutes from './routes/pickups.js';
import adminRoutes from './routes/admin.js';
import trackingRoutes from './routes/tracking.js';
import freshnessRoutes from './routes/freshness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const io = new Server(server, { cors: { origin } });

// Each socket joins a room for its role and one for its own user id
io.use((socket, next) => {
  try {
    const u = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
    socket.join([u.role, `user:${u.id}`]);
    next();
  } catch { next(new Error('unauthorized')); }
});

app.use(cors({ origin }));
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes(io));
app.use('/api/pickups', pickupRoutes(io));
app.use('/api/admin', adminRoutes(io));
app.use('/api/tracking', trackingRoutes(io));
app.use('/api/freshness', freshnessRoutes());

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`FoodBridge API on :${port}`));
