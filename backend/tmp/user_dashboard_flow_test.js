const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Blob, FormData } = global;

const BASE_URL = 'http://127.0.0.1:3000';

async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: response.status, body, headers: response.headers };
}

async function registerUser() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const payload = {
    username: `Test User ${suffix}`,
    email: `testuser_${suffix}@example.com`,
    password: 'Test1234!'
  };

  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('REGISTER', res.status, res.body);
  if (res.status !== 201) throw new Error('Registration failed');
  return { token: res.body.token, id: res.body.id, email: payload.email };
}

async function loginUser(email, password) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  console.log('LOGIN', res.status, res.body);
  if (res.status !== 200) throw new Error('Login failed');
  return { token: res.body.token, profile_picture_url: res.body.profile_picture_url };
}

async function uploadProfileAvatar(token) {
  const sampleUrl = 'https://via.placeholder.com/256.png';
  const imageRes = await fetch(sampleUrl);
  if (!imageRes.ok) throw new Error(`Failed to download sample image: ${imageRes.status}`);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  const form = new FormData();
  form.append('avatar', blob, 'avatar.png');

  const res = await apiFetch('/api/profile/upload-avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  console.log('UPLOAD AVATAR', res.status, res.body);
  if (res.status !== 200 || !res.body.success) throw new Error('Avatar upload failed');
  return res.body.imageUrl;
}

async function fetchUserProfile(token) {
  const res = await apiFetch('/api/auth/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('PROFILE', res.status, res.body);
  if (res.status !== 200) throw new Error('Fetching profile failed');
  return res.body;
}

async function submitApplication(token) {
  const payload = {
    application_type: 'advertising',
    social_media_accounts: { instagram: 'https://instagram.com/testuser' },
    website_urls: ['https://example.com'],
    paypal_email: 'testpayee@example.com',
    additional_notes: 'Automated user application test.'
  };

  const res = await apiFetch('/api/affiliate/advertising/apply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  console.log('APPLICATION SUBMIT', res.status, res.body);
  if (res.status !== 200 || !res.body.success) throw new Error('Application submission failed');
  return res.body.applicationId;
}

async function fetchApplications(token) {
  const res = await apiFetch('/api/affiliate/applications', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('APPLICATIONS', res.status, res.body);
  if (res.status !== 200 || !res.body.success) throw new Error('Fetching applications failed');
  return res.body.applications;
}

(async () => {
  try {
    console.log('=== User dashboard flow test ===');
    const { token, email } = await registerUser();

    const login = await loginUser(email, 'Test1234!');
    const avatarUrl = await uploadProfileAvatar(login.token);
    console.log('Avatar upload public URL:', avatarUrl);

    const profile = await fetchUserProfile(login.token);
    console.log('Profile data after upload:', profile);

    const appId = await submitApplication(login.token);
    console.log('Submitted application id:', appId);

    const applications = await fetchApplications(login.token);
    console.log('User applications count:', applications.length);
    console.log('Latest application data:', applications[0] || null);

    console.log('=== User dashboard flow test completed successfully ===');
  } catch (err) {
    console.error('TEST FAILURE:', err.message);
    process.exit(1);
  }
})();
