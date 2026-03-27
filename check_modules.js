const fs = require('fs');
const path = require('path');

const modules = [
    'dotenv', 'express', 'path', './dbConfig', 'bcryptjs', 'passport',
    'express-flash', 'express-session', 'cookie-parser', './services/emailService',
    './passportConfig', './routes/products', './routes/admin', './routes/affiliate',
    './routes/advertising', './routes/auth', './routes/paypal', './routes/tracking'
];

console.log('--- Module Check Start ---');
modules.forEach(m => {
    try {
        require.resolve(m);
        console.log(`OK: ${m}`);
    } catch (e) {
        console.log(`MISSING: ${m} - ${e.message}`);
    }
});

// Also check if critical files exist
const files = [
    './views/home.html',
    './views/login.html',
    './views/register.html',
    './views/admin.html',
    './views/index.ejs',
    './views/register.ejs',
    './views/login.ejs',
    './views/dashboard.ejs'
];

files.forEach(f => {
    if (fs.existsSync(path.join(__dirname, f))) {
        console.log(`FILE OK: ${f}`);
    } else {
        console.log(`FILE MISSING: ${f}`);
    }
});
console.log('--- Module Check End ---');
