// Load TEST_DATABASE_URL (and the rest of .env) before resolving the test
// database. Without dotenv here, getTestDatabaseUrl() falls back to a local
// default and the suite never reaches the Neon test branch.
require('dotenv').config();

const { getTestDatabaseUrl } = require('./helpers/testDb');

// Point the app at the test database before app.js (and its pool) is loaded.
// dotenv in app.js won't override these because they're already set.
process.env.DATABASE_URL = getTestDatabaseUrl();

// Deterministic secrets for the test environment.
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.JWT_EMAIL_SECRET = process.env.JWT_EMAIL_SECRET || 'test-email-secret';

// Frontend origin used for verification redirect URLs in tests.
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
