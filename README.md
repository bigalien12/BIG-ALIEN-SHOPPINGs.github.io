# Big Alien Venture — Real Online Store

This package replaces the browser-only/localStorage prototype with a real online architecture using Supabase.

## What it supports

### Customers
- Create account / login
- Marketplace after login
- Categories and search
- Product details
- Cart and Buy Now
- Checkout
- Bank-transfer payment instructions
- Customer orders
- Shipment timeline and tracking number
- Profile

### Admin
- Secure role-based Admin access
- Add products
- Upload product pictures from phone
- Edit products
- Change price/stock/category/description
- Delete products
- View customer orders
- Confirm/update payment status
- Update shipment status
- Add tracking number and shipment messages

## Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `schema.sql` in full.
3. Create a normal account through the website.
4. In Supabase SQL Editor, promote that account to admin:
   `update public.profiles set role='admin' where id=(select id from auth.users where email='YOUR_OWNER_EMAIL');`
5. Copy the Supabase Project URL and publishable/anon browser key into `config.js`.
6. Deploy this folder to GitHub Pages (or another static host).
7. Open the website, log in with the owner account, and use Admin.

## Important security rules

- Do NOT put a Supabase `service_role`/secret key in `config.js`.
- Do NOT put Paystack secret keys in browser code.
- For Paystack, use a server-side/Supabase Edge Function to initialize and verify payments, and use webhooks to update order payment status.
- The current package supports bank transfer orders immediately. Paystack is intentionally not faked: it needs your own Paystack account and server-side secret configuration.

## Logo and images

The supplied Big Alien logo is in `images/logo.jpg`.
Supplied solar images are included as starter assets.

## GitHub Pages

The app is plain HTML/CSS/JavaScript, so it can be hosted on GitHub Pages. The database/auth/storage live in Supabase, so products, accounts, orders, and shipment updates are shared across customer devices.

## Before launch

- Configure a custom domain if desired.
- Configure Supabase Auth email settings and redirect URL.
- Create the admin account and test admin/customer permissions.
- Add your products.
- Test a complete order from a second phone/browser.
- Connect Paystack server-side if you want card/bank payment automation.
