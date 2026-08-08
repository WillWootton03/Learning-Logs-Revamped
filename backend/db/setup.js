require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Database } = require('./pool');

/**
 * Apply db/schema.sql to the database. Run with: npm run db:setup.
 * Safe to run repeatedly — the schema uses IF NOT EXISTS.
 *
 * Schema changes (CREATE/DROP TABLE, policies) run as the admin role
 * (DATABASE_ADMIN_URL, the table owner) because the application role cannot
 * run DDL. The app role only executes queries against the resulting tables.
 */
async function main() {
  const adminUrl = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  const pool = new Database({ connectionString: adminUrl });
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema applied successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to apply schema:', err.message);
  process.exit(1);
});
