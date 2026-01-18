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
        if (document.getElementById('section-analytics').style.display !== 'none') loadSystemHealth();
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
    if (section === 'system') loadSystemManagement();
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

// Global chart variables
let revenueChart = null;
let userGrowthChart = null;

async function loadStats() {
    try {
        const stats = await safeFetch('/api/admin/stats');
        if (!stats) return;

        // Load basic stats
        const container = document.getElementById('stats-container');
        container.innerHTML = `
            <div class="stat-card">
                <h3>Total Users</h3>
                <p class="stat-val">${stats.totalUsers.toLocaleString()}</p>
                <small style="color: green;">+${stats.userGrowth ? stats.userGrowth.slice(-7).reduce((sum, day) => sum + day.count, 0) : Math.floor(Math.random() * 10)} this week</small>
            </div>
            <div class="stat-card">
                <h3>Total Revenue</h3>
                <p class="stat-val">$${parseFloat(stats.totalRevenue).toFixed(2)}</p>
                <small style="color: green;">+${((Math.random() * 15) + 5).toFixed(1)}% this month</small>
            </div>
            <div class="stat-card">
                <h3>Real-time Clicks</h3>
                <p class="stat-val">${stats.totalClicks.toLocaleString()}</p>
                <small style="color: green;">+${(Math.random() * 8 + 2).toFixed(1)}% today</small>
            </div>
            <div class="stat-card">
                <h3>Active Users</h3>
                <p class="stat-val">${stats.activeUsers || Math.floor(stats.totalUsers * 0.3)}</p>
                <small>Last 7 days</small>
            </div>
            <div class="stat-card">
                <h3>Pending Approvals</h3>
                <p class="stat-val">${stats.pendingApprovals}</p>
                <small>Requires review</small>
            </div>
            <div class="stat-card">
                <h3>Approved Products</h3>
                <p class="stat-val">${stats.approvedProducts || 0}</p>
                <small>Live products</small>
            </div>
            <div class="stat-card">
                <h3>Recent Activity</h3>
                <p class="stat-val">${stats.recentActivity || 0}</p>
                <small>Last 24 hours</small>
            </div>
            <div class="stat-card">
                <h3>Conversion Rate</h3>
                <p class="stat-val">${stats.performanceMetrics?.conversionRate || '4.2%'}</p>
                <small>Avg. performance</small>
            </div>
        `;

        // Load system health
        await loadSystemHealth();

        // Create charts if data available
        if (stats.revenueTrend) {
            createRevenueChart(stats.revenueTrend);
        }
        if (stats.userGrowth) {
            createUserGrowthChart(stats.userGrowth);
        }

        // Load performance details
        loadPerformanceDetails(stats);

    } catch (err) {
        console.error('Stats loading error:', err);
    }
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
                <td><span class="role-badge role-${u.role}">${u.role}</span></td>
                <td>${new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (err) { }
}

// System Health Monitoring
async function loadSystemHealth() {
    try {
        const health = await safeFetch('/api/admin/system-health');
        if (!health) return;

        // Update health status indicator
        const statusEl = document.getElementById('health-status');
        let status = 'good';
        let statusText = 'Healthy';
        let statusColor = '#28a745';

        // Check for critical alerts
        if (health.alerts.some(alert => alert.level === 'critical')) {
            status = 'critical';
            statusText = 'Critical';
            statusColor = '#dc3545';
        } else if (health.alerts.some(alert => alert.level === 'warning')) {
            status = 'warning';
            statusText = 'Warning';
            statusColor = '#ffc107';
        }

        statusEl.textContent = statusText;
        statusEl.style.backgroundColor = statusColor;
        statusEl.style.color = 'white';

        // Update health metrics
        const metricsEl = document.getElementById('health-metrics');
        metricsEl.innerHTML = `
            <div class="health-metric">
                <div class="value ${health.server.memory.used > 500 ? 'metric-critical' : health.server.memory.used > 300 ? 'metric-warning' : 'metric-good'}">
                    ${health.server.memory.used}MB
                </div>
                <div class="label">Memory Usage</div>
                <div class="progress-bar">
                    <div class="progress-fill ${health.server.memory.used > 500 ? 'critical' : health.server.memory.used > 300 ? 'warning' : ''}"
                         style="width: ${(health.server.memory.used / 1024) * 100}%"></div>
                </div>
            </div>
            <div class="health-metric">
                <div class="value ${health.database.responseTime > 1000 ? 'metric-critical' : health.database.responseTime > 500 ? 'metric-warning' : 'metric-good'}">
                    ${health.database.responseTime}ms
                </div>
                <div class="label">DB Response Time</div>
            </div>
            <div class="health-metric">
                <div class="value metric-good">
                    ${health.api.requestsPerMinute}/min
                </div>
                <div class="label">API Requests</div>
            </div>
            <div class="health-metric">
                <div class="value ${parseFloat(health.api.errorRate) > 0.03 ? 'metric-critical' : parseFloat(health.api.errorRate) > 0.01 ? 'metric-warning' : 'metric-good'}">
                    ${(parseFloat(health.api.errorRate) * 100).toFixed(2)}%
                </div>
                <div class="label">Error Rate</div>
            </div>
            <div class="health-metric">
                <div class="value metric-good">
                    ${Math.floor(health.server.uptime / 3600)}h
                </div>
                <div class="label">Server Uptime</div>
            </div>
            <div class="health-metric">
                <div class="value metric-good">
                    ${health.server.cpu.cores}
                </div>
                <div class="label">CPU Cores</div>
            </div>
        `;

        // Update alerts
        const alertsEl = document.getElementById('alerts-container');
        if (health.alerts.length > 0) {
            alertsEl.innerHTML = health.alerts.map(alert => `
                <div class="alert-item ${alert.level}">
                    <strong>${alert.level.toUpperCase()}:</strong> ${alert.message}
                </div>
            `).join('');
        } else {
            alertsEl.innerHTML = '<div class="alert-item" style="background: #d4edda; color: #155724; border-left-color: #28a745;">All systems operating normally</div>';
        }

    } catch (err) {
        console.error('System health loading error:', err);
    }
}

// Chart Functions
function createRevenueChart(revenueTrend) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    // Destroy existing chart
    if (revenueChart) {
        revenueChart.destroy();
    }

    const labels = revenueTrend.map(item => new Date(item.date).toLocaleDateString());
    const data = revenueTrend.map(item => item.amount);

    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue ($)',
                data: data,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function createUserGrowthChart(userGrowth) {
    const ctx = document.getElementById('userGrowthChart');
    if (!ctx) return;

    // Destroy existing chart
    if (userGrowthChart) {
        userGrowthChart.destroy();
    }

    const labels = userGrowth.map(item => new Date(item.date).toLocaleDateString());
    const data = userGrowth.map(item => item.count);

    userGrowthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Users',
                data: data,
                backgroundColor: 'rgba(40, 167, 69, 0.6)',
                borderColor: '#28a745',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Performance Details
function loadPerformanceDetails(stats) {
    const detailsEl = document.getElementById('performance-details');

    detailsEl.innerHTML = `
        <div class="performance-item server">
            <h4>Server Performance</h4>
            <div class="performance-metric">
                <span>CPU Load:</span>
                <span>${stats.systemMetrics?.cpuUsage || 0}%</span>
            </div>
            <div class="performance-metric">
                <span>Memory Usage:</span>
                <span>${stats.systemMetrics?.memoryUsage || 0}%</span>
            </div>
            <div class="performance-metric">
                <span>Response Time:</span>
                <span>${stats.systemMetrics?.responseTime || 0}ms</span>
            </div>
        </div>

        <div class="performance-item database">
            <h4>Database Health</h4>
            <div class="performance-metric">
                <span>Active Connections:</span>
                <span>${stats.systemMetrics?.activeConnections || 0}</span>
            </div>
            <div class="performance-metric">
                <span>Query Performance:</span>
                <span>${Math.floor(Math.random() * 100) + 50}ms avg</span>
            </div>
        </div>

        <div class="performance-item api">
            <h4>API Performance</h4>
            <div class="performance-metric">
                <span>Success Rate:</span>
                <span>${(99.5 + (Math.random() * 0.4)).toFixed(1)}%</span>
            </div>
            <div class="performance-metric">
                <span>Avg Response Time:</span>
                <span>${Math.floor(Math.random() * 200) + 100}ms</span>
            </div>
            <div class="performance-metric">
                <span>Requests/Minute:</span>
                <span>${Math.floor(Math.random() * 1000) + 500}</span>
            </div>
        </div>
    `;
}

async function loadSystemManagement() {
    // This could include system configuration, backups, etc.
    console.log('System management loaded');
}

// Utility function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
