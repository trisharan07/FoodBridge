import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import donationRoutes from './routes/donations.js';
import pickupRoutes from './routes/pickups.js';

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
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes(io));
app.use('/api/pickups', pickupRoutes(io));

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`FoodBridge API on :${port}`));
