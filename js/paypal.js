// js/paypal.js
// This script initializes PayPal and Google Pay buttons and handles payment capture and backend reporting.

// Real-time payment status management
function updatePaymentStatus(message, type = 'info', showSpinner = false) {
    const statusContainer = document.getElementById('payment-status');
    const statusMessage = statusContainer?.querySelector('.status-message');

    if (!statusMessage) return;

    // Clear any existing content
    statusMessage.innerHTML = '';

    // Add spinner if requested
    if (showSpinner) {
        const spinner = document.createElement('div');
        spinner.className = 'payment-spinner';
        spinner.style.cssText = `
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        `;
        statusMessage.appendChild(spinner);
    }

    // Set message
    const textNode = document.createTextNode(message);
    statusMessage.appendChild(textNode);

    // Set styling based on type
    let backgroundColor, textColor, borderColor;
    switch (type) {
        case 'success':
            backgroundColor = '#d4edda';
            textColor = '#155724';
            borderColor = '#c3e6cb';
            break;
        case 'error':
            backgroundColor = '#f8d7da';
            textColor = '#721c24';
            borderColor = '#f5c6cb';
            break;
        case 'warning':
            backgroundColor = '#fff3cd';
            textColor = '#856404';
            borderColor = '#ffeaa7';
            break;
        default: // info
            backgroundColor = '#d1ecf1';
            textColor = '#0c5460';
            borderColor = '#bee5eb';
    }

    statusMessage.style.cssText = `
        background-color: ${backgroundColor};
        color: ${textColor};
        border: 1px solid ${borderColor};
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        margin: 10px 0;
        display: flex;
        align-items: center;
    `;

    // Show the message
    statusMessage.style.display = 'flex';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }

    // Add CSS animation for spinner
    if (showSpinner && !document.getElementById('payment-spinner-css')) {
        const style = document.createElement('style');
        style.id = 'payment-spinner-css';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Image optimization and error handling for brand/payment images
function optimizeBrandImages() {
    // Add error handling for all images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('error', function() {
            // Replace broken images with a placeholder
            if (this.src.includes('logo') || this.src.includes('brand')) {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOUI5QkE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPkltYWdlPC90ZXh0Pgo8L3N2Zz4=';
                this.alt = 'Brand Image Unavailable';
            }
        });

        // Add lazy loading for better performance
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }

        // Optimize image dimensions for payment brands
        if (img.src.includes('logo') && img.closest('.coupon-logo, .brand-logo')) {
            img.style.maxWidth = '120px';
            img.style.maxHeight = '60px';
            img.style.objectFit = 'contain';
        }
    });

    // Add CSS for optimized brand image display
    const style = document.createElement('style');
    style.textContent = `
        .payment-brands {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            align-items: center;
            margin: 15px 0;
        }

        .payment-brands img {
            max-width: 60px;
            max-height: 40px;
            object-fit: contain;
            transition: opacity 0.3s ease;
        }

        .payment-brands img:hover {
            opacity: 0.8;
        }

        .payment-brands img[alt*="PayPal"] {
            max-width: 80px;
        }

        .payment-brands img[alt*="Google"] {
            max-width: 70px;
        }

        /* Fallback for broken images */
        img[src*="data:image"] {
            border: 1px solid #e0e0e0;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);
}

// Initialize image optimization when DOM is ready
document.addEventListener('DOMContentLoaded', optimizeBrandImages);

function initPayPalIntegration(productId, price) {
    if (!productId || !price) {
        console.warn('PayPal: Missing productId or price. Integration not initialized.');
        return;
    }

    // Load PayPal SDK dynamically if not already present
    // Using 'sb' as a default sandbox client ID. User should replace with their actual ID.
    const PAYPAL_CLIENT_ID = 'sb';
    const CURRENCY = 'USD';

    // Load Google Pay API
    if (!document.getElementById('google-pay-sdk-script')) {
        const googlePayScript = document.createElement('script');
        googlePayScript.id = 'google-pay-sdk-script';
        googlePayScript.src = 'https://pay.google.com/gp/p/js/pay.js';
        googlePayScript.onload = () => initGooglePay(productId, price);
        document.head.appendChild(googlePayScript);
    } else {
        initGooglePay(productId, price);
    }

    if (!document.getElementById('paypal-sdk-script')) {
        const script = document.createElement('script');
        script.id = 'paypal-sdk-script';
        // Enable PayPal login-first flow, disable other funding sources except PayPal
        script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=${CURRENCY}&disable-funding=card,credit,paylater&enable-funding=paypal`;
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
            color: 'blue',
            shape: 'rect',
            label: 'paypal',
            height: 50
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
            // Show immediate processing feedback
            updatePaymentStatus('Processing PayPal payment...', 'info', true);
            showToast('Processing payment...', 'info');

            return actions.order.capture().then(function (details) {
                // Update status to approval received
                updatePaymentStatus('Payment approved! Recording transaction...', 'info', true);

                // Record transaction in database via backend API with real-time updates
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
                    .then(res => {
                        if (!res.ok) {
                            throw new Error(`HTTP error! status: ${res.status}`);
                        }
                        return res.json();
                    })
                    .then(resp => {
                        if (resp.success) {
                            updatePaymentStatus('Transaction completed successfully!', 'success');
                            showToast('Transaction completed successfully!', 'success');
                            // Optional: Redirect to a success page with delay for user to see confirmation
                            setTimeout(() => {
                                window.location.href = `home.html?payment=success&orderID=${data.orderID}`;
                            }, 2000);
                        } else {
                            console.error('Database record failed:', resp.message);
                            updatePaymentStatus('Payment processed but recording failed. Contact support.', 'warning');
                            showToast('Payment processed but recording failed. Contact support.', 'warning');
                        }
                    })
                    .catch(err => {
                        console.error('API Error:', err);
                        updatePaymentStatus('Payment processed but verification failed. Please check your email.', 'warning');
                        showToast('Payment processed but verification failed. Please check your email.', 'warning');
                    });
            });
        },
        onCancel: function (data) {
            updatePaymentStatus('Payment cancelled by user.', 'info');
            showToast('Payment cancelled.', 'info');
        },
        onError: function (err) {
            updatePaymentStatus('Error processing payment with PayPal. Please try again.', 'error');
            showToast('Error processing payment with PayPal.', 'error');
            console.error('PayPal Error:', err);
        }
    }).render('#paypal-button-container');

    // Add Google Pay button after PayPal button
    const container = document.getElementById('paypal-button-container');
    if (container) {
        // Create a container for Google Pay
        const googlePayContainer = document.createElement('div');
        googlePayContainer.id = 'google-pay-button-container';
        googlePayContainer.style = 'margin-top: 10px;';
        container.parentNode.insertBefore(googlePayContainer, container.nextSibling);

        // Add Simulation Button for Testing
        const simBtn = document.createElement('button');
        simBtn.innerText = 'Simulate Payment (No Card Needed)';
        simBtn.className = 'btn-secondary md-round text-center text-uppercase';
        simBtn.style = 'width: 100%; margin-top: 10px; padding: 10px; background: #6c757d; color: white; border: none; cursor: pointer;';
        simBtn.onclick = () => {
            const dynamicAmount = document.getElementById('payment-amount')?.value || price;
            simulatePayment(productId, dynamicAmount);
        };
        container.parentNode.insertBefore(simBtn, googlePayContainer.nextSibling);
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

// Google Pay Integration
async function initGooglePay(productId, price) {
    if (!window.google) {
        console.error('Google Pay SDK could not be loaded.');
        return;
    }

    try {
        const paymentsClient = new google.payments.api.PaymentsClient({
            environment: 'TEST' // Change to 'PRODUCTION' for live
        });

        const isReadyToPayRequest = {
            apiVersion: 2,
            apiVersionMinor: 0,
            allowedPaymentMethods: [{
                type: 'CARD',
                parameters: {
                    allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                    allowedCardNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA']
                },
                tokenizationSpecification: {
                    type: 'PAYMENT_GATEWAY',
                    parameters: {
                        gateway: 'example',
                        gatewayMerchantId: 'exampleGatewayMerchantId'
                    }
                }
            }]
        };

        const isReadyToPayResponse = await paymentsClient.isReadyToPay(isReadyToPayRequest);
        if (isReadyToPayResponse.result) {
            renderGooglePayButton(paymentsClient, productId, price);
        } else {
            console.log('Google Pay is not available for this device/browser.');
        }
    } catch (err) {
        console.error('Error initializing Google Pay:', err);
    }
}

function renderGooglePayButton(paymentsClient, productId, price) {
    const button = paymentsClient.createButton({
        onClick: () => onGooglePayButtonClicked(paymentsClient, productId, price),
        buttonColor: 'default',
        buttonType: 'buy',
        buttonLocale: 'en'
    });

    const container = document.getElementById('google-pay-button-container');
    if (container) {
        container.appendChild(button);
    }
}

async function onGooglePayButtonClicked(paymentsClient, productId, price) {
    const dynamicAmount = document.getElementById('payment-amount')?.value || price;

    updatePaymentStatus('Processing Google Pay payment...', 'info', true);
    showToast('Processing Google Pay payment...', 'info');

    const paymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [{
            type: 'CARD',
            parameters: {
                allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                allowedCardNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA']
            },
            tokenizationSpecification: {
                type: 'PAYMENT_GATEWAY',
                parameters: {
                    gateway: 'example',
                    gatewayMerchantId: 'exampleGatewayMerchantId'
                }
            }
        }],
        transactionInfo: {
            totalPriceStatus: 'FINAL',
            totalPrice: parseFloat(dynamicAmount).toFixed(2),
            currencyCode: 'USD',
            countryCode: 'US'
        },
        merchantInfo: {
            merchantName: 'Bamburi Affiliate Store',
            merchantId: '12345678901234567890'
        }
    };

    try {
        const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);

        // Process the payment data (in production, send to your server)
        await processGooglePayPayment(paymentData, productId, dynamicAmount);

    } catch (err) {
        console.error('Google Pay payment failed:', err);
        showToast('Google Pay payment was cancelled or failed.', 'error');
    }
}

async function processGooglePayPayment(paymentData, productId, amount) {
    try {
        // For demo purposes, simulate processing
        // In production, you would send the payment token to your server

        updatePaymentStatus('Payment authorized! Recording transaction...', 'success');
        showToast('Payment authorized! Recording transaction...', 'success');

        const response = await fetch('/api/paypal/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderID: 'GPAY-' + Date.now(),
                payerID: 'GPAY-PAYER',
                paymentID: 'GPAY-' + Date.now(),
                amount: amount,
                productId: productId,
                userId: localStorage.getItem('userId') || null,
                paymentMethod: 'google_pay'
            })
        });

        const resp = await response.json();
        if (resp.success) {
            updatePaymentStatus('Google Pay transaction completed successfully!', 'success');
            showToast('Google Pay transaction completed successfully!', 'success');
            setTimeout(() => {
                window.location.href = `home.html?payment=success&orderID=${resp.payment.order_id}`;
            }, 2000);
        } else {
            updatePaymentStatus('Payment processed but recording failed.', 'warning');
            showToast('Payment processed but recording failed.', 'warning');
        }
    } catch (err) {
        console.error('Error processing Google Pay payment:', err);
        showToast('Google Pay payment processing failed.', 'error');
    }
}
