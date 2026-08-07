require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

/**
 * Apply db/schema.sql to the database. Run with: npm run db:setup.
 * Safe to run repeatedly — the schema uses IF NOT EXISTS.
 */
async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema applied successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to apply schema:', err.message);
  process.exit(1);
});
