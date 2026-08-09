const tracer = require('dd-trace');

/**
 * Structured JSON logger for Datadog.
 *
 * The request logger in app.js covers one line per HTTP request; this module
 * lets non-request code (cache lookups, background work) emit the same style
 * of line. Every entry is a single JSON object with a timestamp, level, and
 * message plus caller-supplied metadata, and the active trace/span ids are
 * injected whenever a span exists so each log line correlates with its APM
 * trace in the Logs Explorer.
 *
 * Usage:
 *   logger.info('Cache lookup', { cache: { status: 'hit', route: '/boards/:boardId/concepts' } });
 */
function emit(level, message, meta) {
  const span = tracer.scope().active();
  const log = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  if (span) {
    log['dd.trace_id'] = span.context().toTraceId();
    log['dd.span_id'] = span.context().toSpanId();
  }
  process.stdout.write(`${JSON.stringify(log)}\n`);
}

const logger = {
  info: (message, meta = {}) => emit('info', message, meta),
  warn: (message, meta = {}) => emit('warn', message, meta),
  error: (message, meta = {}) => emit('error', message, meta),
};

module.exports = { logger };
