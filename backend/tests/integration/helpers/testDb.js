/**
 * Resolve the database URL integration tests should run against.
 * Prefers an explicit TEST_DATABASE_URL; otherwise falls back to a dedicated
 * learninglogs_test database on localhost so the dev database is never
 * touched by tests.
 * @returns {string} PostgreSQL connection string.
 */
function getTestDatabaseUrl() {
  return (
    process.env.TEST_DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/learninglogs_test'
  );
}

/**
 * Resolve the admin/owner URL for the test database, used for schema changes
 * and truncation that the restricted app role is not allowed to perform.
 * @returns {string} PostgreSQL connection string.
 */
function getTestDatabaseAdminUrl() {
  return (
    process.env.TEST_DATABASE_ADMIN_URL ||
    getTestDatabaseUrl()
  );
}

module.exports = { getTestDatabaseUrl, getTestDatabaseAdminUrl };
