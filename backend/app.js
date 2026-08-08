require('dotenv').config();

// Datadog APM: must be initialized before any module that opens connections
// (express, pg, ...) is required, so the tracer can wrap them. Reads
// DD_TRACE_AGENT_URL / DD_ENV / DD_SERVICE from the environment.
const tracer = require('dd-trace').init({ logInjection: true });

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var boardsRouter = require('./routes/boards');
var logsRouter = require('./routes/logs');
var conceptsRouter = require('./routes/concepts');
var tagsRouter = require('./routes/tags');
var quizSettingsRouter = require('./routes/quiz-settings');
var quizzesRouter = require('./routes/quizzes');

var app = express();

// The Vite dev server (localhost:5173) calls this API cross-origin and relies
// on httpOnly cookies, so credentials must be allowed. Configured origin is
// overridable via FRONTEND_ORIGIN for other environments (e.g. a deployed SPA).
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Structured JSON request logs for Datadog. One line per request with the
// method, URL, status, and duration, plus the active trace/span ids so every
// log line correlates with its APM trace in the Logs Explorer.
app.use(
  logger(function (tokens, req, res) {
    const span = tracer.scope().active();
    const status = parseInt(tokens.status(req, res) ?? '0', 10) || 0;
    const responseTimeMs = parseFloat(tokens['response-time'](req, res) ?? '0') || 0;
    const log = {
      timestamp: tokens.date(req, res, 'iso'),
      message: `${tokens.method(req, res)} ${tokens.url(req, res)} ${status} ${responseTimeMs}ms`,
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status,
      response_time_ms: responseTimeMs,
    };
    if (span) {
      log['dd.trace_id'] = span.context().toTraceId();
      log['dd.span_id'] = span.context().toSpanId();
    }
    return JSON.stringify(log);
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/boards', boardsRouter);
app.use('/boards/:boardId/logs', logsRouter);
app.use('/boards/:boardId/concepts', conceptsRouter);
app.use('/boards/:boardId/tags', tagsRouter);
app.use('/boards/:boardId/quiz-settings', quizSettingsRouter);
app.use('/boards/:boardId/quizzes', quizzesRouter);

app.use(function (err, req, res, next) {
  var status = err.status || 500;
  if (status === 500) {
    console.error(err);
  }
  // Include the machine-readable code when the service attached one, so the
  // client can detect e.g. EMAIL_NOT_VERIFIED without parsing messages.
  res.status(status).json({ error: err.message || 'Internal server error', code: err.code });
});

module.exports = app;
