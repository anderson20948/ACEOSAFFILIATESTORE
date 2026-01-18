// js/auth.js
// Handles authentication tasks like login, registration check, and token management.

async function handleLogin(email, password) {
    // Clear any previous error messages
    const errorElement = document.getElementById('loginError');
    if (errorElement) {
        errorElement.style.display = 'none';
    }

    // Show loading state
    const loginBtn = document.querySelector('button[type="submit"]');
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
    }

    try {
        const data = await safeFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (!data) {
            // Reset button state
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
            return;
        }

        // Store auth data
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('userId', data.id);
        localStorage.setItem('username', data.username);

        // Check for Super Admin initialization message
        if (data.message && data.message.includes('Super Admin initialized')) {
            alert(data.message);
            // Reset button state
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
            return;
        }

        // Show success message before redirect
        showNotification('Login successful! Redirecting...', 'success');

        // Small delay to show the success message
        setTimeout(() => {
            // Redirect based on role
            if (data.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard-products.html';
            }
        }, 1000);

    } catch (err) {
        // Reset button state
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
        // Error handling is done in safeFetch, but we can add additional UI feedback here
        console.error('Login failed:', err);
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

    // Enhanced password validation (client-side basic check)
    if (pass.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    if (!/[A-Z]/.test(pass) || !/[a-z]/.test(pass) || !/\d/.test(pass) || !/[!@#$%^&*(),.?":{}|<>]/.test(pass)) {
        alert('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
        return;
    }

    try {
        const data = await safeFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: name, email: email, password: pass })
        });

        if (data && data.message) {
            showNotification(data.message + ' Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html?registered=success';
            }, 1500);
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
const role = localStorage.getItem('role');
const token = localStorage.getItem('token');

if (currentPath.includes('dashboard') || currentPath.includes('admin.html')) {
    if (!token) {
        console.warn('Authentication required. Redirecting to login...');
        window.location.href = 'login.html';
    } else if (currentPath.includes('admin.html') && role !== 'admin') {
        console.warn('Admin access required. Redirecting to user dashboard...');
        window.location.href = 'dashboard-products.html';
    } else if (currentPath.includes('dashboard') && role === 'admin') {
        console.warn('Admin detected. Redirecting to admin dashboard...');
        window.location.href = 'admin.html';
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

// Notification Helper Function
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;

    // Set background color based on type
    if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#dc3545';
    } else {
        notification.style.backgroundColor = '#007bff';
    }

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-in reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Forgot Password Handler
async function handleForgotPassword(email) {
    // Clear any previous messages
    const existingMessages = document.querySelectorAll('.forgot-message');
    existingMessages.forEach(msg => msg.remove());

    // Show loading state
    const submitBtn = document.querySelector('#forgotForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
    }

    try {
        const data = await safeFetch('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        if (data) {
            showForgotMessage(data.message, data.success ? 'success' : 'error');

            // Clear the form on success
            if (data.success) {
                document.getElementById('forgotEmail').value = '';
            }
        }
    } catch (err) {
        showForgotMessage('Unable to process your request. Please try again.', 'error');
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Instructions';
        }
    }
}

// Helper function to show forgot password messages
function showForgotMessage(message, type = 'info') {
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.forgot-message');
    existingMessages.forEach(msg => msg.remove());

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `forgot-message alert alert-${type === 'success' ? 'success' : 'danger'}`;
    messageDiv.style.cssText = `
        margin-top: 20px;
        padding: 15px;
        border-radius: 5px;
        text-align: center;
        font-weight: 500;
    `;

    if (type === 'success') {
        messageDiv.style.backgroundColor = '#d4edda';
        messageDiv.style.border = '1px solid #c3e6cb';
        messageDiv.style.color = '#155724';
    } else {
        messageDiv.style.backgroundColor = '#f8d7da';
        messageDiv.style.border = '1px solid #f5c6cb';
        messageDiv.style.color = '#721c24';
    }

    messageDiv.textContent = message;

    // Insert after the form
    const form = document.getElementById('forgotForm');
    if (form) {
        form.parentNode.insertBefore(messageDiv, form.nextSibling);
    }

    // Auto-remove success messages after 10 seconds to give users time to read
    if (type === 'success') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.opacity = '0';
                setTimeout(() => messageDiv.remove(), 500);
            }
        }, 10000);
    }
}
