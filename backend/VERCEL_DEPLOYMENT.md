# Vercel Deployment Guide

To successfully deploy the ACEOS Affiliate Store to Vercel and avoid `FUNCTION_INVOCATION_FAILED` errors, follow these steps.

## 1. Required Environment Variables

You **must** add the following environment variables to your Vercel Project Settings (Settings > Environment Variables):

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous API key |
| `SESSION_SECRET` | A long, random string for session encryption |
| `JWT_SECRET` | A secret key for signing JSON Web Tokens |
| `SMTP_USER` | Your email service username (e.g., Gmail address) |
| `SMTP_PASS` | Your email service app password |
| `NODE_ENV` | Set to `production` |
| `BASE_URL` | The public URL of your Vercel deployment (e.g. `https://your-project.vercel.app`) |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `PAYPAL_CLIENT_ID` | Your PayPal Client ID |
| `PAYPAL_CLIENT_SECRET` | Your PayPal Client Secret |
| `PAYPAL_WEBHOOK_ID` | Your PayPal Webhook ID |

## 2. Viewing Error Logs

If you still encounter errors, you can view the real-time server logs on Vercel:

1. Go to your **Vercel Dashboard**.
2. Select your project.
3. Click on the **Logs** tab.
4. Filter by **Functions** to see why the invocation is failing.

## 3. Deployment Checklist

- [ ] Environment variables added to Vercel.
- [ ] Database is accessible from Vercel's IP range (ensure Supabase has "Allow all IPs").
- [ ] `vercel.json` is present in the root directory.
