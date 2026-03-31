const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'register_test_result.txt');
const data = fs.readFileSync(file);
process.stdout.write(data.toString('utf16le'));
