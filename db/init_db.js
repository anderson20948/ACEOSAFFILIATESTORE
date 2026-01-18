const fs = require('fs');
const path = require('path');
const db = require('./index');

async function initDb() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running database schema migration...');
        await db.query(schemaSql);
        console.log('Database schema applied successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error applying schema:', err);
        process.exit(1);
    }
}

initDb();
