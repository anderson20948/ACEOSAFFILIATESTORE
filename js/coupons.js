// js/coupons.js
// Handles coupon submission for affiliates.

async function handleCouponSubmit() {
    if (!isLoggedIn()) {
        alert('You must be logged in to submit a coupon.');
        window.location.href = 'login.html';
        return;
    }

    const title = document.getElementById('title').value;
    const price = document.getElementById('price').value;
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;

    const token = localStorage.getItem('token');

    try {
        const data = await safeFetch('/api/products/submit', {
            method: 'POST',
            body: JSON.stringify({ title, price, category, description })
        });

        if (data) {
            alert('Success: ' + data.message);
            window.location.href = 'dashboard-products.html';
        }
    } catch (err) {
        // Errors handled in safeFetch
    }
}
