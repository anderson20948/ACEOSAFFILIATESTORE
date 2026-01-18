document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = '/login';
        return;
    }
    // Strict admin check
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
        alert('Access Denied');
        window.location.href = '/dashboard';
        return;
    }

    loadPendingProducts();
});

async function loadPendingProducts() {
    try {
        const products = await fetchAPI('/admin/pending-products');
        const container = document.getElementById('pending-list');

        container.innerHTML = products.map(p => `
            <div class="product-card">
                 <div class="product-details">
                    <div class="product-title">${p.title}</div>
                    <div class="product-price">$${p.price}</div>
                     <p>Owner ID: ${p.owner_id}</p>
                    <p>${p.description || ''}</p>
                    ${p.image_url ? `<img src="${p.image_url}" style="max-height: 100px; margin: 10px 0;">` : ''}
                    <div style="margin-top: 10px;">
                        <button class="btn btn-success" onclick="updateStatus(${p.id}, 'approve')">Approve</button>
                        <button class="btn btn-danger" onclick="updateStatus(${p.id}, 'reject')">Reject</button>
                    </div>
                </div>
            </div>
        `).join('');

        if (products.length === 0) {
            container.innerHTML = '<p>No pending products.</p>';
        }
    } catch (err) {
        console.error(err);
        if (err.message.includes('Access denied')) {
            alert('Access Denied');
            window.location.href = '/dashboard';
        }
    }
}

async function updateStatus(productId, action) {
    if (!confirm(`Are you sure you want to ${action} this product?`)) return;

    try {
        await fetchAPI('/admin/approve-product', {
            method: 'POST',
            body: JSON.stringify({ productId, action })
        });

        loadPendingProducts(); // Refresh list
    } catch (err) {
        alert(err.message);
    }
}
