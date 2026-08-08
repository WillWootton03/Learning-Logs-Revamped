// Debug script: verify RLS policies exist and context queries behave.
require('dotenv').config();
const { Database } = require('../db/pool');

const url = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/learninglogs_test';
const pool = new Database({ connectionString: url });

(async () => {
  // 1. Are RLS policies present? And what role are we running as?
  const role = await pool.query(
    `SELECT current_user, rolsuper, rolbypassrls, rolname FROM pg_roles WHERE rolname = current_user`
  );
  console.log('Role:', JSON.stringify(role.rows));

  const pol = await pool.query(
    `SELECT tablename, policyname FROM pg_policies ORDER BY tablename, policyname`
  );
  console.log('Policies:', JSON.stringify(pol.rows));

  const rls = await pool.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity
     FROM pg_class WHERE relrowsecurity ORDER BY relname`
  );
  console.log('RLS tables:', JSON.stringify(rls.rows));

  // 2. Insert a throwaway user. The INSERT is governed by users_register
  //    (WITH CHECK true), and its RETURNING clause must also satisfy the
  //    SELECT policy — so it runs under the email context, exactly like the
  //    real register flow does.
  const email = `rls-debug-${Date.now()}@example.com`;
  const user = await pool.runWithContext({ email }, () =>
    pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING user_id, email`,
      [email]
    )
  ).then((r) => r.rows[0]);
  console.log('Inserted user:', user.user_id, user.email);

  // 3. findById via userId context
  const byId = await pool.runWithContext({ userId: user.user_id }, () =>
    pool.query('SELECT user_id, email FROM users WHERE user_id = $1', [user.user_id])
  );
  console.log('byId rows:', byId.rowCount, byId.rows[0] || null);

  // 4. findByEmail via email context
  const byEmail = await pool.runWithContext({ email: user.email }, () =>
    pool.query('SELECT user_id, email FROM users WHERE email = $1', [user.email])
  );
  console.log('byEmail rows:', byEmail.rowCount, byEmail.rows[0] || null);

  // 5. No context (fail closed)
  const none = await pool.query('SELECT user_id, email FROM users WHERE email = $1', [user.email]);
  console.log('noContext rows:', none.rowCount);

  // 6. Update via userId context
  const upd = await pool.runWithContext({ userId: user.user_id }, () =>
    pool.query('UPDATE users SET full_name = $2 WHERE user_id = $1 RETURNING user_id', [user.user_id, 'Debug'])
  );
  console.log('update rows:', upd.rowCount);

  await pool.end();
})().catch((err) => {
  console.error('DEBUG ERROR:', err);
  process.exit(1);
});
