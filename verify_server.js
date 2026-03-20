const http = require('http');

http.get('http://localhost:3000', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', () => { });
    res.on('end', () => {
        process.exit(0);
    });
}).on('error', (e) => {
    console.error(`GOT ERROR: ${e.message}`);
    process.exit(1);
});
