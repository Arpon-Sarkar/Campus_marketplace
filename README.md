# Campus Marketplace & Skill Exchange Web Application

A campus-based e-commerce and service exchange web application for verified university students.

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MySQL
- Tools: VS Code, Git, XAMPP/phpMyAdmin

## Project Structure

campus-marketplace/
├── frontend/
├── backend/
│   └── routes/
└── database/

## How to Open in VS Code
1. Download and unzip this folder.
2. Open VS Code.
3. Click File > Open Folder.
4. Select the `campus-marketplace` folder.

## Next Step
Start by editing `frontend/index.html` and `frontend/style.css`.


# Campus Marketplace Upgrade Notes

This upgraded version implements the main items from the project report:

## Implemented
- User registration now collects phone, student ID, department, semester, and verification status.
- Admin manual verification workflow.
- Protected frontend pages with login check.
- Admin-only admin page.
- Product and service posts are now `pending` first, then admin can approve/reject.
- Product order workflow with:
  - phone
  - delivery location/address
  - Rajshahi/VU delivery charge
  - payment method
  - bKash sender number and transaction ID
  - payment status
  - hidden buyer contact until admin approves order
- Seller received orders page: `seller-orders.html`.
- Service booking workflow with requester phone, contact method, meeting location, requested time, and hidden contact until approval.
- In-website notification system and `notifications.html`.
- Reviews connected to completed product orders or completed service bookings.
- Admin review approval before reviews show publicly.
- Product/service cards now show average rating, review count, and rule-based review summary.
- Product and service search/filter/sort improvements.
- Profile page for user information update.

## Default Admin
Email: `admin@vu.edu.bd`
Password: `admin123`

## Setup
1. Open XAMPP and start Apache + MySQL.
2. Open phpMyAdmin.
3. Import `database/campus_marketplace.sql`.
   - Warning: this SQL resets the project database tables. Back up old data first if needed.
4. Open terminal in `backend`.
5. Run:
   ```bash
   npm install
   npm start
   ```
6. Open frontend pages in browser.

## Testing Flow
1. Register a normal user.
2. Login as admin using `admin@vu.edu.bd` / `admin123`.
3. Verify the registered user from Admin Dashboard.
4. Login as verified user.
5. Add product/service.
6. Admin approves product/service.
7. Buyer orders product or books service.
8. Admin approves order/booking and verifies payment.
9. Seller/provider sees contact only after approval.
10. Admin completes order/booking.
11. Buyer/requester reviews.
12. Admin approves review.

## Latest Academic Completion Update
This version adds several free-resource improvements for semester submission:
- Secure password hashing using Node.js built-in `crypto` module. Old plain-text demo passwords still work and are upgraded automatically after successful login.
- Backend admin verification added to key admin actions such as user verification, product/service approval, review moderation, and issue handling.
- Product image upload added using free base64/local database storage for academic demo.
- Service/portfolio image upload added using the same free approach.
- Product/service cards and details pages now show images or a clean placeholder.
- Admin panel now shows thumbnails for product/service images.
- Duplicate review prevention added for completed orders/bookings.
- Product automatically becomes `sold` after buyer confirms receiving the order.

## Important for Existing Database
If you already imported the old database and want to keep data, run this file once in phpMyAdmin:

```sql
database/upgrade_existing_database.sql
```

For a fresh demo database, import:

```sql
database/campus_marketplace.sql
```
