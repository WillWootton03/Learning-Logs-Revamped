require('dotenv').config();

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var boardsRouter = require('./routes/boards');
var logsRouter = require('./routes/logs');
var conceptsRouter = require('./routes/concepts');
var tagsRouter = require('./routes/tags');

var app = express();

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

app.use(function (err, req, res, next) {
  var status = err.status || 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
