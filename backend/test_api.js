async function testRegistration() {
    const url = 'http://localhost:3000/api/auth/register';
    const body = {
        username: 'Test User ' + Date.now(),
        email: 'test' + Date.now() + '@example.com',
        password: 'password123'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('Cookies:', response.headers.get('set-cookie'));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testRegistration();
