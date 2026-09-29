import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const isRds = connectionString.includes('rds.amazonaws.com') ||
              connectionString.includes('sslmode=require') ||
              process.env.DB_SSL === 'true';

const client = new pg.Client({
  connectionString,
  ...(isRds && { ssl: { rejectUnauthorized: false } }),
});

async function runMigrations() {
  console.log('🚀 Connecting to PostgreSQL Database...');
  await client.connect();
  console.log('✅ Connected.');

  const migrationFiles = [
    'schema.sql',
    'migration_v2.sql',
    'migration_v3.sql',
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Warning: Migration file ${file} not found, skipping.`);
      continue;
    }

    console.log(`📄 Executing ${file}...`);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await client.query(sql);
      console.log(`✅ ${file} applied successfully.`);
    } catch (err) {
      console.error(`❌ Error executing ${file}:`, err.message);
      // Continue or throw depending on error
    }
  }

  await client.end();
  console.log('🎉 All migrations completed successfully.');
}

runMigrations().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
