const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: raw
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function main() {
  const host = '127.0.0.1';
  const port = 3000;
  const jwtSecret = 'SUPERSECRETJWTKEY12345';
  const adminToken = jwt.sign(
    {
      id: '541d1c56-f5bc-4e39-96b4-225e0e67c300',
      email: 'tsumamngindodenis@gmail.com',
      role: 'admin',
      name: 'Dennis Admin'
    },
    jwtSecret,
    { expiresIn: '24h' }
  );
  const authHeader = `Bearer ${adminToken}`;

  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const testUser = {
    name: `Delete Test ${randomSuffix}`,
    email: `delete_test_${randomSuffix}@example.com`,
    password: 'Test1234!'
  };

  console.log('1) Creating a test user via admin API with a signed admin token...');
  const createPayload = JSON.stringify(testUser);
  const createRes = await request({
    hostname: host,
    port,
    path: '/api/admin/create-user',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(createPayload),
      'Authorization': authHeader
    }
  }, createPayload);

  console.log('  create status:', createRes.status);
  console.log('  create body:', createRes.body);

  if (createRes.status !== 201) {
    throw new Error(`Create user failed: ${createRes.status} ${createRes.body}`);
  }

  const created = JSON.parse(createRes.body);
  const userId = created.user?.id;
  if (!userId) {
    throw new Error('Created user response did not include id.');
  }

  console.log(`2) Test user created with id=${userId}. Deleting now...`);
  const deleteRes = await request({
    hostname: host,
    port,
    path: `/api/admin/delete-user/${userId}`,
    method: 'DELETE',
    headers: {
      'Authorization': authHeader
    }
  });

  console.log('  delete status:', deleteRes.status);
  console.log('  delete body:', deleteRes.body);

  if (deleteRes.status !== 200) {
    throw new Error(`Delete user failed: ${deleteRes.status} ${deleteRes.body}`);
  }

  console.log('3) Delete operation succeeded.');
}

main().catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
