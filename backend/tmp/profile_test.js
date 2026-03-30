const fetch = global.fetch;

(async () => {
  try {
    console.log('1) Testing unauthorized access to /api/profile/upload-avatar');
    const noAuthRes = await fetch('http://localhost:3000/api/profile/upload-avatar', {
      method: 'POST'
    });
    console.log('   Status:', noAuthRes.status);
    console.log('   Body:', await noAuthRes.text());

    console.log('\n2) Logging in as admin to obtain token');
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tsumamngindodenis@gmail.com', password: 'Dennis123' })
    });
    const loginData = await loginRes.json();
    console.log('   Login status:', loginRes.status, 'ok:', loginRes.ok);
    if (!loginData.token) {
      console.error('   Login failed, cannot continue profile tests');
      return;
    }

    console.log('\n3) Testing authenticated upload-avatar without file');
    const authRes = await fetch('http://localhost:3000/api/profile/upload-avatar', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + loginData.token }
    });
    console.log('   Status:', authRes.status);
    console.log('   Body:', await authRes.text());
  } catch (err) {
    console.error('Test script error:', err);
    process.exit(1);
  }
})();
