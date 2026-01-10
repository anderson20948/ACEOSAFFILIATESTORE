const { Client } = require('pg');
require('dotenv').config();

console.log("Config:", {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    port: process.env.DB_PORT,
    passLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0
});

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const targetDb = process.env.DB_DATABASE;

async function setup() {
    try {
        await client.connect();
        console.log("Connected to postgres database.");

        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname='${targetDb}'`);
        if (res.rowCount === 0) {
            console.log(`Creating database ${targetDb}...`);
            await client.query(`CREATE DATABASE ${targetDb}`);
        } else {
            console.log(`Database ${targetDb} already exists.`);
        }
        await client.end();

        const targetClient = new Client({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: targetDb,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        });
        await targetClient.connect();
        console.log(`Connected to ${targetDb} database.`);

        const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            name VARCHAR(200) NOT NULL,
            email VARCHAR(200) NOT NULL,
            password VARCHAR(200) NOT NULL,
            role VARCHAR(50) DEFAULT 'affiliate',
            UNIQUE (email)
        );

        CREATE TABLE IF NOT EXISTS activities (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            username VARCHAR(200),
            activity_type VARCHAR(100),
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            title VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            description TEXT,
            category VARCHAR(100) DEFAULT 'General',
            status VARCHAR(50) DEFAULT 'pending',
            user_id BIGINT,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payments (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            order_id VARCHAR(100),
            user_id BIGINT,
            username VARCHAR(200),
            product_title VARCHAR(255),
            amount DECIMAL(10, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `;
        await targetClient.query(createTableQuery);

        // Ensure role column exists if table was already there
        await targetClient.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
                    ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'affiliate';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN
                    ALTER TABLE products ADD COLUMN category VARCHAR(100) DEFAULT 'General';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
                    ALTER TABLE products ADD COLUMN image_url TEXT;
                END IF;
            END $$;
        `);

        console.log("Database schema updated successfully.");
        await targetClient.end();
        process.exit(0);
    } catch (err) {
        console.error("Error during setup:", err);
        process.exit(1);
    }
}

setup();
