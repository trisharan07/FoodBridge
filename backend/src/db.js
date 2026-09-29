import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const isRds = connectionString && (
  connectionString.includes('rds.amazonaws.com') ||
  connectionString.includes('sslmode=require') ||
  process.env.DB_SSL === 'true'
);

export const pool = new pg.Pool({
  connectionString,
  ...(isRds && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
});

export const q = (text, params) => pool.query(text, params);
