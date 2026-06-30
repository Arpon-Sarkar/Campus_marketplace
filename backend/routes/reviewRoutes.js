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

function notify(userId, message, type = 'info', linkUrl = null) {
  if (!userId) return;
  db.query('INSERT INTO notifications (user_id, message, type, link_url) VALUES (?, ?, ?, ?)', [userId, message, type, linkUrl], () => {});
}

const baseSelect = `
  SELECT 
    reviews.*,
    users.name AS reviewer_name,
    users.email AS reviewer_email,
    users.profile_image AS reviewer_profile_image,
    products.title AS product_title,
    services.title AS service_title
  FROM reviews
  LEFT JOIN users ON reviews.user_id = users.id
  LEFT JOIN products ON reviews.product_id = products.id
  LEFT JOIN services ON reviews.service_id = services.id
`;

// Get all reviews for admin/reviews page
router.get('/', (req, res) => {
  db.query(`${baseSelect} ORDER BY reviews.id DESC`, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch reviews', error: err.message });
    res.json(results);
  });
});

// Full public product reviews
router.get('/product/:product_id', (req, res) => {
  const sql = `${baseSelect} WHERE reviews.product_id = ? AND reviews.status = 'approved' ORDER BY reviews.id DESC`;
  db.query(sql, [req.params.product_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch product reviews', error: err.message });
    res.json(results);
  });
});

// Full public service reviews
router.get('/service/:service_id', (req, res) => {
  const sql = `${baseSelect} WHERE reviews.service_id = ? AND reviews.status = 'approved' ORDER BY reviews.id DESC`;
  db.query(sql, [req.params.service_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch service reviews', error: err.message });
    res.json(results);
  });
});

// Public reviews received by a seller/provider across their products and services.
router.get('/received-by-user/:user_id', (req, res) => {
  const sql = `
    ${baseSelect}
    WHERE reviews.status = 'approved'
      AND (products.user_id = ? OR services.user_id = ?)
    ORDER BY reviews.id DESC
  `;
  db.query(sql, [req.params.user_id, req.params.user_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch seller reviews', error: err.message });
    res.json(results);
  });
});

// Review summary for one product
router.get('/product/:product_id/summary', (req, res) => {
  const productId = req.params.product_id;
  const sql = `
    SELECT COALESCE(ROUND(AVG(rating), 1), 0) AS avg_rating, COUNT(*) AS total_reviews
    FROM reviews
    WHERE product_id = ? AND status = 'approved'
  `;
  db.query(sql, [productId], (err, summaryRows) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch review summary', error: err.message });
    db.query(
      `SELECT rating, comment, review_image, created_at FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 3`,
      [productId],
      (listErr, reviews) => {
        if (listErr) return res.status(500).json({ message: 'Failed to fetch recent reviews', error: listErr.message });
        const avg = Number(summaryRows[0].avg_rating || 0);
        let summaryText = 'No approved reviews yet.';
        if (avg >= 4.5) summaryText = 'Excellent feedback from buyers.';
        else if (avg >= 4.0) summaryText = 'Good buyer satisfaction.';
        else if (avg >= 3.0) summaryText = 'Mixed reviews.';
        else if (avg > 0) summaryText = 'Low satisfaction. Check comments carefully.';
        res.json({ ...summaryRows[0], summary_text: summaryText, recent_reviews: reviews });
      }
    );
  });
});

// Add review. Must be connected to completed order or booking. Auto-published.
router.post('/add', (req, res) => {
  const { user_id, product_id, service_id, order_id, booking_id, rating, comment, review_image } = req.body;

  if (!user_id || !rating || (!product_id && !service_id)) {
    return res.status(400).json({ message: 'User, item, and rating are required. Comment and image are optional.' });
  }

  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ message: 'Please select a rating from 1 to 5.' });
  }

  if (product_id && !order_id) return res.status(400).json({ message: 'Product review requires a completed order.' });
  if (service_id && !booking_id) return res.status(400).json({ message: 'Service review requires a completed booking.' });

  const verifySql = product_id
    ? `SELECT id FROM orders WHERE id = ? AND buyer_id = ? AND product_id = ? AND status IN ('completed', 'issue_reported')`
    : `SELECT id FROM bookings WHERE id = ? AND user_id = ? AND service_id = ? AND status IN ('completed', 'issue_reported')`; 
  const verifyValues = product_id ? [order_id, user_id, product_id] : [booking_id, user_id, service_id];

  db.query(verifySql, verifyValues, (verifyErr, rows) => {
    if (verifyErr) return res.status(500).json({ message: 'Review verification failed', error: verifyErr.message });
    if (!rows.length) return res.status(403).json({ message: 'Only completed or issue-reported orders/bookings can be reviewed.' });

    const duplicateSql = product_id
      ? 'SELECT id FROM reviews WHERE order_id = ? LIMIT 1'
      : 'SELECT id FROM reviews WHERE booking_id = ? LIMIT 1';
    const duplicateValue = product_id ? order_id : booking_id;

    db.query(duplicateSql, [duplicateValue], (dupErr, existingReviews) => {
      if (dupErr) return res.status(500).json({ message: 'Duplicate review check failed', error: dupErr.message });
      if (existingReviews.length) return res.status(409).json({ message: 'You already reviewed this completed order/booking.' });

      const sql = `
        INSERT INTO reviews (user_id, product_id, service_id, order_id, booking_id, rating, comment, review_image, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')
      `;
      db.query(sql, [user_id, product_id || null, service_id || null, order_id || null, booking_id || null, numericRating, comment || null, review_image || null], (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to add review', error: err.message });
        notify(user_id, 'Your review was published successfully.', 'review', 'reviews.html');
        res.status(201).json({ message: 'Review published successfully', reviewId: result.insertId });
      });
    });
  });
});

// Admin moderation: hide, restore/approve, reject
router.put('/:id/status', requireAdmin, (req, res) => {
  const reviewId = req.params.id;
  const { status } = req.body;
  if (!['approved', 'hidden', 'rejected'].includes(status)) return res.status(400).json({ message: 'Use approved, hidden, or rejected.' });

  db.query('UPDATE reviews SET status = ? WHERE id = ?', [status, reviewId], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update review status', error: err.message });
    db.query('SELECT user_id FROM reviews WHERE id = ?', [reviewId], (readErr, rows) => {
      if (!readErr && rows.length) notify(rows[0].user_id, `Your review status is now ${status}.`, 'review', 'reviews.html');
    });
    res.json({ message: 'Review status updated successfully' });
  });
});

// Admin delete review
router.delete('/:id', requireAdmin, (req, res) => {
  db.query('DELETE FROM reviews WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to delete review', error: err.message });
    res.json({ message: 'Review deleted successfully' });
  });
});

module.exports = router;
