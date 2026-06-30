const express = require('express');
const router = express.Router();
const db = require('../db');


function requireAdmin(req, res, next) {
  const adminId = req.body.admin_id || req.query.admin_id || req.headers['x-admin-id'];
  if (!adminId) return res.status(403).json({ message: 'Admin verification is required.' });
  db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [adminId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Admin check failed', error: err.message });
    if (!rows.length || rows[0].role !== 'admin') return res.status(403).json({ message: 'Only admin can perform this action.' });
    next();
  });
}

function notify(userId, message, type = 'info') {
  if (!userId) return;
  db.query(
    'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
    [userId, message, type],
    () => {}
  );
}

// Get products. Public users see active products; admin can pass ?all=true
router.get('/', (req, res) => {
  const showAll = req.query.all === 'true' && req.query.admin_id;

  const sql = `
    SELECT 
      products.*,
      GREATEST(COALESCE(products.quantity, 1) - COALESCE(products.sold_quantity, 0), 0) AS remaining_quantity,
      users.name AS seller_name,
      users.profile_image AS seller_profile_image,
      COALESCE(review_stats.avg_rating, 0) AS avg_rating,
      COALESCE(review_stats.review_count, 0) AS review_count
    FROM products
    LEFT JOIN users ON products.user_id = users.id
    LEFT JOIN (
      SELECT product_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
      FROM reviews
      WHERE status = 'approved' AND product_id IS NOT NULL
      GROUP BY product_id
    ) review_stats ON review_stats.product_id = products.id
    ${showAll ? '' : "WHERE products.status IN ('active','sold')"}
    ORDER BY products.id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch products',
        error: err.message
      });
    }

    res.json(results);
  });
});


// Get one product with seller and rating details
router.get('/:id', (req, res) => {
  const sql = `
    SELECT products.*, GREATEST(COALESCE(products.quantity, 1) - COALESCE(products.sold_quantity, 0), 0) AS remaining_quantity, users.name AS seller_name, users.email AS seller_email, users.profile_image AS seller_profile_image,
      COALESCE(review_stats.avg_rating, 0) AS avg_rating,
      COALESCE(review_stats.review_count, 0) AS review_count
    FROM products
    LEFT JOIN users ON products.user_id = users.id
    LEFT JOIN (
      SELECT product_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
      FROM reviews
      WHERE status = 'approved' AND product_id IS NOT NULL
      GROUP BY product_id
    ) review_stats ON review_stats.product_id = products.id
    WHERE products.id = ?
  `;
  db.query(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch product', error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  });
});

// Add new product.
// Admin product = active automatically.
// Normal verified user product = pending until admin approval.
router.post('/add', (req, res) => {
  const { user_id, title, description, price, category, product_image, quantity, bkash_number, payment_note } = req.body;

  if (!user_id || !title || !description || !price || !category) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query(
    'SELECT role, verification_status FROM users WHERE id = ?',
    [user_id],
    (userErr, users) => {
      if (userErr) {
        return res.status(500).json({
          message: 'User check failed',
          error: userErr.message
        });
      }

      if (!users.length) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = users[0];
      console.log('Product adding user:', user);
      
      const isAdmin = user.role === 'admin';

      if (!isAdmin && user.verification_status !== 'verified') {
        return res.status(403).json({
          message: 'Only verified campus users can add products.'
        });
      }

      const status = isAdmin ? 'active' : 'pending';

      const sql = `
        INSERT INTO products (user_id, title, description, price, category, product_image, bkash_number, payment_note, quantity, sold_quantity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `;

      db.query(
        sql,
        [user_id, title, description, price, category, product_image || null, bkash_number || null, payment_note || null, Math.max(1, Number(quantity || 1)), status],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: 'Failed to add product',
              error: err.message
            });
          }

          if (isAdmin) {
            notify(user_id, 'Your product was added and approved automatically.', 'product');

            return res.status(201).json({
              message: 'Product added successfully and approved automatically',
              productId: result.insertId,
              status
            });
          }

          notify(user_id, 'Your product was submitted and is waiting for admin approval.', 'product');

          res.status(201).json({
            message: 'Product submitted for admin approval',
            productId: result.insertId,
            status
          });
        }
      );
    }
  );
});


// Update own product. Keep the current listing status so an approved item does not disappear after editing.
router.put('/:id', (req, res) => {
  const productId = req.params.id;
  const { user_id, title, description, price, category, product_image, quantity, bkash_number, payment_note } = req.body;

  if (!user_id || !title || !description || !price || !category) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query('SELECT user_id, status FROM products WHERE id = ? LIMIT 1', [productId], (readErr, rows) => {
    if (readErr) return res.status(500).json({ message: 'Product check failed', error: readErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });
    if (Number(rows[0].user_id) !== Number(user_id)) return res.status(403).json({ message: 'You can edit only your own product.' });

    const sql = `
      UPDATE products
      SET title = ?, description = ?, price = ?, category = ?, product_image = ?, bkash_number = ?, payment_note = ?, quantity = ?, status = ?
      WHERE id = ?
    `;
    const currentStatus = rows[0].status || 'pending';
    db.query(sql, [title, description, price, category, product_image || null, bkash_number || null, payment_note || null, Math.max(1, Number(quantity || 1)), currentStatus, productId], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update product', error: err.message });
      notify(user_id, 'Your product details were updated successfully.', 'product');
      res.json({ message: 'Product updated successfully.' });
    });
  });
});

// Update product status by admin
router.put('/:id/status', requireAdmin, (req, res) => {
  const productId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  db.query(
    'UPDATE products SET status = ? WHERE id = ?',
    [status, productId],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: 'Failed to update product status',
          error: err.message
        });
      }

      db.query(
        'SELECT user_id, title FROM products WHERE id = ?',
        [productId],
        (readErr, rows) => {
          if (!readErr && rows.length) {
            notify(
              rows[0].user_id,
              `Your product "${rows[0].title}" status is now ${status}.`,
              'product'
            );
          }
        }
      );

      res.json({ message: 'Product status updated successfully' });
    }
  );
});

// Update product quantity only. Owner can quickly change stock without editing whole listing.
router.put('/:id/quantity', (req, res) => {
  const productId = req.params.id;
  const { user_id, quantity } = req.body;
  const cleanQuantity = Math.max(1, Number(quantity || 1));
  if (!user_id) return res.status(400).json({ message: 'User ID is required.' });

  db.query('SELECT user_id, sold_quantity FROM products WHERE id = ? LIMIT 1', [productId], (readErr, rows) => {
    if (readErr) return res.status(500).json({ message: 'Product check failed', error: readErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });
    if (Number(rows[0].user_id) !== Number(user_id)) return res.status(403).json({ message: 'You can update only your own product quantity.' });
    if (cleanQuantity < Number(rows[0].sold_quantity || 0)) return res.status(400).json({ message: 'Quantity cannot be less than already sold quantity.' });

    const newStatus = cleanQuantity > Number(rows[0].sold_quantity || 0) ? 'active' : 'sold';
    db.query('UPDATE products SET quantity = ?, status = ? WHERE id = ?', [cleanQuantity, newStatus, productId], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update quantity', error: err.message });
      res.json({ message: 'Product quantity updated successfully.' });
    });
  });
});

// Delete product. Owner or admin only.
router.delete('/:id', (req, res) => {
  const userId = req.query.user_id || req.body.user_id;
  if (!userId) return res.status(400).json({ message: 'User ID is required.' });
  db.query('SELECT products.user_id, users.role FROM products LEFT JOIN users ON users.id = ? WHERE products.id = ? LIMIT 1', [userId, req.params.id], (readErr, rows) => {
    if (readErr) return res.status(500).json({ message: 'Product check failed', error: readErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Product not found.' });
    if (Number(rows[0].user_id) !== Number(userId) && rows[0].role !== 'admin') return res.status(403).json({ message: 'You can delete only your own product.' });
    db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to delete product', error: err.message });
      res.json({ message: 'Product deleted successfully' });
    });
  });
});

module.exports = router;