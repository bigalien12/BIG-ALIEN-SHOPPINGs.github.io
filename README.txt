ABELSHOP UPDATED WEBSITE PACKAGE

Included:
- index.html and app.js (customer marketplace, customer stock labels, order-status tabs)
- styles.css (responsive blue-and-white styling)
- admin.html, admin.js, admin.css (admin product and shipment management)
- config.js (existing browser-safe Supabase project configuration)
- logo assets and manifest files

IMPORTANT:
1. Upload the contents of this folder to the same GitHub Pages repository, replacing the matching files.
2. Do not delete your existing Supabase database or change table policies.
3. This package does not include a Supabase database migration; existing notifications depend on the database functions/tables already configured.
4. Confirm images, storage bucket, and product image URLs are present in your repository/Supabase. Product cards use stored image_url values and a fallback path.
5. Test login, signup, admin access, product editing, order placement, and notifications after deployment.

The customer UI now displays only In Stock / Out of Stock, never the stock count. Admin stock quantities remain visible in the dashboard.
