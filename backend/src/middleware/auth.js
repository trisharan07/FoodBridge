import jwt from 'jsonwebtoken';
export const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
export function auth(...roles) {
  return (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch { res.status(401).json({ error: 'Unauthorized' }); }
  };
}
