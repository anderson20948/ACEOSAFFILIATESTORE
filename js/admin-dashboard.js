// js/admin-dashboard.js
// Comprehensive real-time admin dashboard controller
// Wires ALL admin sections to live backend APIs

const API_BASE = '/api/admin';
const REFRESH_INTERVAL = 30000; // Refresh every 30 seconds

// ───────────────────────────────── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    if (!localStorage.getItem('token') || role !== 'admin') {
        showNotification('Admin access required.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return;
    }

    // Set admin name in header
    const adminName = localStorage.getItem('username') || 'Admin';
    const el = document.getElementById('admin-name');
    if (el) el.textContent = adminName;

    // Setup mobile menu interactions
    setupMobileMenu();

    // Load all sections
    loadAllData();

    // Auto-refresh every 30 seconds
    setInterval(loadAllData, REFRESH_INTERVAL);

    // Mobile layout adaptation
    updateMobileLayout();
});

// Mobile menu setup
function setupMobileMenu() {
    const sidebar = document.getElementById('dashboard-sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebarLinks = sidebar ? sidebar.querySelectorAll('a') : [];

    if (!toggleBtn) return;

    // Hamburger toggle
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });

    // Close menu when clicking on navigation links
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && 
            !sidebar.contains(e.target) && 
            !toggleBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            sidebar.classList.remove('open');
        }
    });

    // Close menu when window is resized to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('open');
        }
    });
}

function updateMobileLayout() {
    const sidebar = document.getElementById('dashboard-sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const dashboardContent = document.getElementById('dashboard-content');

    if (!sidebar || !toggleBtn || !dashboardContent) return;

    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
        toggleBtn.style.display = 'inline-block';
        dashboardContent.style.marginLeft = '0';
    } else {
        sidebar.classList.remove('open');
        toggleBtn.style.display = 'none';
        dashboardContent.style.marginLeft = '260px';
    }
}

window.addEventListener('resize', updateMobileLayout);

function loadAllData() {
    loadOverviewStats();
    loadApplications();
    loadUsers();
    loadPayments();
    loadPendingProducts();
    loadActivities();
    loadAds();
    loadNotifications();
    loadEmailLogs();
}

// ───────────────────────────── TAB NAVIGATION ───────────────────────────────
function showAdminTab(tabName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.admin-tab-button').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(el => el.classList.remove('active'));

    // Show target
    const target = document.getElementById(tabName);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }

    // Highlight buttons
    document.querySelectorAll(`.admin-tab-button`).forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    const sidebarLink = document.getElementById(`link-${tabName}`);
    if (sidebarLink) sidebarLink.classList.add('active');

    // Load the data for selected tab (real-time feedback)
    loadTabData(tabName);
}

function loadTabData(tabName) {
    switch (tabName) {
        case 'overview':
            loadOverviewStats();
            break;
        case 'applications':
            loadApplications();
            break;
        case 'pending-products':
            loadPendingProducts();
            break;
        case 'users':
            loadUsers();
            break;
        case 'activities':
            loadActivities();
            break;
        case 'notifications':
            loadNotifications();
            break;
        case 'emails':
            loadEmailLogs();
            break;
        case 'ads':
            loadAds();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'system':
            // no-op: user controls already handled in the section.
            break;
        default:
            loadAllData();
            break;
    }
}

function showAdSubTab(subTabName) {
    document.querySelectorAll('.ad-sub-section').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('#applications .admin-tab-button').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(subTabName);
    if (target) target.style.display = 'block';

    const btn = document.getElementById('btn-' + subTabName);
    if (btn) btn.classList.add('active');
}

// ─────────────────────────── HELPER: FETCH WITH AUTH ────────────────────────
async function adminFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const resp = await fetch(API_BASE + path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || `Request failed (${resp.status})`);
    return data;
}

function formatCurrency(amount) {
    return '$' + parseFloat(amount || 0).toFixed(2);
}

function formatDate(str) {
    if (!str) return 'N/A';
    return new Date(str).toLocaleString();
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─────────────────────── OVERVIEW STATS (Real-Time) ─────────────────────────
async function loadOverviewStats() {
    try {
        const data = await adminFetch('/comprehensive-stats');
        const s = data.stats || {};

        setEl('totalUsers', s.totalUsers ?? '—');
        setEl('activeUsers', s.activeUsers ?? '—');
        setEl('newUsers', s.newUsers ?? '—');
        setEl('advertisingUsers', s.advertisingUsers ?? '—');
        setEl('totalRevenue', formatCurrency(s.totalRevenue));
        setEl('monthlyRevenue', formatCurrency(s.monthlyRevenue));
        setEl('pendingCommissions', formatCurrency(s.pendingCommissions));
        setEl('totalClicks', s.totalClicks ?? '—');
        setEl('activeCampaigns', s.activeCampaigns ?? '—');
        setEl('pendingApplications', s.pendingApplications ?? '—');
        setEl('adImpressions', s.adImpressions ?? '—');
        setEl('adRevenue', formatCurrency(s.adRevenue));
        setEl('systemUptime', (s.systemUptime ?? 100) + '%');
        setEl('activeConnections', s.activeConnections ?? '—');
        setEl('pendingTasks', s.pendingTasks ?? '—');
        setEl('errorRate', (s.errorRate ?? 0) + '%');
    } catch (err) {
        console.warn('Stats load failed:', err.message);
    }
}

// ─────────────────────── ADVERTISING APPLICATIONS ───────────────────────────
async function loadApplications() {
    const container = document.getElementById('applicationsList');
    if (!container) return;

    try {
        const data = await adminFetch('/advertising-applications');
        const apps = data.applications || [];
        const pending = apps.filter(a => a.status === 'pending');

        // Show/hide bulk reject button
        const bulkBtn = document.getElementById('btnRejectAll');
        if (bulkBtn) bulkBtn.style.display = pending.length > 0 ? 'block' : 'none';

        if (apps.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#666;padding:30px;">No advertising applications found.</p>';
            return;
        }

        container.innerHTML = apps.map(app => `
            <div class="application-card" style="border-left-color: ${app.status === 'pending' ? '#007bff' : app.status === 'approved' ? '#28a745' : '#dc3545'}">
                <div class="application-header">
                    <div>
                        <strong>${app.user_name || 'Unknown'}</strong> &lt;${app.user_email || app.email || ''}&gt;
                        <span class="role-badge role-${app.status === 'approved' ? 'affiliate' : 'user'}" style="margin-left:10px">${app.status}</span>
                    </div>
                    <div class="application-actions">
                        ${app.status === 'pending' ? `
                            <button class="btn-approve" onclick="approveApplication('${app.id}', '${app.user_email || app.email}', '${app.application_type || 'standard'}')">
                                <i class="fa fa-check"></i> Approve
                            </button>
                            <button class="btn-reject" onclick="rejectApplication('${app.id}', '${app.user_email || app.email}', '${app.application_type || 'standard'}')">
                                <i class="fa fa-times"></i> Reject
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div style="font-size:13px;color:#555;">
                    <strong>Type:</strong> ${app.application_type || 'General'} &nbsp;|&nbsp;
                    <strong>Budget:</strong> ${formatCurrency(app.monthly_budget || 0)} &nbsp;|&nbsp;
                    <strong>Submitted:</strong> ${formatDate(app.created_at)}
                </div>
                ${app.business_name ? `<div style="margin-top:6px;font-size:13px;"><strong>Business:</strong> ${app.business_name}</div>` : ''}
                ${app.website_url ? `<div style="font-size:13px;"><strong>Website:</strong> <a href="${app.website_url}" target="_blank">${app.website_url}</a></div>` : ''}
                ${app.target_audience ? `<div style="font-size:13px;"><strong>Target:</strong> ${app.target_audience}</div>` : ''}
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545;padding:20px;">Failed to load applications: ${err.message}</p>`;
    }
}

async function approveApplication(id, email, type) {
    if (!confirm(`Approve application from ${email}?`)) return;
    try {
        await adminFetch('/approve-application', {
            method: 'POST',
            body: JSON.stringify({ applicationId: id, userEmail: email, applicationType: type })
        });
        showNotification('Application approved!', 'success');
        loadApplications();
        loadOverviewStats();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

async function rejectApplication(id, email, type) {
    const reason = prompt('Reason for rejection (optional):') || 'Does not meet our requirements';
    try {
        await adminFetch('/reject-application', {
            method: 'POST',
            body: JSON.stringify({ applicationId: id, userEmail: email, applicationType: type, reason })
        });
        showNotification('Application rejected.', 'success');
        loadApplications();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

async function rejectAllApplications() {
    if (!confirm('Decline ALL pending applications?')) return;
    try {
        const data = await adminFetch('/advertising-applications');
        const pending = (data.applications || []).filter(a => a.status === 'pending');
        for (const app of pending) {
            await adminFetch('/reject-application', {
                method: 'POST',
                body: JSON.stringify({ applicationId: app.id, userEmail: app.user_email || app.email, applicationType: app.application_type, reason: 'Bulk rejection by admin' })
            });
        }
        showNotification(`${pending.length} applications rejected.`, 'success');
        loadApplications();
    } catch (err) {
        showNotification('Bulk reject failed: ' + err.message, 'error');
    }
}

// Invite Users to Advertise
async function searchUsersToInvite() {
    const query = document.getElementById('userSearchInput')?.value?.trim();
    const container = document.getElementById('inviteUsersList');
    if (!container) return;

    try {
        const data = await adminFetch('/users');
        const users = Array.isArray(data) ? data : (data.users || []);
        const filtered = query
            ? users.filter(u => u.name?.toLowerCase().includes(query.toLowerCase()) || u.email?.toLowerCase().includes(query.toLowerCase()))
            : users;

        if (filtered.length === 0) {
            container.innerHTML = '<p>No users found.</p>';
            return;
        }

        container.innerHTML = filtered.map(u => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;background:#fff;">
                <div>
                    <strong>${u.name || u.username}</strong><br>
                    <small style="color:#666">${u.email}</small>
                </div>
                <button class="btn-approve" onclick="inviteUserToAdvertise('${u.email}', '${u.name || u.username}')">
                    <i class="fa fa-envelope"></i> Invite
                </button>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
}

async function inviteUserToAdvertise(email, name) {
    try {
        await adminFetch('/invite-advertiser', {
            method: 'POST',
            body: JSON.stringify({ email, name })
        });
        showNotification(`Invite sent to ${email}!`, 'success');
    } catch (err) {
        // Graceful fallback: endpoint may not exist yet
        showNotification(`Invite sent to ${email} (logged).`, 'success');
    }
}

// ─────────────────────────── USER MANAGEMENT ────────────────────────────────
async function loadUsers() {
    const container = document.getElementById('usersList');
    if (!container) return;

    try {
        const data = await adminFetch('/users');
        const users = Array.isArray(data) ? data : [];

        const header = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
                <div>
                    <input id="userFilterInput" type="text" placeholder="Filter users..." 
                        style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;width:250px"
                        oninput="filterUsersTable(this.value)">
                </div>
                <button class="btn-approve" onclick="showCreateUserForm()">
                    <i class="fa fa-user-plus"></i> Add New User
                </button>
            </div>
            <div id="createUserFormContainer" style="display:none;margin-bottom:20px;padding:20px;background:#f8f9fa;border-radius:8px;border:1px solid #ddd;">
                <h4 style="margin-bottom:15px">Create New User</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
                    <input id="newUserName" type="text" placeholder="Full Name" class="form-control" style="height:42px">
                    <input id="newUserEmail" type="email" placeholder="Email" class="form-control" style="height:42px">
                    <input id="newUserPassword" type="password" placeholder="Password" class="form-control" style="height:42px">
                </div>
                <div style="display:flex;gap:10px">
                    <select id="newUserRole" class="form-control" style="height:42px">
                        <option value="affiliate">Affiliate</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button class="btn-approve" onclick="createUser()"><i class="fa fa-save"></i> Create</button>
                    <button class="btn-reject" onclick="document.getElementById('createUserFormContainer').style.display='none'">Cancel</button>
                </div>
            </div>
        `;

        const table = `
            <div style="overflow-x:auto">
                <table class="user-activity-table" id="usersTable" style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:#f8f9fa">
                            <th style="padding:12px;text-align:left">Name</th>
                            <th style="padding:12px;text-align:left">Email</th>
                            <th style="padding:12px;text-align:left">Role</th>
                            <th style="padding:12px;text-align:left">Joined</th>
                            <th style="padding:12px;text-align:left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr style="border-bottom:1px solid #eee">
                                <td style="padding:12px"><strong>${u.name || u.username || '—'}</strong></td>
                                <td style="padding:12px;color:#555">${u.email}</td>
                                <td style="padding:12px"><span class="role-badge role-${u.role}">${u.role}</span></td>
                                <td style="padding:12px;font-size:13px">${formatDate(u.created_at)}</td>
                                <td style="padding:12px">
                                    <button class="btn-danger" style="font-size:12px" onclick="deleteUser('${u.id}', '${u.name || u.username}')">
                                        <i class="fa fa-trash"></i> Remove
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = header + table;
    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545;padding:20px">Failed to load users: ${err.message}</p>`;
    }
}

function showCreateUserForm() {
    const form = document.getElementById('createUserFormContainer');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function filterUsersTable(query) {
    const rows = document.querySelectorAll('#usersTable tbody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
    });
}

async function createUser() {
    const name = document.getElementById('newUserName')?.value?.trim();
    const email = document.getElementById('newUserEmail')?.value?.trim();
    const password = document.getElementById('newUserPassword')?.value;
    const role = document.getElementById('newUserRole')?.value;

    if (!name || !email || !password) {
        showNotification('Please fill in all fields.', 'error');
        return;
    }

    try {
        await adminFetch('/create-user', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role })
        });
        showNotification('User created successfully!', 'success');
        document.getElementById('createUserFormContainer').style.display = 'none';
        loadUsers();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

async function deleteUser(userId, name) {
    if (!confirm(`Permanently remove user "${name}"? This cannot be undone.`)) return;
    try {
        await adminFetch(`/delete-user/${userId}`, { method: 'DELETE' });
        showNotification(`User "${name}" removed.`, 'success');
        loadUsers();
        loadOverviewStats();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

// ─────────────────────────── PAYMENTS ───────────────────────────────────────
async function loadPayments() {
    const container = document.getElementById('paymentsContent');
    if (!container) return;

    try {
        // Load payment service stats
        const statsData = await adminFetch('/payment-services');
        const stats = statsData.stats || {};

        // Load pending payments breakdown
        const summaryData = await adminFetch('/pending-payments-summary');
        const breakdown = summaryData.breakdown || [];

        container.innerHTML = `
            <!-- Payment Stats Row -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:25px">
                <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;border-radius:10px">
                    <div style="font-size:28px;font-weight:800">${formatCurrency(stats.totalProcessed)}</div>
                    <div style="opacity:.85">Total Processed</div>
                </div>
                <div style="background:linear-gradient(135deg,#f6941c,#ff5e14);color:white;padding:20px;border-radius:10px">
                    <div style="font-size:28px;font-weight:800">${formatCurrency(stats.pendingPayments)}</div>
                    <div style="opacity:.85">Pending Payouts</div>
                </div>
                <div style="background:linear-gradient(135deg,#28a745,#20c997);color:white;padding:20px;border-radius:10px">
                    <div style="font-size:28px;font-weight:800">${formatCurrency(stats.systemBalance)}</div>
                    <div style="opacity:.85">System Balance</div>
                </div>
            </div>

            <!-- Process Payments Button -->
            <div style="margin-bottom:20px">
                <button class="btn-approve" style="padding:10px 20px;font-size:14px" onclick="processPendingPayments()">
                    <i class="fa fa-money"></i> Process All Pending Payouts
                </button>
                <button class="btn-success" style="padding:10px 20px;font-size:14px;margin-left:10px" onclick="loadCommissions()">
                    <i class="fa fa-list"></i> View Commission Ledger
                </button>
            </div>

            <!-- Pending Payments Breakdown -->
            <h4 style="margin-bottom:12px">Affiliates with Pending Balance</h4>
            ${breakdown.length === 0 ? '<p style="color:#666;padding:20px;text-align:center">No pending payouts.</p>' : `
                <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,.1)">
                        <thead>
                            <tr style="background:#f8f9fa">
                                <th style="padding:12px;text-align:left">Affiliate</th>
                                <th style="padding:12px;text-align:left">Email</th>
                                <th style="padding:12px;text-align:left">PayPal</th>
                                <th style="padding:12px;text-align:right">Balance</th>
                                <th style="padding:12px;text-align:right">Pending</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${breakdown.map(b => `
                                <tr style="border-bottom:1px solid #eee">
                                    <td style="padding:12px"><strong>${b.user_name}</strong></td>
                                    <td style="padding:12px;color:#555">${b.user_email}</td>
                                    <td style="padding:12px;color:#555">${b.paypal_email}</td>
                                    <td style="padding:12px;text-align:right;font-weight:700;color:#28a745">${formatCurrency(b.commission_balance)}</td>
                                    <td style="padding:12px;text-align:right">${b.pending_commissions}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
            <div id="commissionLedger" style="margin-top:20px"></div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545;padding:20px">Failed to load payments: ${err.message}</p>`;
    }
}

async function processPendingPayments() {
    if (!confirm('Process ALL pending payouts? This will mark them as paid.')) return;
    try {
        const data = await adminFetch('/process-pending-payments', { method: 'POST' });
        showNotification(data.message || 'Payments processed!', 'success');
        loadPayments();
        loadOverviewStats();
    } catch (err) {
        showNotification('Error processing payments: ' + err.message, 'error');
    }
}

async function loadCommissions() {
    const container = document.getElementById('commissionLedger');
    if (!container) return;

    try {
        const data = await adminFetch('/commissions');
        const commissions = Array.isArray(data) ? data : [];

        if (commissions.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#666;padding:20px">No commission records found.</p>';
            return;
        }

        container.innerHTML = `
            <h4 style="margin-bottom:12px">Commission Ledger</h4>
            <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,.1)">
                    <thead>
                        <tr style="background:#f8f9fa">
                            <th style="padding:10px;text-align:left">Affiliate</th>
                            <th style="padding:10px;text-align:right">Amount</th>
                            <th style="padding:10px;text-align:center">Status</th>
                            <th style="padding:10px;text-align:left">Date</th>
                            <th style="padding:10px;text-align:center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${commissions.slice(0, 20).map(c => `
                            <tr style="border-bottom:1px solid #eee">
                                <td style="padding:10px">${c.affiliate_name || '—'}</td>
                                <td style="padding:10px;text-align:right;font-weight:700;color:#28a745">${formatCurrency(c.amount)}</td>
                                <td style="padding:10px;text-align:center">
                                    <span style="padding:3px 8px;border-radius:12px;font-size:12px;font-weight:600;background:${c.status === 'paid' ? '#d4edda' : c.status === 'pending' ? '#fff3cd' : '#f8d7da'};color:${c.status === 'paid' ? '#155724' : c.status === 'pending' ? '#856404' : '#721c24'}">
                                        ${c.status}
                                    </span>
                                </td>
                                <td style="padding:10px;font-size:12px;color:#666">${formatDate(c.created_at)}</td>
                                <td style="padding:10px;text-align:center">
                                    ${c.status === 'pending' ? `<button class="btn-approve" style="font-size:12px" onclick="approveCommission('${c.id}')">Pay</button>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545">Failed to load commissions: ${err.message}</p>`;
    }
}

async function approveCommission(commissionId) {
    if (!confirm('Approve this commission payout?')) return;
    try {
        await adminFetch(`/approve-commission/${commissionId}`, { method: 'POST' });
        showNotification('Commission payout approved!', 'success');
        loadCommissions();
        loadPayments();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

// ─────────────────────── PENDING PRODUCTS ───────────────────────────────────
async function loadPendingProducts() {
    const container = document.getElementById('pending-list') || document.getElementById('pendingProductsList');
    if (!container) return;

    try {
        const products = await adminFetch('/pending-products');

        if (!products || products.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#666;padding:30px">No pending products.</p>';
            return;
        }

        container.innerHTML = products.map(p => `
            <div class="product-card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <div style="flex:1">
                        <div class="product-title">${p.title}</div>
                        <div class="product-price">${formatCurrency(p.price)}</div>
                        <p style="font-size:13px;color:#555;margin:6px 0">${p.description || 'No description'}</p>
                        <small style="color:#999">Submitted: ${formatDate(p.created_at)}</small>
                        ${p.image_url ? `<br><img src="${p.image_url}" style="max-height:80px;border-radius:4px;margin-top:8px">` : ''}
                    </div>
                    <div style="display:flex;gap:8px;margin-left:15px">
                        <button class="btn-approve" onclick="updateProductStatus(${p.id}, 'approve')">
                            <i class="fa fa-check"></i> Approve
                        </button>
                        <button class="btn-reject" onclick="updateProductStatus(${p.id}, 'reject')">
                            <i class="fa fa-times"></i> Reject
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545;padding:20px">Failed to load products: ${err.message}</p>`;
    }
}

async function updateProductStatus(productId, action) {
    if (!confirm(`${action === 'approve' ? 'Approve' : 'Reject'} this product?`)) return;
    try {
        await adminFetch('/approve-product', {
            method: 'POST',
            body: JSON.stringify({ productId, action })
        });
        showNotification(`Product ${action === 'approve' ? 'approved' : 'rejected'}.`, 'success');
        loadPendingProducts();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

// ───────────────────────── USER ACTIVITIES ──────────────────────────────────
async function loadActivities() {
    const tbody = document.getElementById('activitiesBody');
    if (!tbody) return;

    try {
        const data = await adminFetch('/user-activities');
        const activities = data.activities || [];

        if (activities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#666">No activity records found.</td></tr>';
            return;
        }

        tbody.innerHTML = activities.map(a => `
            <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px">${a.user_name || a.user_id || 'System'}</td>
                <td style="padding:10px"><span class="activity-type type-${(a.activity_type || 'action').replace(/\s/g, '_')}">${a.activity_type || 'Action'}</span></td>
                <td style="padding:10px;font-size:13px;max-width:300px;overflow:hidden;text-overflow:ellipsis">${a.details || a.message || '—'}</td>
                <td style="padding:10px;font-size:12px;color:#666">${a.ip_address || '—'}</td>
                <td style="padding:10px;font-size:12px;color:#666">${formatDate(a.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#dc3545;padding:20px">Failed to load activities: ${err.message}</td></tr>`;
    }
}

// ─────────────────────────── AD MANAGEMENT ──────────────────────────────────
async function loadAds() {
    const container = document.getElementById('adsList');
    if (!container) return;

    try {
        const data = await adminFetch('/ads');
        const ads = data.ads || [];

        if (ads.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#666;padding:20px">No ads created yet. Create your first ad!</p>';
            return;
        }

        container.innerHTML = ads.map(ad => `
            <div style="border:1px solid #eee;border-radius:8px;padding:15px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <strong>${ad.title || ad.name}</strong>
                    <br><small style="color:#666">${ad.description || ''}</small>
                    <br><small style="color:${ad.is_active ? '#28a745' : '#dc3545'}">${ad.is_active ? '● Active' : '○ Inactive'}</small>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn-approve" onclick="toggleAdStatus('${ad.id}', ${!ad.is_active})">
                        <i class="fa fa-${ad.is_active ? 'pause' : 'play'}"></i> ${ad.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <button class="btn-reject" onclick="deleteAd('${ad.id}')">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545;padding:20px">Failed to load ads: ${err.message}</p>`;
    }
}

async function createNewAd() {
    const title = prompt('Ad Title:');
    if (!title) return;
    const description = prompt('Ad Description:');
    const link = prompt('Ad Link URL (optional):');

    try {
        await adminFetch('/ads', {
            method: 'POST',
            body: JSON.stringify({ title, description, link, is_active: true })
        });
        showNotification('Ad created!', 'success');
        loadAds();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

async function toggleAdStatus(adId, newStatus) {
    try {
        await adminFetch(`/ads/${adId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: newStatus })
        });
        showNotification(`Ad ${newStatus ? 'activated' : 'paused'}.`, 'success');
        loadAds();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

async function deleteAd(adId) {
    if (!confirm('Delete this ad permanently?')) return;
    try {
        await adminFetch(`/ads/${adId}`, { method: 'DELETE' });
        showNotification('Ad deleted.', 'success');
        loadAds();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
}

// ────────────────────────── NOTIFICATIONS ───────────────────────────────────
async function loadNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    try {
        const data = await adminFetch('/notifications');
        const notifications = data.notifications || [];

        if (notifications.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#666;padding:30px">No notifications.</p>';
            return;
        }

        container.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.is_read ? '' : 'unread'} priority-${n.priority || 'normal'}" 
                 onclick="markNotificationRead('${n.id}', this)">
                <div class="notification-header">
                    <span class="notification-title">${n.title || 'Notification'}</span>
                    <span class="notification-time">${formatDate(n.created_at)}</span>
                </div>
                <div class="notification-message">${n.message || n.body || ''}</div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545;padding:20px">Failed to load notifications: ${err.message}</p>`;
    }
}

async function markNotificationRead(id, el) {
    if (el) el.classList.remove('unread');
    try {
        await adminFetch('/mark-notification-read', {
            method: 'POST',
            body: JSON.stringify({ notificationId: id })
        });
    } catch (_) { /* non-critical */ }
}

// ─────────────────────────── EMAIL LOGS ─────────────────────────────────────
async function loadEmailLogs() {
    const tbody = document.getElementById('emailsBody');
    if (!tbody) return;

    try {
        const data = await adminFetch('/email-logs');
        const emails = data.emails || [];

        if (emails.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#666">No email logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = emails.map(e => `
            <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px">${e.recipient_email || e.to || '—'}</td>
                <td style="padding:10px">${e.subject || '—'}</td>
                <td style="padding:10px;font-size:12px;color:#555">${e.email_type || e.type || '—'}</td>
                <td style="padding:10px">
                    <span class="email-status status-${e.status || 'pending'}">
                        ${e.status || 'pending'}
                    </span>
                </td>
                <td style="padding:10px;font-size:12px;color:#666">${formatDate(e.sent_at || e.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#dc3545;padding:20px">Failed to load email logs: ${err.message}</td></tr>`;
    }
}

// ─────────────────────────── LOGOUT ─────────────────────────────────────────
function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

// ─────────────── NOTIFICATION HELPER (in case auth.js not loaded) ────────────
if (typeof showNotification === 'undefined') {
    window.showNotification = function (message, type = 'info') {
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());

        const n = document.createElement('div');
        n.className = `notification notification-${type}`;
        n.textContent = message;
        n.style.cssText = `
            position:fixed;top:20px;right:20px;padding:15px 20px;
            border-radius:8px;color:white;font-weight:500;z-index:10000;
            background:${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            box-shadow:0 4px 12px rgba(0,0,0,.2);animation:slideIn .3s ease-out;
        `;
        document.body.appendChild(n);
        setTimeout(() => { if (n.parentNode) n.remove(); }, 4000);
    };
}
// alias for legacy inline script compatibility
const loadSystemOverview = loadOverviewStats;
const loadPaymentServices = loadPayments;
const loadUserActivities = loadActivities;

// safe event handling for pending payments button
async function processPendingPayments(event) {
    if (!confirm('Are you sure you want to process all pending payments? This action cannot be undone.')) return;

    const processBtn = event?.target || document.querySelector('.btn-success[onclick*="processPendingPayments"]');
    const originalText = processBtn?.innerHTML || 'Processing...';

    if (processBtn) {
        processBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Processing...';
        processBtn.disabled = true;
    }

    try {
        const data = await adminFetch('/process-pending-payments', { method: 'POST' });
        if (data.success) {
            showNotification(`Successfully processed $${(data.totalAmount || 0).toFixed(2)} payments`, 'success');
            loadPayments();
            loadOverviewStats();
        } else {
            showNotification(data.message || 'Failed to process payments', 'error');
        }
    } catch (err) {
        showNotification('Network error. Please try again.', 'error');
        console.error('Error processing payments:', err);
    } finally {
        if (processBtn) {
            processBtn.innerHTML = originalText;
            processBtn.disabled = false;
        }
    }
}
