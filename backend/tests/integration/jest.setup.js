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

// Dummy Google credentials so authService can construct its OAuth2Client.
// /auth/google/callback still requires a real Google exchange, so it is not
// exercised against live Google here.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
