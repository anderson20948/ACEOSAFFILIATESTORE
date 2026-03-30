const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('🚀 Starting System API Verification (using Native Fetch)...');
  
  let testToken = null;
  const testEmail = `test_user_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  try {
    // 1. Register
    console.log('\n--- Test 1: User Registration ---');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TEST_USER_99',
        email: testEmail,
        password: testPassword
      })
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(regData.message || 'Registration failed');
    console.log('✅ Registration Success:', regData.message);

    // 2. Login
    console.log('\n--- Test 2: User Login ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.message || 'Login failed');
    testToken = loginData.token;
    console.log('✅ Login Success. Token captured.');

    // 3. Profile
    console.log('\n--- Test 3: Profile Retrieval ---');
    const profileRes = await fetch(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.message || 'Profile fetch failed');
    console.log('✅ Profile matches:', profileData.name === 'TEST_USER_99' ? 'YES' : 'NO');
    console.log('   Role:', profileData.role);

    // 4. Advertising Application
    console.log('\n--- Test 4: Advertising Application Submission ---');
    const appRes = await fetch(`${BASE_URL}/affiliate/advertising/apply`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}` 
      },
      body: JSON.stringify({
        application_type: 'advertising',
        social_media_accounts: { facebook: 'https://face.book/test' },
        website_urls: ['https://test.site'],
        paypal_email: 'test@paypal.com',
        additional_notes: 'Automated test application'
      })
    });
    const appData = await appRes.json();
    if (!appRes.ok) throw new Error(appData.message || 'Application failed');
    console.log('✅ Application Success:', appData.success);

    console.log('\n🌟 API Verification Complete: ALL CORE UPDATES FUNCTIONAL.');

  } catch (err) {
    console.error('\n❌ Test Failed:', err.message);
    process.exit(1);
  }
}

runTests();
