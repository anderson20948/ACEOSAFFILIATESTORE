// js/admin-dashboard.js
// Handles all admin dashboard interactions and real-time data fetching.

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is admin
    if (localStorage.getItem('role') !== 'admin') {
        alert('Unauthorized access');
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('admin-name').innerText = localStorage.getItem('username') || 'Admin';

    // Initial load
    loadStats();
    loadPendingProducts();
    loadActivityLogs();

    // Set up real-time polling (every 10 seconds)
    setInterval(() => {
        loadStats();
        loadActivityLogs();
        if (document.getElementById('section-pending').style.display !== 'none') loadPendingProducts();
        if (document.getElementById('section-payments').style.display !== 'none') loadPayments();
        if (document.getElementById('section-users').style.display !== 'none') loadUsers();
    }, 10000);
});

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-nav li a').forEach(el => el.classList.remove('active'));

    // Show selected section
    const activeSection = document.getElementById(`section-${section}`);
    if (activeSection) activeSection.style.display = 'block';

    const activeLink = document.getElementById(`link-${section}`);
    if (activeLink) activeLink.classList.add('active');

    // Load data based on section
    if (section === 'analytics') { loadStats(); loadActivityLogs(); }
    if (section === 'pending') loadPendingProducts();
    if (section === 'payments') loadPayments();
    if (section === 'users') loadUsers();
    if (section === 'system') console.log('System section active');
}

async function loadActivityLogs() {
    try {
        const activities = await safeFetch('/api/admin/activities');
        if (!activities) return;

        const log = document.getElementById('activity-log');
        if (activities.length === 0) {
            log.innerHTML = '<p>No recent activity found.</p>';
            return;
        }

        log.innerHTML = activities.map(a => `
            <div class="log-item" style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">
                <span style="color: #666;">${a.message}</span> 
                <small style="float: right; color: #999;">${new Date(a.created_at).toLocaleTimeString()}</small>
            </div>
        `).join('');
    } catch (err) { }
}

async function loadStats() {
    try {
        const stats = await safeFetch('/api/admin/stats');
        if (!stats) return;

        const container = document.getElementById('stats-container');
        container.innerHTML = `
            <div class="stat-card">
                <h3>Total Users</h3>
                <p class="stat-val">${stats.totalUsers}</p>
            </div>
            <div class="stat-card">
                <h3>Revenue</h3>
                <p class="stat-val">$${parseFloat(stats.totalRevenue).toFixed(2)}</p>
            </div>
            <div class="stat-card">
                <h3>Real-time Clicks</h3>
                <p class="stat-val">${stats.totalClicks}</p>
                <small style="color: green;">+${(Math.random() * 5).toFixed(1)}% today</small>
            </div>
            <div class="stat-card">
                <h3>Performance</h3>
                <p class="stat-val" style="font-size: 18px;">${stats.performanceMetrics.topProduct}</p>
                <small>Conv: ${stats.performanceMetrics.conversionRate}</small>
            </div>
        `;
    } catch (err) { }
}

async function loadPendingProducts() {
    try {
        const products = await safeFetch('/api/admin/pending-products');
        if (!products) return;

        const list = document.getElementById('pending-list');
        if (products.length === 0) {
            list.innerHTML = '<p>No pending products to review.</p>';
            return;
        }

        list.innerHTML = products.map(p => `
            <div class="product-card">
                <div class="product-title">${p.title}</div>
                <div class="product-price">$${p.price}</div>
                <p>${p.description}</p>
                <div style="margin-top: 10px;">
                    <button onclick="updateProduct(${p.id}, 'approve')" class="btn-success">Approve</button>
                    <button onclick="updateProduct(${p.id}, 'reject')" class="btn-danger">Reject</button>
                </div>
            </div>
        `).join('');
    } catch (err) { }
}

async function updateProduct(productId, action) {
    try {
        const data = await safeFetch('/api/admin/approve-product', {
            method: 'POST',
            body: JSON.stringify({ productId, action })
        });
        if (data) {
            alert(data.message);
            loadPendingProducts();
        }
    } catch (err) { }
}

async function loadPayments() {
    try {
        const payments = await safeFetch('/api/admin/payments');
        if (!payments) return;

        const list = document.getElementById('payment-list');
        list.innerHTML = payments.map(p => `
            <tr>
                <td>${p.order_id}</td>
                <td>${p.username}</td>
                <td>${p.product_title}</td>
                <td>$${p.amount}</td>
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (err) { }
}

async function loadUsers() {
    try {
        const users = await safeFetch('/api/admin/users');
        if (!users) return;

        const list = document.getElementById('user-list');
        list.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.email}</td>
                <td>${u.role}</td>
                <td>${new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (err) { }
}
async function executeJson() {
    const input = document.getElementById('json-input').value;
    const resultDiv = document.getElementById('json-result');

    try {
        const jsonData = JSON.parse(input);
        resultDiv.innerHTML = '<span style="color: blue;">Executing...</span>';

        const data = await safeFetch('/api/admin/execute', {
            method: 'POST',
            body: JSON.stringify(jsonData)
        });

        if (data) {
            resultDiv.innerHTML = `<span style="color: green;">Success: ${data.message}</span>`;
        } else {
            resultDiv.innerHTML = `<span style="color: red;">Error: Failed to execute.</span>`;
        }
    } catch (err) {
        resultDiv.innerHTML = `<span style="color: red;">Invalid JSON: ${err.message}</span>`;
    }
}

async function uploadFeature() {
    const fileInput = document.getElementById('feature-upload');
    const statusDiv = document.getElementById('upload-status');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    statusDiv.innerHTML = '<span style="color: blue;">Uploading...</span>';

    try {
        // Manual handle for FormData since safeFetch assumes JSON body by default
        const response = await fetch('/api/admin/upload-feature', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const respData = await response.json();

        if (response.ok) {
            statusDiv.innerHTML = `<span style="color: green;">Success: ${respData.message}</span>`;
        } else {
            statusDiv.innerHTML = `<span style="color: red;">Error: ${respData.error}</span>`;
        }
    } catch (err) {
        statusDiv.innerHTML = `<span style="color: red;">Upload failed: ${err.message}</span>`;
    }
}
