# Aceos Affiliate System Workflow

## 1. User Roles & Access
- **Super Admins**: 
    - `tsumamngindodenis@gmail.com` (Default Pass: Dennis123)
    - `malomoanderson@gmail.com`
    - Have exclusive access to the Admin Panel (`/admin`).
    - Can review, approve, or reject products/coupons.
    - View system-wide analytics and payment history.
- **Affiliates/Users**:
    - Can register and login via the portal.
    - Upload products/coupons for approval.
    - Access a personalized dashboard with their own activity reports.

## 2. Product Upload & Vetting Process
1.  **Submission**: User uploads a product via the "Product Upload" modal in the dashboard.
2.  **Pending State**: Submitted products are saved with a `pending` status and are NOT visible to other users.
3.  **Vetting**: Super Admins receive a notification and can view all pending items in the Admin Panel.
4.  **Approval**: Once a Super Admin clicks "Approve", the product status changes to `approved` and it becomes visible in the marketplace.

## 3. Payment Flow (PayPal)
- All payments are routed to `denisbamboo@yahoo.com`.
- **Payment Lifecycle**:
    - User clicks "Buy Now" on a coupon/product.
    - PayPal SDK opens a secure checkout window.
    - Upon successful payment, the transaction is recorded in the `payments` table.
    - The server logs the activity for the Super Admin's review.

## 4. Security Measures
- **CSRF Protection**: All state-changing requests (POST/PUT/DELETE) require a valid CSRF token.
- **RBAC**: Server-side checks ensure only authorized emails can access admin endpoints.
- **Operational Audit**: Every significant operation is logged in the `activities` table.
- **Production Hardening**: Passwords are hashed with Bcrypt (10 rounds).

## 5. System Location
- Operational center and map references are centered around **Bamburi, Kenya**.
- Map Location: [Google Maps](https://www.google.com/maps/@-3.9853128,39.6836898,14z)
