// js/utils.js
// Common utility functions for the Aceos Affiliate system.

function isLoggedIn() {
    return !!localStorage.getItem('token');
}

function getToken() {
    return localStorage.getItem('token');
}

function getUserId() {
    return localStorage.getItem('userId');
}

function getUsername() {
    return localStorage.getItem('username');
}

function getUserRole() {
    return localStorage.getItem('role');
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Redirect if not logged in
function checkAuth() {
    if (!isLoggedIn()) {
        const currentPath = window.location.pathname;
        if (currentPath.includes('dashboard') || currentPath.includes('admin.html')) {
            window.location.href = 'login.html';
        }
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

// Initializers and Global Checks
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && isLoggedIn()) {
        userDisplay.innerText = getUsername() || 'User';
    }
});

/**
 * Centralized fetch utility to handle base URLs, authorization headers, and common errors.
 */
async function safeFetch(url, options = {}) {
    const token = getToken();

    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            const errorMsg = data.error || data.message || `Request failed (${response.status})`;
            // Only auto-logout on 401 if this is NOT a login/register request
            if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
                console.warn('Session expired. Redirecting to login...');
                logout();
                return null;
            }
            throw new Error(errorMsg);
        }

        return data;
    } catch (err) {
        console.error(`API Error (${url}):`, err.message);
        // Show in-page notification instead of a blocking alert
        if (typeof showNotification === 'function') {
            if (err.message === 'Failed to fetch') {
                showNotification('Cannot connect to the server. Please ensure the backend is running.', 'error');
            } else {
                showNotification(err.message, 'error');
            }
        }
        throw err;
    }
}
/**
 * Displays a non-intrusive toast notification.
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        // Fallback to alert if container doesn't exist
        alert(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
