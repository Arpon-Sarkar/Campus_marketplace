USE campus_marketplace;

CREATE TABLE IF NOT EXISTS temp_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'seller', 'service_provider') DEFAULT 'student',
  phone VARCHAR(30) UNIQUE NOT NULL,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(100),
  semester VARCHAR(50),
  phone_otp VARCHAR(10) NOT NULL,
  phone_otp_expires DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image LONGTEXT NULL;
UPDATE users SET phone_verified = TRUE WHERE role = 'admin' OR phone_verified IS NULL;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url VARCHAR(150) NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
UPDATE notifications SET is_read = FALSE WHERE is_read IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS issue_category VARCHAR(120) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS issue_details TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS issue_image LONGTEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS issue_status ENUM('open', 'reviewing', 'resolved') DEFAULT 'open';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS issue_reported_at TIMESTAMP NULL;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS issue_category VARCHAR(120) NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS issue_details TEXT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS issue_image LONGTEXT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS issue_status ENUM('open', 'reviewing', 'resolved') DEFAULT 'open';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS issue_reported_at TIMESTAMP NULL;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_image LONGTEXT NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status ENUM('approved', 'hidden', 'rejected') DEFAULT 'approved';

-- Add uniqueness. If this fails, remove duplicate users first.
ALTER TABLE users ADD UNIQUE KEY IF NOT EXISTS uniq_users_email (email);
ALTER TABLE users ADD UNIQUE KEY IF NOT EXISTS uniq_users_phone (phone);
ALTER TABLE users ADD UNIQUE KEY IF NOT EXISTS uniq_users_student_id (student_id);


-- Academic completion update: images for marketplace/service cards
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_image LONGTEXT NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_image LONGTEXT NULL;

-- Prevent repeated reviews for the same completed order or booking.
ALTER TABLE reviews ADD UNIQUE KEY IF NOT EXISTS uniq_review_order (order_id);
ALTER TABLE reviews ADD UNIQUE KEY IF NOT EXISTS uniq_review_booking (booking_id);


-- Latest academic update: ID verification, phone change verification, quantity stock system
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_front LONGTEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_back LONGTEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_phone VARCHAR(30) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_change_code VARCHAR(10) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_change_expires DATETIME NULL;

ALTER TABLE temp_registrations ADD COLUMN IF NOT EXISTS id_card_front LONGTEXT NULL;
ALTER TABLE temp_registrations ADD COLUMN IF NOT EXISTS id_card_back LONGTEXT NULL;

ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_quantity INT NOT NULL DEFAULT 0;
UPDATE products SET quantity = 1 WHERE quantity IS NULL OR quantity < 1;
UPDATE products SET sold_quantity = 0 WHERE sold_quantity IS NULL OR sold_quantity < 0;


-- Service portfolio/CV/file support and availability status
ALTER TABLE services MODIFY COLUMN status ENUM('pending', 'active', 'unavailable', 'rejected', 'hidden') DEFAULT 'pending';
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_file_data LONGTEXT NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_file_name VARCHAR(255) NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_file_type VARCHAR(120) NULL;


-- v4 payment receiver info and ID/profile UI support
ALTER TABLE products ADD COLUMN IF NOT EXISTS bkash_number VARCHAR(30) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_note TEXT NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS bkash_number VARCHAR(30) NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_note TEXT NULL;
