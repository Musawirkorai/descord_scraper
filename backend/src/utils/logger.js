const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf } = format;

const logFormat = printf(({ level, message, timestamp }) => `${timestamp} [${level}]: ${message}`);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new transports.Console({ format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat) }),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;
