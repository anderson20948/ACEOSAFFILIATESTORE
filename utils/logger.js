const fs = require('fs');
const path = require('path');

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const formatLog = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
    }) + '\n';
};

const logger = {
    info: (message, meta) => {
        const entry = formatLog('INFO', message, meta);
        process.stdout.write(entry);
    },
    error: (message, meta) => {
        const entry = formatLog('ERROR', message, meta);
        process.stderr.write(entry);
        fs.appendFileSync(path.join(logDir, 'error.log'), entry);
    },
    warn: (message, meta) => {
        const entry = formatLog('WARN', message, meta);
        process.stdout.write(entry);
    },
    debug: (message, meta) => {
        if (process.env.NODE_ENV !== 'production') {
            const entry = formatLog('DEBUG', message, meta);
            process.stdout.write(entry);
        }
    }
};

module.exports = logger;
