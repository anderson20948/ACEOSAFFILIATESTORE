// js/admin.js
// Lightweight initializer — all admin logic is in admin-dashboard.js
// This file exists for backwards compatibility with the legacy admin route.

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    if (!localStorage.getItem('token') || role !== 'admin') {
        if (window.showNotification) showNotification('Admin access required.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1000);
        return;
    }
    // All data loading is handled by admin-dashboard.js which is loaded together
    console.log('[admin.js] Admin authenticated, deferring to admin-dashboard.js');
});

// Legacy compatibility shim for old inline calls
async function updateStatus(productId, action) {
    return updateProductStatus(productId, action);
}
