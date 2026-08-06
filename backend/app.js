require('dotenv').config();

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

app.use(logger('dev'));
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
