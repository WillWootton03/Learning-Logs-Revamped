/**
 * Integration test config. Hits the real Express app with supertest and a
 * real PostgreSQL database. Requires TEST_DATABASE_URL (or a local
 * learninglogs_test database) — see tests/integration/jest.setup.js.
 * Run with: npm run test:integration
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/integration/jest.setup.js'],
  globalSetup: '<rootDir>/tests/integration/globalSetup.js',
  testTimeout: 20000,
  maxWorkers: 1,
};
