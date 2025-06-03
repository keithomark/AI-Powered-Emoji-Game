const winston = require('winston');

const logger = winston.createLogger({
  level: 'info', // Log only if info or higher severity (http logs will also be captured)
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }), // Log stack traces
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'emoji-game-backend' },
  transports: [
    new winston.transports.Console() // Default transport, format will be overridden below
  ],
});

// Reconfigure console transport to use the main JSON format.
// This ensures all console output is structured JSON.
logger.transports[0].format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Ensure stack traces are included in console output
  winston.format.json()
);

// Add http level to Winston's default levels if it wasn't there
// (Winston's default npm levels include 'http', so this is more of a confirmation)
// Levels: { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 }
// 'info' level (2) is less severe than 'http' (3), so setting level to 'info'
// means http messages will be logged. If we set level to 'http', then info wouldn't.
// The default 'info' level is fine.

module.exports = logger;
