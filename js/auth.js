// js/auth.js
// Handles authentication tasks like login, registration check, and token management.

async function handleLogin(email, password) {
    try {
        const data = await safeFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (!data) return;

        // Store auth data
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('userId', data.id);
        localStorage.setItem('username', data.username);

        // Check for Super Admin initialization message
        if (data.message && data.message.includes('Super Admin initialized')) {
            alert(data.message);
            return;
        }

        // Redirect based on role
        if (data.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard-products.html?login=success';
        }
    } catch (err) {
        // Errors handled in safeFetch
    }
}

async function handleRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    const confirm = document.getElementById('regConfirm').value;

    if (!name || !email || !pass) {
        alert('Please fill in all fields');
        return;
    }

    if (pass !== confirm) {
        alert('Passwords do not match');
        return;
    }

    if (pass.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    try {
        const data = await safeFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: name, email: email, password: pass })
        });

        if (data && data.message) {
            alert(data.message + '! Redirecting to login...');
            window.location.href = 'login.html?registered=success';
        }
    } catch (err) {
        console.error('Registration failed:', err);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
}

function isLoggedIn() {
    return !!localStorage.getItem('token');
}

// Global check for protected pages
const currentPath = window.location.pathname;
if (currentPath.includes('dashboard') || currentPath.includes('admin.html')) {
    if (!localStorage.getItem('token')) {
        console.warn('Authentication required. Redirecting to login...');
        window.location.href = 'login.html';
    }
}

// Wizard Navigation
function nextStep(step) {
    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
    document.getElementById('step' + step).style.display = 'block';
}

// Password Toggle logic
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-password')) {
        const input = e.target.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            e.target.classList.remove('fa-eye');
            e.target.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            e.target.classList.remove('fa-eye-slash');
            e.target.classList.add('fa-eye');
        }
    }
});

// Forgot Password Handler
async function handleForgotPassword(email) {
    try {
        const data = await safeFetch('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        if (data) {
            alert(data.message);
        }
    } catch (err) {
        // Handled in safeFetch
    }
}
