// Comprehensive authentication tests
async function runTests() {
    const results = [];

    // Test 1: Admin Login
    try {
        const adminLogin = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'tsumamngindodenis@gmail.com',
                password: 'Dennis123'
            })
        });
        const adminData = await adminLogin.json();
        results.push({
            test: 'Admin Login',
            status: adminLogin.ok ? 'PASS' : 'FAIL',
            code: adminLogin.status,
            role: adminData.role
        });
    } catch (e) {
        results.push({ test: 'Admin Login', status: 'ERROR', error: e.message });
    }

    // Test 2: Regular User Login
    try {
        const userLogin = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test2@example.com',
                password: 'TestPass123!'
            })
        });
        const userData = await userLogin.json();
        results.push({
            test: 'User Login',
            status: userLogin.ok ? 'PASS' : 'FAIL',
            code: userLogin.status,
            role: userData.role
        });
    } catch (e) {
        results.push({ test: 'User Login', status: 'ERROR', error: e.message });
    }

    // Test 3: Invalid Credentials
    try {
        const invalidLogin = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'WrongPassword'
            })
        });
        results.push({
            test: 'Invalid Credentials',
            status: !invalidLogin.ok ? 'PASS' : 'FAIL',
            code: invalidLogin.status
        });
    } catch (e) {
        results.push({ test: 'Invalid Credentials', status: 'ERROR', error: e.message });
    }

    // Test 4: User Registration
    try {
        const timestamp = Date.now();
        const registerRes = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `Test User ${timestamp}`,
                email: `test${timestamp}@example.com`,
                password: 'Registration123!'
            })
        });
        results.push({
            test: 'User Registration',
            status: registerRes.ok ? 'PASS' : 'FAIL',
            code: registerRes.status
        });
    } catch (e) {
        results.push({ test: 'User Registration', status: 'ERROR', error: e.message });
    }

    // Test 5: Protected Route (Missing Token)
    try {
        const protectedRes = await fetch('http://localhost:3000/api/admin', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        results.push({
            test: 'Protected Route (No Token)',
            status: !protectedRes.ok ? 'PASS' : 'FAIL',
            code: protectedRes.status
        });
    } catch (e) {
        results.push({ test: 'Protected Route (No Token)', status: 'ERROR', error: e.message });
    }

    console.log('\n========== AUTHENTICATION TEST RESULTS ==========\n');
    results.forEach(result => {
        const statusEmoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${statusEmoji} ${result.test}`);
        console.log(`   Status: ${result.status} (Code: ${result.code})`);
        if (result.role) console.log(`   Role: ${result.role}`);
        if (result.error) console.log(`   Error: ${result.error}`);
    });
    console.log('\n================================================\n');
}

runTests().then(() => process.exit(0));