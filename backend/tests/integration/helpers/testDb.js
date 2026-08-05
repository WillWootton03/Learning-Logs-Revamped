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

module.exports = { getTestDatabaseUrl };
