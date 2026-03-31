const http = require('http');
const crypto = require('crypto');

const suffix = crypto.randomBytes(4).toString('hex');
const user = {
  username: `Login User ${suffix}`,
  email: `loginuser_${suffix}@example.com`,
  password: 'Test1234!'
};

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ res, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  try {
    const payload = JSON.stringify(user);
    const registerOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const registerResult = await request(registerOptions, payload);
    console.log('REGISTER status', registerResult.res.statusCode);
    console.log('REGISTER body', registerResult.body);

    const loginPayload = JSON.stringify({
      email: user.email,
      password: user.password
    });

    const loginOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginPayload)
      }
    };

    const loginResult = await request(loginOptions, loginPayload);
    console.log('LOGIN status', loginResult.res.statusCode);
    console.log('LOGIN body', loginResult.body);

    if (loginResult.res.statusCode !== 200) {
      return process.exit(1);
    }

    const loginData = JSON.parse(loginResult.body);
    const token = loginData.token;
    if (!token) {
      console.error('No token returned from login');
      return process.exit(1);
    }

    const dashboardOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/dashboard',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const dashboardResult = await request(dashboardOptions);
    console.log('DASHBOARD status', dashboardResult.res.statusCode);
    console.log('DASHBOARD location', dashboardResult.res.headers.location);
    console.log('DASHBOARD body snippet', dashboardResult.body.slice(0, 500));

    if ([301, 302, 303, 307, 308].includes(dashboardResult.res.statusCode) && dashboardResult.res.headers.location) {
      const nextOptions = {
        hostname: '127.0.0.1',
        port: 3000,
        path: dashboardResult.res.headers.location,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      const followResult = await request(nextOptions);
      console.log('FOLLOW status', followResult.res.statusCode);
      console.log('FOLLOW path', dashboardResult.res.headers.location);
      console.log('FOLLOW body snippet', followResult.body.slice(0, 500));
    }
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();