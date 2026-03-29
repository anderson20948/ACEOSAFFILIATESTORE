// Email Service for sending notifications
const { db } = require('../dbConfig');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        this.templates = {
            password_reset: {
                subject: '🔒 Reset Your Aceos Password',
                html: (data) => `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                        <div style="background: #ff5e14; padding: 20px; text-align: center;">
                            <img src="https://fcwaavtmpqibiccdijwy.supabase.co/storage/v1/object/public/system/logo.png" alt="Aceos" style="max-width: 150px;">
                        </div>
                        <div style="padding: 30px; color: #333;">
                            <h2 style="color: #ff5e14; margin-top: 0;">Password Reset Request</h2>
                            <p>Hello,</p>
                            <p>We received a request to reset the password for your Aceos account. Use the following 6-digit verification code to proceed:</p>
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${data.code}</span>
                            </div>
                            <p>This code will expire in <strong>15 minutes</strong> for your security.</p>
                            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="font-size: 14px; color: #777;">Regards,<br>The Aceos Team</p>
                        </div>
                        <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #999;">
                            &copy; ${new Date().getFullYear()} Aceos Affiliate Store. All rights reserved.
                        </div>
                    </div>
                `,
                text: (data) => `
                    Reset Your Aceos Password

                    Hello,

                    We received a request to reset the password for your Aceos account. Use the following 6-digit verification code to proceed:

                    ${data.code}

                    This code will expire in 15 minutes for your security.

                    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

                    Regards,
                    The Aceos Team
                `
            },
            application_approved: {
                subject: '🎉 Your Advertising Application Has Been Approved!',
                html: (data) => `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #28a745;">Congratulations ${data.userName}!</h2>
                        <p>Your advertising application for <strong>${data.applicationType}</strong> has been approved.</p>
                        <p>You can now start displaying ads on your social media accounts and websites to earn commissions.</p>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3>What happens next?</h3>
                            <ul>
                                <li>Log into your dashboard to access advertising tools</li>
                                <li>Configure your ad placements on social media and websites</li>
                                <li>Start earning from impressions and clicks</li>
                                <li>Get paid weekly via PayPal</li>
                            </ul>
                        </div>
                        <p>If you have any questions, please contact our support team.</p>
                        <p>Happy earning!</p>
                        <p>The Aceos Team</p>
                    </div>
                `,
                text: (data) => `
                    Congratulations ${data.userName}!

                    Your advertising application for ${data.applicationType} has been approved.

                    You can now start displaying ads on your social media accounts and websites to earn commissions.

                    What happens next?
                    - Log into your dashboard to access advertising tools
                    - Configure your ad placements on social media and websites
                    - Start earning from impressions and clicks
                    - Get paid weekly via PayPal

                    If you have any questions, please contact our support team.

                    Happy earning!

                    The Aceos Team
                `
            },

            application_rejected: {
                subject: '⚠️ Update on Your Advertising Application',
                html: (data) => `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc3545;">Application Update</h2>
                        <p>Dear ${data.userName},</p>
                        <p>Thank you for your interest in our advertising program. After careful review, we regret to inform you that your application for <strong>${data.applicationType}</strong> could not be approved at this time.</p>
                        ${data.reason ? `<div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                            <strong>Reason:</strong> ${data.reason}
                        </div>` : ''}
                        <p>You can reapply after addressing the issues mentioned above, or contact our support team for guidance.</p>
                        <p>We appreciate your interest and hope to work with you in the future.</p>
                        <p>Best regards,</p>
                        <p>The Aceos Team</p>
                    </div>
                `,
                text: (data) => `
                    Application Update

                    Dear ${data.userName},

                    Thank you for your interest in our advertising program. After careful review, we regret to inform you that your application for ${data.applicationType} could not be approved at this time.

                    ${data.reason ? `Reason: ${data.reason}` : ''}

                    You can reapply after addressing the issues mentioned above, or contact our support team for guidance.

                    We appreciate your interest and hope to work with you in the future.

                    Best regards,
                    The Aceos Team
                `
            },

            payment_processed: {
                subject: '💰 Payment Processed Successfully',
                html: (data) => `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #28a745;">Payment Processed!</h2>
                        <p>Dear ${data.userName},</p>
                        <p>Great news! Your payment of <strong>$${data.amount}</strong> has been processed and sent to your PayPal account.</p>
                        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                            <strong>Payment Details:</strong><br>
                            Amount: $${data.amount}<br>
                            Transaction ID: ${data.transactionId || 'N/A'}<br>
                            Processed: ${new Date().toLocaleDateString()}
                        </div>
                        <p>You should see the funds in your PayPal account within 1-3 business days.</p>
                        <p>Keep up the great work!</p>
                        <p>The Aceos Team</p>
                    </div>
                `,
                text: (data) => `
                    Payment Processed!

                    Dear ${data.userName},

                    Great news! Your payment of $${data.amount} has been processed and sent to your PayPal account.

                    Payment Details:
                    Amount: $${data.amount}
                    Transaction ID: ${data.transactionId || 'N/A'}
                    Processed: ${new Date().toLocaleDateString()}

                    You should see the funds in your PayPal account within 1-3 business days.

                    Keep up the great work!

                    The Aceos Team
                `
            },

            support_request: {
                subject: '🚨 New Support Request Received',
                html: (data) => `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                        <div style="background: #ff5e14; padding: 20px; text-align: center; color: #fff;">
                            <h2>New Support Request</h2>
                        </div>
                        <div style="padding: 30px; color: #333;">
                            <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
                            <p><strong>Name:</strong> ${data.name}</p>
                            <p><strong>Email:</strong> ${data.email}</p>
                            <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
                            <p><strong>Subject:</strong> ${data.subject}</p>
                            <p><strong>Message:</strong></p>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; color: #444;">${data.message}</div>
                            <p>Please respond to this request and follow up until the issue is resolved.</p>
                        </div>
                        <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #777;">
                            Aceos Support System
                        </div>
                    </div>
                `,
                text: (data) => `
                    New Support Request

                    Ticket ID: ${data.ticketId}
                    Name: ${data.name}
                    Email: ${data.email}
                    Phone: ${data.phone || 'Not provided'}
                    Subject: ${data.subject}
                    Message:
                    ${data.message}

                    Please respond to this request and follow up until the issue is resolved.
                `
            },

            support_confirmation: {
                subject: '✅ We received your support request',
                html: (data) => `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                        <div style="background: #007bff; padding: 20px; text-align: center; color: #fff;">
                            <h2>Support Request Received</h2>
                        </div>
                        <div style="padding: 30px; color: #333;">
                            <p>Hello ${data.userName},</p>
                            <p>Thank you for contacting Aceos support. We have received your message and a support ticket has been created.</p>
                            <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
                            <p>Our support team will follow up with you as soon as possible.</p>
                            <p>If you have additional details, please reply to this email.</p>
                        </div>
                        <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #777;">
                            Aceos Support Team
                        </div>
                    </div>
                `,
                text: (data) => `
                    Support Request Received

                    Hello ${data.userName},

                    Thank you for contacting Aceos support. We have received your message and a support ticket has been created.

                    Ticket ID: ${data.ticketId}

                    Our support team will follow up with you as soon as possible.

                    If you have additional details, please reply to this email.
                `
            },

            welcome_affiliate: {
                subject: '🎊 Welcome to Aceos Affiliate Program!',
                html: (data) => `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #007bff;">Welcome to Aceos!</h2>
                        <p>Dear ${data.userName},</p>
                        <p>Thank you for joining the Aceos Affiliate Program! We're excited to have you as part of our community.</p>
                        <div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3>Getting Started:</h3>
                            <ul>
                                <li><a href="/dashboard-products.html">Browse our product catalog</a></li>
                                <li><a href="/dashboard-commerce.html">Set up your affiliate links</a></li>
                                <li><a href="/dashboard-advertising.html">Apply for advertising opportunities</a></li>
                                <li>Complete your profile and payment settings</li>
                            </ul>
                        </div>
                        <p>If you need any assistance, our support team is here to help.</p>
                        <p>Welcome aboard!</p>
                        <p>The Aceos Team</p>
                    </div>
                `,
                text: (data) => `
                    Welcome to Aceos!

                    Dear ${data.userName},

                    Thank you for joining the Aceos Affiliate Program! We're excited to have you as part of our community.

                    Getting Started:
                    - Browse our product catalog
                    - Set up your affiliate links
                    - Apply for advertising opportunities
                    - Complete your profile and payment settings

                    If you need any assistance, our support team is here to help.

                    Welcome aboard!

                    The Aceos Team
                `
            }
        };
    }


    // Send an email
    async sendEmail(recipientEmail, recipientName, templateKey, templateData = {}) {
        try {
            const template = this.templates[templateKey];
            if (!template) {
                throw new Error(`Email template '${templateKey}' not found`);
            }

            const html = template.html(templateData);
            const text = template.text ? template.text(templateData) : html.replace(/<[^>]*>?/gm, '');

            const targetAddresses = Array.isArray(recipientEmail) ? recipientEmail.join(', ') : recipientEmail;
            logger.info(`Email delivery disabled. Logging email instead for ${targetAddresses}`, { templateKey });

            const { error: insertError } = await db
                .from('email_logs')
                .insert([
                    {
                        recipient_email: targetAddresses,
                        recipient_name: recipientName,
                        subject: template.subject,
                        email_type: templateKey,
                        status: 'disabled',
                        sent_at: new Date()
                    }
                ]);

            if (insertError) logger.error('Error logging disabled email to DB', { error: insertError.message, recipientEmail });

            return { success: true, messageId: null };

        } catch (error) {
            logger.error('Error sending email', { error: error.message, recipientEmail, templateKey });

            // Log failed email
            try {
                await db
                    .from('email_logs')
                    .insert([
                        {
                            recipient_email: recipientEmail,
                            recipient_name: recipientName,
                            subject: templateKey,
                            email_type: templateKey,
                            status: 'failed',
                            sent_at: new Date()
                        }
                    ]);
            } catch (dbError) {
                logger.error('Failed to log email error to DB', { error: dbError.message, recipientEmail });
            }

            return { success: false, error: error.message };
        }
    }

    // Send password reset code
    async sendPasswordResetCode(email, code) {
        return this.sendEmail(email, 'User', 'password_reset', { code });
    }

    // Send application approval email
    async sendApplicationApproved(userEmail, userName, applicationType) {
        return this.sendEmail(userEmail, userName, 'application_approved', {
            userName,
            applicationType
        });
    }

    // Send application rejection email
    async sendApplicationRejected(userEmail, userName, applicationType, reason) {
        return this.sendEmail(userEmail, userName, 'application_rejected', {
            userName,
            applicationType,
            reason
        });
    }

    // Send payment processed email
    async sendPaymentProcessed(userEmail, userName, amount, transactionId = null) {
        return this.sendEmail(userEmail, userName, 'payment_processed', {
            userName,
            amount: parseFloat(amount).toFixed(2),
            transactionId
        });
    }

    // Send new support request email to admin recipients
    async sendSupportRequest(adminEmailList, formData) {
        return this.sendEmail(adminEmailList, 'Support Team', 'support_request', {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            subject: formData.subject,
            message: formData.message,
            ticketId: formData.ticketId
        });
    }

    // Send confirmation email back to the user
    async sendSupportConfirmation(userEmail, userName, ticketId) {
        return this.sendEmail(userEmail, userName, 'support_confirmation', {
            userName,
            ticketId
        });
    }

    // Send welcome email to new affiliates
    async sendWelcomeEmail(userEmail, userName) {
        return this.sendEmail(userEmail, userName, 'welcome_affiliate', {
            userName
        });
    }
}

// Export singleton instance
const emailService = new EmailService();
module.exports = emailService;
