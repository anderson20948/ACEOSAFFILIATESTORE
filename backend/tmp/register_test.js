const http = require('http');
const crypto = require('crypto');

const randomSuffix = crypto.randomBytes(4).toString('hex');
const payload = JSON.stringify({
  username: `Test User ${randomSuffix}`,
  email: `testuser_${randomSuffix}@example.com`,
  password: 'Test1234!'
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log('body', data);
  });
});

req.on('error', (err) => {
  console.error('error', err.message);
});

req.write(payload);
req.end();
