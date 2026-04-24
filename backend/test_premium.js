const http = require('http');

const data = JSON.stringify({
  username: 'premium_user',
  email: 'premium@example.com',
  password: 'premium_password'
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('--- REGISTRATION TEST ---');
    console.log('Status Code:', res.statusCode);
    const parsed = JSON.parse(body);
    console.log('Username:', parsed.username);
    console.log('Role:', parsed.role);
    console.log('Token Received:', parsed.token ? 'Yes' : 'No');
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
