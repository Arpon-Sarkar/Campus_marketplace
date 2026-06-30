# Latest detailed fixes

## Fixed in this version

1. Profile page layout is reorganized into a professional two-column layout.
2. Notification badges are stronger and use unread notification counts.
3. Registration now uses a temporary OTP table. A final user account is created only after OTP verification.
4. Demo OTP is shown directly on the registration page in a blue OTP box.
5. Email, phone number, and Student/Campus ID are checked for duplicates with clear error messages.
6. Service booking contact method now allows only Phone or Email.
7. Service provider sees only the selected contact method after approval:
   - Phone selected: phone number is shown.
   - Email selected: email is shown.
8. Existing backend syntax issue in dashboard user-field rendering was fixed.

## Important database step

Fresh setup:
Import `database/campus_marketplace.sql`.

Existing setup:
Run `database/upgrade_existing_database.sql` once from phpMyAdmin.

## Demo OTP explanation

This is a demo OTP for university/project testing. It does not send real SMS.
After clicking Register, the OTP appears on the page and in an alert.
In a real production version, this same logic can be connected to an SMS gateway.

## Latest academic update

Added in this version:
- Product/service images now keep aspect ratio using improved CSS.
- Profile page redesigned with a modern account card.
- Product quantity and sold/remaining stock support.
- Seller can edit/delete product and update quantity from listing/details pages.
- Provider can edit/delete own service listing.
- Product becomes sold automatically after buyer confirms receiving the order.
- Demo old-phone verification code is required before changing phone number.
- Users can upload/capture front and back ID card images during registration or profile update.
- Admin can view ID card front/back images in the user verification table.
- Public seller/provider profile page added: `seller-profile.html?id=USER_ID`.
- Product/service/order/booking pages link to seller/provider public profiles.
- Public profile shows only safe info: name, role, department, semester, verification status, listings and received reviews. It hides phone, email, student ID and ID card images.

For an existing database, run `database/upgrade_existing_database.sql` once in phpMyAdmin.

## v3 academic fixes

- Registration now requires both front and back ID card images. The earlier v2 frontend did not send these images to the backend; this is fixed.
- Admin user table can open ID card front/back images for verification.
- Product and service images now preserve aspect ratio with `object-fit: contain` and are clickable for full preview.
- Services now support an extra portfolio/CV/supporting file upload: image, PDF, DOC, or DOCX. Files are stored as Base64 in MySQL for academic demo.
- Admin can view service image and portfolio/CV attachment before approving service listings.
- Provider name and seller name are clickable in admin tables and public listings.
- Product edit, stock update, and delete now open page modals instead of browser prompt boxes.
- Service edit, delete, and availability update now open/manage through page UI controls.
- Providers can mark approved services as Active or Not Available.
- Dashboard account information section has a modern card design.
- Backend JSON upload limit increased to 15 MB for ID cards and portfolio files.

Run `database/upgrade_existing_database.sql` once if upgrading an existing database.

## v4 Update
- Profile page now shows already-uploaded ID card front/back previews and supports reupload.
- Admin user table now shows clickable ID card thumbnails.
- Product and service listings now support bKash receiver number and money-sending note.
- bKash number/note are shown to buyers/students when choosing bKash.
- Received product orders and service bookings have improved card layout with requester profile picture.
- Navbar is simplified with a profile avatar pill; order/booking pages moved to a left quick menu with badges.
- Notification badges now include My Orders and My Bookings.
- Product/service images use contain-based preview and clickable full-view modals.

Run `database/upgrade_existing_database.sql` once if upgrading an existing database.
