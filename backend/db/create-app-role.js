/**
 * Create the restricted application role that row-level security actually
 * enforces against.
 *
 * Neon's admin role (neondb_owner) has BYPASSRLS, so RLS policies are skipped
 * for that connection no matter what. Postgres only applies policies to roles
 * that cannot bypass them, so the app must run as a dedicated, least-privileged
 * role while the owner role is used purely for migrations.
 *
 * Run with: npm run db:role. Safe to run repeatedly.
 *
 * What it does:
 *   - creates the learninglogs_app LOGIN role (if missing) with a random password
 *   - grants schema usage + SELECT/INSERT/UPDATE/DELETE on every table (and
 *     default privileges for tables the owner creates later, e.g. after db:setup)
 *   - repeats this on the test database when TEST_DATABASE_URL differs (roles
 *     are created per compute, so a branch that lags behind gets the role too)
 *   - rewrites .env so DATABASE_URL / TEST_DATABASE_URL point at the app role and
 *     the owner URLs are preserved as DATABASE_ADMIN_URL / TEST_DATABASE_ADMIN_URL
 *
 * Recovery: if a previous run created the role but failed before updating .env,
 * this detects that DATABASE_URL still uses the owner role and resets the app
 * role's password so the connection string written to .env is valid.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Database } = require('./pool');

const APP_ROLE = 'learninglogs_app';

/** @param {string} connectionString */
function parse(connectionString) {
  return new URL(connectionString);
}

/**
 * Swap the username/password of a connection string for a given role.
 * Host, database, and query params are preserved.
 * @param {string} connectionString
 * @param {string} username
 * @param {string} password
 */
function rewriteCredentials(connectionString, username, password) {
  const url = parse(connectionString);
  url.username = username;
  url.password = encodeURIComponent(password);
  return url.toString();
}

/** Escape a string for embedding inside a SQL literal. */
function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** @param {import('pg').PoolClient | import('pg').Pool} client */
async function grantAccess(client) {
  await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`
  );
  await client.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO ${APP_ROLE}`
  );
}

/**
 * Ensure the app role exists on this connection and has its grants.
 * @param {Database} db
 * @param {string|null} password - set to force/reset the role's password.
 */
async function ensureRole(db, password) {
  const existing = await db.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_ROLE]);
  if (existing.rowCount > 0) {
    if (password) {
      await db.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD ${sqlLiteral(password)}`);
      console.log(`Reset password for ${APP_ROLE}.`);
    } else {
      console.log(`Role ${APP_ROLE} already exists — keeping its password.`);
    }
  } else {
    await db.query(`CREATE ROLE ${APP_ROLE} LOGIN PASSWORD ${sqlLiteral(password)}`);
    console.log(`Created role ${APP_ROLE}.`);
  }
  await grantAccess(db);
}

/** Insert or replace a KEY=VALUE line in .env, appending missing keys. */
function updateEnvFile(envPath, updates) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=`);
    const index = lines.findIndex((line) => re.test(line));
    if (index >= 0) {
      lines[index] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  fs.writeFileSync(envPath, lines.join('\n'));
}

async function main() {
  const adminUrl = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) {
    throw new Error('DATABASE_URL (or DATABASE_ADMIN_URL) must be set in .env');
  }

  // A password reset (and .env rewrite) is needed unless the app role is
  // already the configured connection — i.e. a previous run finished cleanly.
  const appUrlUsesRole = Boolean(process.env.DATABASE_URL && parse(process.env.DATABASE_URL).username === APP_ROLE);
  const adminHasRole = (await new Database({ connectionString: adminUrl })
    .query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_ROLE])).rowCount > 0;
  const needsPassword = !(adminHasRole && appUrlUsesRole);
  const password = needsPassword ? crypto.randomBytes(24).toString('base64url') : null;

  const admin = new Database({ connectionString: adminUrl });
  await ensureRole(admin, password);
  console.log(`Ensured ${APP_ROLE} access on ${parse(adminUrl).host}.`);
  await admin.end();

  // The test database lives on a separate branch/compute. Neon propagates roles
  // across branches, but if the branch hasn't caught up yet, create it there too.
  if (testUrl && parse(testUrl).host !== parse(adminUrl).host) {
    const testAdminUrl =
      process.env.TEST_DATABASE_ADMIN_URL ||
      rewriteCredentials(testUrl, parse(adminUrl).username, parse(adminUrl).password || '');
    const testAdmin = new Database({ connectionString: testAdminUrl });
    try {
      await ensureRole(testAdmin, password);
      console.log(`Ensured ${APP_ROLE} access on ${parse(testUrl).host}.`);
    } finally {
      await testAdmin.end();
    }
  }

  if (needsPassword) {
    const envPath = path.join(__dirname, '..', '.env');
    const originalAppUrl = process.env.DATABASE_URL;
    const updates = {};

    if (!process.env.DATABASE_ADMIN_URL && originalAppUrl) {
      updates.DATABASE_ADMIN_URL = originalAppUrl;
    }
    if (originalAppUrl) {
      updates.DATABASE_URL = rewriteCredentials(originalAppUrl, APP_ROLE, password);
    }
    if (testUrl) {
      if (!process.env.TEST_DATABASE_ADMIN_URL) {
        updates.TEST_DATABASE_ADMIN_URL = testUrl;
      }
      updates.TEST_DATABASE_URL = rewriteCredentials(testUrl, APP_ROLE, password);
    }

    updateEnvFile(envPath, updates);
    console.log('Updated .env: DATABASE_URL now uses the restricted role; owner URLs preserved as *_ADMIN_URL.');
  } else {
    console.log('No .env changes needed — app role is already the configured connection.');
  }

  console.log('Done. The app now enforces RLS at the database layer.');
}

main().catch((err) => {
  console.error('Failed to create app role:', err.message);
  process.exit(1);
});
