// js/paypal.js
// This script initializes the PayPal button and handles payment capture and backend reporting.

function initPayPalIntegration(productId, price) {
    if (!productId || !price) {
        console.warn('PayPal: Missing productId or price. Integration not initialized.');
        return;
    }

    // Load PayPal SDK dynamically if not already present
    // Using 'sb' as a default sandbox client ID. User should replace with their actual ID.
    const PAYPAL_CLIENT_ID = 'sb';
    const CURRENCY = 'USD';

    if (!document.getElementById('paypal-sdk-script')) {
        const script = document.createElement('script');
        script.id = 'paypal-sdk-script';
        // Add disable-funding=card to remove the credit card segment
        script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=${CURRENCY}&disable-funding=card`;
        script.onload = () => renderPayPalButton(productId, price);
        document.head.appendChild(script);
    } else {
        renderPayPalButton(productId, price);
    }
}

function renderPayPalButton(productId, price) {
    if (!window.paypal) {
        console.error('PayPal SDK could not be loaded.');
        return;
    }

    paypal.Buttons({
        fundingSource: paypal.FUNDING.PAYPAL, // Explicitly use PayPal login flow
        style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'paypal'
        },
        createOrder: function (data, actions) {
            const dynamicAmount = document.getElementById('payment-amount')?.value || price;
            return actions.order.create({
                purchase_units: [{
                    amount: {
                        value: parseFloat(dynamicAmount).toFixed(2)
                    },
                    payee: {
                        email_address: 'denisbamboo@yahoo.com'
                    },
                    description: `Purchase of Product ${productId}`,
                    custom_id: String(productId)
                }]
            });
        },
        onApprove: function (data, actions) {
            return actions.order.capture().then(function (details) {
                // Provide immediate feedback
                showToast('Payment successful! Processing...', 'success');

                // Record transaction in database via backend API
                fetch('/api/paypal/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderID: data.orderID,
                        payerID: data.payerID,
                        paymentID: details.id,
                        amount: price,
                        productId: productId,
                        userId: localStorage.getItem('userId') || null
                    })
                })
                    .then(res => res.json())
                    .then(resp => {
                        if (resp.success) {
                            // Optional: Redirect to a success page
                            setTimeout(() => {
                                window.location.href = `home.html?payment=success&orderID=${data.orderID}`;
                            }, 1500);
                        } else {
                            console.error('Database record failed:', resp.message);
                            alert('Payment was successful but we had trouble recording it. Please contact support.');
                        }
                    })
                    .catch(err => {
                        console.error('API Error:', err);
                    });
            });
        },
        onCancel: function (data) {
            showToast('Payment cancelled.', 'info');
        },
        onError: function (err) {
            showToast('Error processing payment with PayPal.', 'error');
            console.error('PayPal Error:', err);
        }
    }).render('#paypal-button-container');

    // Add Simulation Button for Testing
    const container = document.getElementById('paypal-button-container');
    if (container) {
        const simBtn = document.createElement('button');
        simBtn.innerText = 'Simulate Payment (No Card Needed)';
        simBtn.className = 'btn-secondary md-round text-center text-uppercase';
        simBtn.style = 'width: 100%; margin-top: 10px; padding: 10px; background: #6c757d; color: white; border: none; cursor: pointer;';
        simBtn.onclick = () => {
            const dynamicAmount = document.getElementById('payment-amount')?.value || price;
            simulatePayment(productId, dynamicAmount);
        };
        container.parentNode.insertBefore(simBtn, container.nextSibling);
    }
}

async function simulatePayment(productId, price) {
    if (!confirm(`Simulate payment of $${price} for Product ${productId}?`)) return;

    const statusEl = document.getElementById('payment-status');
    if (statusEl) {
        statusEl.innerHTML = '<div style="color: blue; margin: 10px 0; font-weight: bold;">Simulating payment...</div>';
    }

    try {
        const response = await fetch('/api/paypal/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderID: 'SIM-' + Date.now(),
                payerID: 'SIM-PAYER',
                paymentID: 'SIM-PAY-' + Date.now(),
                amount: price,
                productId: productId,
                userId: localStorage.getItem('userId') || null
            })
        });

        const resp = await response.json();
        if (resp.success) {
            if (statusEl) statusEl.innerHTML = '<div style="color: green; margin: 10px 0; font-weight: bold;">Simulation successful! Redirecting...</div>';
            setTimeout(() => {
                window.location.href = `home.html?payment=success&orderID=${resp.payment.order_id}`;
            }, 1500);
        } else {
            alert('Simulation failed: ' + resp.message);
        }
    } catch (err) {
        console.error('Simulation Error:', err);
        alert('Simulation failed due to network error.');
    }
}
