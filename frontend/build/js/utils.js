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

    // Check if body is FormData (for file uploads)
    const isFormData = options.body instanceof FormData;

    const defaultHeaders = {
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    // Only add JSON content type if not FormData
    if (!isFormData) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, config);
        const contentType = response.headers.get('Content-Type');
        let data;

        // Safely parse JSON or handle as text/error
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            // If it starts with <!, it's likely an HTML error/login page
            if (text.trim().startsWith('<!')) {
                throw new Error(`Server returned HTML instead of JSON (Status: ${response.status}). Session may be expired.`);
            }
            data = { message: text };
        }

        if (!response.ok) {
            const errorMsg = data.error || data.message || `Request failed (${response.status})`;
            // Only auto-logout on 401 if this is NOT a login/register request
            if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
                console.warn('Session expired or unauthorized. Redirecting to login...');
                logout();
                return null;
            }
            throw new Error(errorMsg);
        }

        return data;
    } catch (err) {
        console.error(`API Error (${url}):`, err.message);
        // Special case for syntax errors which usually mean HTML was returned
        if (err instanceof SyntaxError) {
          showToast('The server returned an invalid response. Please try logging in again.', 'error');
        } else if (typeof showToast === 'function') {
            if (err.message === 'Failed to fetch') {
                showToast('Cannot connect to the server. Please ensure the backend is running.', 'error');
            } else {
                showToast(err.message, 'error');
            }
        }
        throw err;
    }
}
/**
 * Displays a non-intrusive toast notification.
 * Auto-creates the container if it doesn't exist.
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(container);

        // Inject Styles if not already in a stylesheet
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    background: #333; color: #fff; padding: 12px 20px; border-radius: 4px;
                    margin-bottom: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    display: flex; align-items: center; gap: 10px; min-width: 250px;
                    transition: all 0.3s ease; animation: slideIn 0.3s ease-out;
                }
                .toast.success { background: #28a745; }
                .toast.error { background: #dc3545; }
                .toast.warning { background: #ffc107; color: #333; }
                .toast.info { background: #17a2b8; }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `;
            document.head.appendChild(style);
        }
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'warning' : 'info-circle';
    toast.innerHTML = `
        <i class="fa fa-${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

/**
 * Common loading state manager for buttons/containers.
 */
function setLoading(isLoading, elementId, loadingText = 'Processing...') {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (isLoading) {
        el.dataset.originalHtml = el.innerHTML;
        el.disabled = true;
        el.innerHTML = `<i class="fa fa-spinner fa-spin"></i> ${loadingText}`;
    } else {
        if (el.dataset.originalHtml) {
            el.innerHTML = el.dataset.originalHtml;
            delete el.dataset.originalHtml;
        }
        el.disabled = false;
    }
}
