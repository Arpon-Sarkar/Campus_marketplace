const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');


function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function isPasswordHash(value) {
  return String(value || '').startsWith('pbkdf2$');
}

function verifyPassword(inputPassword, storedPassword) {
  const stored = String(storedPassword || '');
  if (!isPasswordHash(stored)) return String(inputPassword) === stored; // supports old demo accounts

  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const originalHash = parts[3];
  const inputHash = crypto.pbkdf2Sync(String(inputPassword), salt, iterations, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function requireAdmin(req, res, next) {
  const adminId = req.body.admin_id || req.query.admin_id || req.headers['x-admin-id'];
  if (!adminId) return res.status(403).json({ message: 'Admin verification is required.' });
  db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [adminId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Admin check failed', error: err.message });
    if (!rows.length || rows[0].role !== 'admin') return res.status(403).json({ message: 'Only admin can perform this action.' });
    next();
  });
}

function canViewUserPrivateDocs(req, targetUserId, callback) {
  const requesterId = req.body.user_id || req.query.user_id || req.headers['x-user-id'] || req.body.admin_id || req.query.admin_id || req.headers['x-admin-id'];
  if (!requesterId) return callback(null, false);

  db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [requesterId], (err, rows) => {
    if (err) return callback(err);
    const isAdmin = rows.length && rows[0].role === 'admin';
    const isSelf = Number(requesterId) === Number(targetUserId);
    callback(null, Boolean(isAdmin || isSelf));
  });
}

function notify(userId, message, type = 'info', linkUrl = 'notifications.html') {
  if (!userId) return;
  db.query(
    'INSERT INTO notifications (user_id, message, type, link_url) VALUES (?, ?, ?, ?)',
    [userId, message, type, linkUrl],
    () => {}
  );
}

function normalizePhone(phone) {
  return String(phone || '').trim().replace(/\s+/g, '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function duplicateMessage(err) {
  const msg = String(err && err.message ? err.message : '').toLowerCase();
  if (msg.includes('email')) return 'This email is already registered. Please use another email or login.';
  if (msg.includes('phone')) return 'This phone number is already registered. Please use another phone number.';
  if (msg.includes('student_id')) return 'This Student ID / Campus ID is already registered.';
  return 'This account information already exists. Please use unique email, phone, and student ID.';
}

// Get all users for admin table.
// Important: do NOT return full ID card images here.
// Large Base64 images can crash/reset MySQL connection.
router.get("/", requireAdmin, (req, res) => {
  const sql = `
    SELECT 
      id, 
      name, 
      email, 
      role, 
      phone, 
      student_id, 
      department, 
      semester, 
      verification_status, 
      phone_verified, 
      profile_image,
      CASE WHEN id_card_front IS NOT NULL AND id_card_front <> '' THEN 1 ELSE 0 END AS has_id_card_front,
      CASE WHEN id_card_back IS NOT NULL AND id_card_back <> '' THEN 1 ELSE 0 END AS has_id_card_back,
      created_at
    FROM users
    ORDER BY id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Failed to fetch users",
        error: err.message
      });
    }

    res.json(results);
  });
});

// Admin can load a user's ID card images only when needed.
// The user can also load only their own ID cards for the profile page.
// This avoids sending huge Base64 images in the full users table or login response.
router.get("/:id/id-documents", (req, res) => {
  const userId = req.params.id;

  canViewUserPrivateDocs(req, userId, (authErr, allowed) => {
    if (authErr) return res.status(500).json({ message: 'Private document permission check failed', error: authErr.message });
    if (!allowed) return res.status(403).json({ message: 'You can view only your own ID documents. Admin can view all.' });

    const sql = `
      SELECT 
        id, 
        name, 
        id_card_front, 
        id_card_back
      FROM users
      WHERE id = ?
      LIMIT 1
    `;

    db.query(sql, [userId], (err, rows) => {
      if (err) {
        return res.status(500).json({
          message: "Failed to fetch ID documents",
          error: err.message
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      res.json(rows[0]);
    });
  });
});

// Step 1: Start registration and generate demo OTP.
// Important: no final user account is created here. It is kept in temp_registrations until OTP is verified.
router.post('/register', (req, res) => {
  let { name, email, password, role, phone, student_id, department, semester, id_card_front, id_card_back } = req.body;

  name = String(name || '').trim();
  email = normalizeEmail(email);
  phone = normalizePhone(phone);
  student_id = String(student_id || '').trim();
  department = String(department || '').trim();
  semester = String(semester || '').trim();

  if (!name || !email || !password || !role || !phone || !student_id || !department || !semester) {
    return res.status(400).json({ message: 'All fields are required, including phone and campus information.' });
  }

  if (!id_card_front || !id_card_back) {
    return res.status(400).json({ message: 'ID card front and back images are required for account verification.' });
  }

  if (!/^01\d{9}$/.test(phone)) {
    return res.status(400).json({ message: 'Enter a valid Bangladesh phone number like 01XXXXXXXXX.' });
  }

  if (!['student', 'seller', 'service_provider'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role selected.' });
  }

  db.query(
    'SELECT email, phone, student_id FROM users WHERE email = ? OR phone = ? OR student_id = ? LIMIT 1',
    [email, phone, student_id],
    (checkErr, existing) => {
      if (checkErr) return res.status(500).json({ message: 'Registration check failed', error: checkErr.message });

      if (existing.length) {
        const row = existing[0];
        if (row.email === email) return res.status(409).json({ message: 'This email is already registered. Please use another email or login.' });
        if (row.phone === phone) return res.status(409).json({ message: 'This phone number is already registered. Please use another phone number.' });
        if (row.student_id === student_id) return res.status(409).json({ message: 'This Student ID / Campus ID is already registered.' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Remove older unverified temp entry for same email/phone/student id, then create a fresh OTP.
      db.query('DELETE FROM temp_registrations WHERE email = ? OR phone = ? OR student_id = ?', [email, phone, student_id], (deleteErr) => {
        if (deleteErr) return res.status(500).json({ message: 'Could not prepare OTP registration', error: deleteErr.message });

        const sql = `
          INSERT INTO temp_registrations
          (name, email, password, role, phone, student_id, department, semester, id_card_front, id_card_back, phone_otp, phone_otp_expires)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
        `;

        db.query(sql, [name, email, hashPassword(password), role, phone, student_id, department, semester, id_card_front || null, id_card_back || null, otp], (err, result) => {
          if (err) return res.status(500).json({ message: duplicateMessage(err), error: err.message });

          res.status(201).json({
            message: 'OTP generated. Verify your phone number to create your account.',
            pendingRegistrationId: result.insertId,
            demo_otp: otp
          });
        });
      });
    }
  );
});

// Step 2: Verify OTP and create final user account.
router.post('/verify-phone', (req, res) => {
  const { pending_registration_id, user_id, otp } = req.body;
  const pendingId = pending_registration_id || user_id; // backward compatibility with older frontend variable names

  if (!pendingId || !otp) return res.status(400).json({ message: 'Pending registration ID and OTP are required.' });

  db.query('SELECT * FROM temp_registrations WHERE id = ?', [pendingId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'OTP verification failed', error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Pending registration not found. Please register again.' });

    const pending = rows[0];

    if (pending.phone_otp !== String(otp).trim()) return res.status(400).json({ message: 'Invalid OTP. Check the demo OTP shown on the page and try again.' });
    if (new Date(pending.phone_otp_expires).getTime() < Date.now()) return res.status(400).json({ message: 'OTP expired. Please register again to get a new OTP.' });

    db.query(
      'SELECT email, phone, student_id FROM users WHERE email = ? OR phone = ? OR student_id = ? LIMIT 1',
      [pending.email, pending.phone, pending.student_id],
      (checkErr, existing) => {
        if (checkErr) return res.status(500).json({ message: 'Final registration check failed', error: checkErr.message });
        if (existing.length) return res.status(409).json({ message: 'This email, phone, or Student ID has already been registered.' });

        const insertSql = `
          INSERT INTO users
          (name, email, password, role, phone, student_id, department, semester, id_card_front, id_card_back, verification_status, phone_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', TRUE)
        `;

        db.query(
          insertSql,
          [pending.name, pending.email, pending.password, pending.role, pending.phone, pending.student_id, pending.department, pending.semester, pending.id_card_front || null, pending.id_card_back || null],
          (insertErr, result) => {
            if (insertErr) return res.status(500).json({ message: duplicateMessage(insertErr), error: insertErr.message });

            db.query('DELETE FROM temp_registrations WHERE id = ?', [pendingId], () => {});
            res.status(201).json({
              message: 'Phone verified and account created successfully. Please wait for admin approval before login.',
              userId: result.insertId
            });
          }
        );
      }
    );
  });
});

// Login user
router.post('/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const sql = `
  SELECT 
    id, 
    name, 
    email, 
    password, 
    role, 
    phone, 
    student_id, 
    department, 
    semester, 
    verification_status, 
    phone_verified, 
    profile_image,
    CASE WHEN id_card_front IS NOT NULL AND id_card_front <> '' THEN 1 ELSE 0 END AS has_id_card_front,
    CASE WHEN id_card_back IS NOT NULL AND id_card_back <> '' THEN 1 ELSE 0 END AS has_id_card_back
  FROM users
  WHERE email = ?
  LIMIT 1
`;

  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Login failed', error: err.message });
    if (results.length === 0 || !verifyPassword(password, results[0].password)) return res.status(401).json({ message: 'Invalid email or password' });

    // Automatically upgrade old plain-text demo passwords to hashed passwords after successful login.
    if (!isPasswordHash(results[0].password)) {
      db.query('UPDATE users SET password = ? WHERE id = ?', [hashPassword(password), results[0].id], () => {});
    }
    delete results[0].password;
    if (!results[0].phone_verified) return res.status(403).json({ message: 'Please verify your phone number before login.' });
    if (results[0].verification_status === 'blocked') return res.status(403).json({ message: 'Your account is blocked. Contact admin.' });
    if (results[0].verification_status !== 'verified' && results[0].role !== 'admin') {
      return res.status(403).json({ message: 'Your phone is verified, but admin approval is still pending.' });
    }

    res.json({ message: 'Login successful', user: results[0] });
  });
});

// Request demo OTP before changing phone number. For academic demo, the code is returned in response.
router.post('/:id/request-phone-change', (req, res) => {
  const userId = req.params.id;
  const cleanPhone = normalizePhone(req.body.new_phone);

  if (!/^01\d{9}$/.test(cleanPhone)) return res.status(400).json({ message: 'Enter a valid Bangladesh phone number like 01XXXXXXXXX.' });

  db.query('SELECT id, phone FROM users WHERE id = ? LIMIT 1', [userId], (userErr, users) => {
    if (userErr) return res.status(500).json({ message: 'Phone change check failed', error: userErr.message });
    if (!users.length) return res.status(404).json({ message: 'User not found.' });
    if (users[0].phone === cleanPhone) return res.json({ message: 'Phone number is unchanged.' });

    db.query('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1', [cleanPhone, userId], (dupErr, existing) => {
      if (dupErr) return res.status(500).json({ message: 'Duplicate phone check failed', error: dupErr.message });
      if (existing.length) return res.status(409).json({ message: 'This phone number is already used by another account.' });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      db.query(
        'UPDATE users SET pending_phone = ?, phone_change_code = ?, phone_change_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
        [cleanPhone, code, userId],
        (err) => {
          if (err) return res.status(500).json({ message: 'Failed to generate verification code', error: err.message });
          res.json({
            message: 'Demo verification code generated for your old phone number. In a real SMS system, this code would be sent to your old phone.',
            demo_code: code,
            old_phone: users[0].phone,
            pending_phone: cleanPhone
          });
        }
      );
    });
  });
});

// Update profile. If phone is changed, old-phone demo verification code is required.
router.put('/:id/profile', (req, res) => {
  const userId = req.params.id;
  const { name, phone, student_id, department, semester, profile_image, phone_change_code, id_card_front, id_card_back } = req.body;
  const cleanPhone = normalizePhone(phone);
  const cleanStudentId = String(student_id || '').trim();

  if (!/^01\d{9}$/.test(cleanPhone)) return res.status(400).json({ message: 'Enter a valid Bangladesh phone number like 01XXXXXXXXX.' });

  db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId], (userErr, users) => {
    if (userErr) return res.status(500).json({ message: 'Profile check failed', error: userErr.message });
    if (!users.length) return res.status(404).json({ message: 'User not found.' });

    const oldUser = users[0];
    const phoneChanged = cleanPhone !== oldUser.phone;

    if (phoneChanged) {
      if (!phone_change_code) return res.status(403).json({ message: 'Phone change verification code is required. Click Generate Code first.' });
      if (oldUser.pending_phone !== cleanPhone || oldUser.phone_change_code !== String(phone_change_code).trim()) {
        return res.status(403).json({ message: 'Invalid phone change verification code.' });
      }
      if (!oldUser.phone_change_expires || new Date(oldUser.phone_change_expires).getTime() < Date.now()) {
        return res.status(403).json({ message: 'Phone change code expired. Generate a new code.' });
      }
    }

    db.query('SELECT id FROM users WHERE (phone = ? OR student_id = ?) AND id <> ? LIMIT 1', [cleanPhone, cleanStudentId, userId], (checkErr, existing) => {
      if (checkErr) return res.status(500).json({ message: 'Profile duplicate check failed', error: checkErr.message });
      if (existing.length) return res.status(409).json({ message: 'Phone number or Student ID is already used by another account.' });

      const sql = `
        UPDATE users
        SET name = ?, phone = ?, student_id = ?, department = ?, semester = ?, profile_image = ?,
            id_card_front = COALESCE(?, id_card_front), id_card_back = COALESCE(?, id_card_back),
            pending_phone = NULL, phone_change_code = NULL, phone_change_expires = NULL
        WHERE id = ?
      `;

      db.query(sql, [String(name || '').trim(), cleanPhone, cleanStudentId, department, semester, profile_image || null, id_card_front || null, id_card_back || null, userId], (err) => {
        if (err) return res.status(500).json({ message: duplicateMessage(err), error: err.message });

        db.query(
          `SELECT 
            id, 
            name, 
            email, 
            role, 
            phone, 
            student_id, 
            department, 
            semester, 
            verification_status, 
            phone_verified, 
            profile_image,
            CASE WHEN id_card_front IS NOT NULL AND id_card_front <> '' THEN 1 ELSE 0 END AS has_id_card_front,
            CASE WHEN id_card_back IS NOT NULL AND id_card_back <> '' THEN 1 ELSE 0 END AS has_id_card_back
          FROM users 
          WHERE id = ?`,

          [userId],
          (readErr, rows) => {
            if (readErr) return res.status(500).json({ message: 'Profile updated, but failed to reload user', error: readErr.message });
            res.json({ message: 'Profile updated successfully', user: rows[0] });
          }
        );
      });
    });
  });
});

// Public seller/provider profile. Private data like phone, email, student ID and ID card images are hidden.
router.get('/public/:id', (req, res) => {
  const userId = req.params.id;
  const profileSql = `
    SELECT
      users.id,
      users.name,
      users.role,
      users.department,
      users.semester,
      users.verification_status,
      users.profile_image,
      users.created_at,
      (SELECT COUNT(*) FROM products WHERE user_id = users.id AND status IN ('active','sold')) AS total_products,
      (SELECT COUNT(*) FROM services WHERE user_id = users.id AND status = 'active') AS total_services,
      (SELECT COALESCE(ROUND(AVG(r.rating), 1), 0)
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE r.status = 'approved' AND (p.user_id = users.id OR s.user_id = users.id)) AS avg_rating,
      (SELECT COUNT(r.id)
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE r.status = 'approved' AND (p.user_id = users.id OR s.user_id = users.id)) AS review_count
    FROM users
    WHERE users.id = ?
    LIMIT 1
  `;
  db.query(profileSql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch public profile', error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });
    res.json(rows[0]);
  });
});

router.get('/public/:id/listings', (req, res) => {
  const userId = req.params.id;
  const sqlProducts = `SELECT id, title, price, category, product_image, status, quantity, sold_quantity FROM products WHERE user_id = ? AND status IN ('active','sold') ORDER BY id DESC LIMIT 8`;
  const sqlServices = `SELECT id, title, price, category, service_image, status FROM services WHERE user_id = ? AND status IN ('active','unavailable') ORDER BY id DESC LIMIT 8`;
  db.query(sqlProducts, [userId], (pErr, products) => {
    if (pErr) return res.status(500).json({ message: 'Failed to fetch public products', error: pErr.message });
    db.query(sqlServices, [userId], (sErr, services) => {
      if (sErr) return res.status(500).json({ message: 'Failed to fetch public services', error: sErr.message });
      res.json({ products, services });
    });
  });
});

// Admin update user status or role
router.put('/:id/admin', requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { verification_status, role } = req.body;

  if (!verification_status && !role) return res.status(400).json({ message: 'Status or role is required' });

  const updates = [];
  const values = [];

  if (verification_status) {
    updates.push('verification_status = ?');
    values.push(verification_status);
  }

  if (role) {
    updates.push('role = ?');
    values.push(role);
  }

  values.push(userId);

  db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update user', error: err.message });

    if (verification_status) notify(userId, `Your account verification status is now ${verification_status}.`, 'verification', 'notifications.html');
    res.json({ message: 'User updated successfully' });
  });
});

module.exports = router;


// Logged-in user can load their own ID card images for profile preview.
router.get("/:id/my-id-documents", (req, res) => {
  const userId = req.params.id;

  const sql = `
    SELECT 
      id_card_front, 
      id_card_back
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({
        message: "Failed to fetch your ID documents",
        error: err.message
      });
    }

    if (!rows.length) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json(rows[0]);
  });
});

