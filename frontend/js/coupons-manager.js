/**
 * Coupon Management UI Controller
 * Feature: Coupon Code Tracking
 */

document.addEventListener('DOMContentLoaded', () => {
    const couponList = document.getElementById('affiliate-coupons-list');
    const createBtn = document.getElementById('createCouponBtn');
    
    if (couponList) {
        loadCoupons();
    }

    if (createBtn) {
        createBtn.addEventListener('click', handleCreateCoupon);
    }
});

async function loadCoupons() {
    const list = document.getElementById('affiliate-coupons-list');
    if (!list) return;

    try {
        const response = await safeFetch('/api/coupons/my-coupons');
        if (response.success) {
            if (response.coupons.length === 0) {
                list.innerHTML = '<p class="text-muted">No coupons created yet. Create one to track sales on Instagram!</p>';
                return;
            }

            list.innerHTML = response.coupons.map(c => `
                <div class="dash-card" style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 1.2em; color: #007bff;">${c.code}</strong>
                        <span class="badge status-active" style="margin-left: 10px;">${c.discount_percent}% OFF</span>
                    </div>
                    <div style="font-size: 0.9em; color: #666;">
                        Created: ${new Date(c.created_at).toLocaleDateString()}
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load coupons', err);
    }
}

async function handleCreateCoupon() {
    const code = prompt('Enter your unique coupon code (e.g., INSTA10):');
    if (!code) return;

    const discount = prompt('Enter discount percentage (e.g., 10):', '10');
    
    try {
        const response = await safeFetch('/api/coupons/create', {
            method: 'POST',
            body: JSON.stringify({
                code: code,
                discount_percent: parseFloat(discount)
            })
        });

        if (response.success) {
            showToast('Coupon created successfully!', 'success');
            loadCoupons();
        } else {
            showToast(response.error || 'Failed to create coupon', 'error');
        }
    } catch (err) {
        showToast('Error creating coupon', 'error');
    }
}
