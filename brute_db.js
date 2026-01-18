const { Client } = require('pg');

const users = ['conbailey', 'postgres'];
const passwords = ['Ande001rson', 'Ande001rson,', 'ande001rson', 'ande001rson,', 'Anderson', 'Anderson,', 'anderson', 'anderson,', 'password'];
const databases = ['systemusers', 'postgres'];
const hosts = ['localhost', '127.0.0.1'];
const ports = [5432, 5433];

async function test() {
    for (const host of hosts) {
        for (const port of ports) {
            for (const db of databases) {
                for (const user of users) {
                    for (const pass of passwords) {
                        // console.log(`Testing: host=${host}, port=${port}, db=${db}, user=${user}, pass=${pass}`);
                        const client = new Client({
                            user: user,
                            host: host,
                            database: db,
                            password: pass,
                            port: port,
                        });
                        try {
                            await client.connect();
                            console.log(`SUCCESS! host=${host}, port=${port}, db=${db}, user=${user}, pass=${pass}`);
                            await client.end();
                            process.exit(0);
                        } catch (err) {
                            // console.log(`Failed: ${err.message}`);
                        }
                    }
                }
            }
        }
    }
    console.log("None of the combinations worked.");
    process.exit(1);
}

test();
