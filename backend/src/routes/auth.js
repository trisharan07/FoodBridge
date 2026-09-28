import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { sign } from '../middleware/auth.js';
const r = Router();
const ROLES = ['donor', 'ngo', 'volunteer'];

r.post('/register', async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password || password.length < 8 || !ROLES.includes(role))
    return res.status(400).json({ error: 'Name, email, role and a password of 8+ characters are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await q(
      'INSERT INTO users(name,email,phone,role,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role',
      [name, email.toLowerCase(), phone, role, hash]);
    res.status(201).json({ user: rows[0], token: sign(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Server error' });
  }
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await q('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role }, token: sign(u) });
});
export default r;
