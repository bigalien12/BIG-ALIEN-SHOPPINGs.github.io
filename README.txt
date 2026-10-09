BIG ALIEN VENTURE — UPDATED WEBSITE PACKAGE

Files are arranged for the root of your GitHub Pages repository. Upload all files and the images folder, then commit directly to main.

Included updates:
- Uses the uploaded BIG ALIEN logo at images/logo.png and correct PWA icon paths.
- Customer Inbox is a separate button inside My Account/Settings, not inside My Orders.
- My Orders keeps Ongoing / Delivered and Cancelled / Returned filters.
- Google OAuth button is included on the login/create-account screen.
- Standalone owner dashboard includes a Messages/Notifications panel. Product edit, add/delete, order/payment/shipment workflows are retained.
- Dark mode toggle now matches the CSS class and works with the saved preference.

IMPORTANT SETUP NOTES
1. Keep config.js set to your Supabase project and publishable browser key. Never put a service_role key in browser files.
2. To enable Google sign-in, in Supabase Authentication > Providers, enable Google and add your Google OAuth client credentials. In Supabase Authentication > URL Configuration, add your GitHub Pages site URL (https://bigalien12.github.io/big-alien-shops/) as an allowed redirect URL. Also add that URL to the Google OAuth authorized redirect configuration using the callback URL shown by Supabase.
3. The Customer Inbox and admin notifications require the notifications table and the database policies/migration previously supplied for Big Alien Venture. If the migration has not been run, the inbox will show a setup message.
4. Product image upload requires a public Supabase Storage bucket named product-images and the appropriate owner/admin storage policies.
5. Google provider activation, Supabase database policies, and Google Console credentials must be completed in their respective dashboards; website code alone cannot activate those services.
