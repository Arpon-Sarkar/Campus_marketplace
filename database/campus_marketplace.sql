CREATE DATABASE IF NOT EXISTS campus_marketplace;
USE campus_marketplace;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS temp_registrations;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'seller', 'service_provider', 'admin') DEFAULT 'student',
  phone VARCHAR(30) UNIQUE,
  student_id VARCHAR(50) UNIQUE,
  department VARCHAR(100),
  semester VARCHAR(50),
  verification_status ENUM('pending', 'verified', 'rejected', 'blocked') DEFAULT 'pending',
  phone_verified BOOLEAN DEFAULT FALSE,
  profile_image LONGTEXT,
  id_card_front LONGTEXT,
  id_card_back LONGTEXT,
  pending_phone VARCHAR(30),
  phone_change_code VARCHAR(10),
  phone_change_expires DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE temp_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'seller', 'service_provider') DEFAULT 'student',
  phone VARCHAR(30) UNIQUE NOT NULL,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(100),
  semester VARCHAR(50),
  id_card_front LONGTEXT,
  id_card_back LONGTEXT,
  phone_otp VARCHAR(10) NOT NULL,
  phone_otp_expires DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(100),
  product_image LONGTEXT,
  bkash_number VARCHAR(30),
  payment_note TEXT,
  quantity INT NOT NULL DEFAULT 1,
  sold_quantity INT NOT NULL DEFAULT 0,
  status ENUM('pending', 'active', 'sold', 'rejected', 'hidden') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_image LONGTEXT,
  service_file_data LONGTEXT,
  service_file_name VARCHAR(255),
  service_file_type VARCHAR(120),
  bkash_number VARCHAR(30),
  payment_note TEXT,
  status ENUM('pending', 'active', 'unavailable', 'rejected', 'hidden') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  buyer_id INT,
  product_id INT,
  buyer_phone VARCHAR(30),
  delivery_type VARCHAR(80),
  delivery_location VARCHAR(120),
  delivery_address TEXT,
  payment_method ENUM('Cash on Delivery', 'bKash') DEFAULT 'Cash on Delivery',
  sender_number VARCHAR(30),
  transaction_id VARCHAR(100),
  payment_status ENUM('unpaid', 'pending_verification', 'paid', 'failed', 'refunded') DEFAULT 'unpaid',
  delivery_charge DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  note TEXT,
  status ENUM('pending_seller_approval', 'seller_approved', 'processing', 'awaiting_buyer_confirmation', 'completed', 'issue_reported', 'seller_rejected', 'cancelled') DEFAULT 'pending_seller_approval',
  contact_visible BOOLEAN DEFAULT FALSE,
  delivery_status ENUM('not_started', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled') DEFAULT 'not_started',
  issue_category VARCHAR(120),
  issue_details TEXT,
  issue_image LONGTEXT,
  issue_status ENUM('open', 'reviewing', 'resolved') DEFAULT 'open',
  issue_reported_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  service_id INT,
  requester_phone VARCHAR(30),
  preferred_contact ENUM('Phone','Email') DEFAULT 'Phone',
  meeting_location VARCHAR(120),
  booking_note TEXT,
  requested_datetime VARCHAR(100),
  payment_method ENUM('Cash', 'bKash') DEFAULT 'Cash',
  sender_number VARCHAR(30),
  transaction_id VARCHAR(100),
  payment_status ENUM('unpaid', 'pending_verification', 'paid', 'failed', 'refunded') DEFAULT 'unpaid',
  provider_approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
  status ENUM('pending_provider_approval', 'provider_approved', 'processing', 'service_done', 'completed', 'issue_reported', 'provider_rejected', 'cancelled') DEFAULT 'pending_provider_approval',
  contact_visible BOOLEAN DEFAULT FALSE,
  issue_category VARCHAR(120),
  issue_details TEXT,
  issue_image LONGTEXT,
  issue_status ENUM('open', 'reviewing', 'resolved') DEFAULT 'open',
  issue_reported_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  product_id INT NULL,
  service_id INT NULL,
  order_id INT NULL,
  booking_id INT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  review_image LONGTEXT,
  status ENUM('approved', 'hidden', 'rejected') DEFAULT 'approved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  link_url VARCHAR(150),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Default admin account for testing
-- Email: admin@vu.edu.bd
-- Password: admin123
-- The first successful login will automatically upgrade this old demo password into a secure hash.
INSERT INTO users (name, email, password, role, phone, student_id, department, semester, verification_status, phone_verified)
VALUES ('System Admin', 'admin@vu.edu.bd', 'admin123', 'admin', '01700000000', 'ADMIN-001', 'Administration', 'N/A', 'verified', TRUE);
