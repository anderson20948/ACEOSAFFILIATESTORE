const http = require('http');

const data = JSON.stringify({
  username: 'new_affiliate',
  email: 'affiliate@test.com',
  password: 'password123'
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
    console.log('Registration Status:', res.statusCode);
    console.log('Registration Response:', body);
    
    // Now test login
    const loginData = JSON.stringify({
      email: 'affiliate@test.com',
      password: 'password123'
    });
    
    const loginOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    };
    
    const loginReq = http.request(loginOptions, (loginRes) => {
      let loginBody = '';
      loginRes.on('data', d => loginBody += d);
      loginRes.on('end', () => {
        console.log('Login Status:', loginRes.statusCode);
        console.log('Login Response:', loginBody);
      });
    });
    loginReq.write(loginData);
    loginReq.end();
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
