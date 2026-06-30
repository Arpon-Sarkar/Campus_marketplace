const express = require('express');
const router = express.Router();
const db = require('../db');

// Get notifications for one user
router.get('/user/:user_id', (req, res) => {
  db.query(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC`,
    [req.params.user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
      res.json(results);
    }
  );
});

// Mark one notification as read
router.put('/:id/read', (req, res) => {
  db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update notification', error: err.message });
    res.json({ message: 'Notification marked as read' });
  });
});

// Mark all notifications as read for user
router.put('/user/:user_id/read-all', (req, res) => {
  db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.params.user_id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update notifications', error: err.message });
    res.json({ message: 'All notifications marked as read' });
  });
});

// Get unread notification summary for navbar badges
router.get('/summary/:user_id', (req, res) => {
  const userId = req.params.user_id;

  const sql = `
    SELECT
      SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) AS total_unread,
      SUM(CASE WHEN is_read = FALSE AND link_url = 'orders.html' THEN 1 ELSE 0 END) AS my_product_orders,
      SUM(CASE WHEN is_read = FALSE AND (link_url = 'seller-orders.html' OR (type = 'order' AND message LIKE '%New order%')) THEN 1 ELSE 0 END) AS received_product_orders,
      SUM(CASE WHEN is_read = FALSE AND link_url = 'booking.html' THEN 1 ELSE 0 END) AS my_service_bookings,
      SUM(CASE WHEN is_read = FALSE AND (link_url = 'service-orders.html' OR (type = 'booking' AND message LIKE '%New service%')) THEN 1 ELSE 0 END) AS received_service_orders,
      SUM(CASE WHEN is_read = FALSE AND (link_url = 'admin.html' OR type IN ('admin','issue')) THEN 1 ELSE 0 END) AS admin_alerts
    FROM notifications
    WHERE user_id = ?
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch notification summary',
        error: err.message
      });
    }

    res.json({
      total_unread: Number(rows[0].total_unread || 0),
      my_product_orders: Number(rows[0].my_product_orders || 0),
      my_service_bookings: Number(rows[0].my_service_bookings || 0),
      received_product_orders: Number(rows[0].received_product_orders || 0),
      received_service_orders: Number(rows[0].received_service_orders || 0),
      admin_alerts: Number(rows[0].admin_alerts || 0)
    });
  });
});

// Mark notifications for one page as read
router.put('/user/:user_id/read-link', (req, res) => {
  const { link_url } = req.body;

  if (!link_url) {
    return res.status(400).json({ message: 'link_url is required' });
  }

  db.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND link_url = ?',
    [req.params.user_id, link_url],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: 'Failed to mark page notifications as read',
          error: err.message
        });
      }

      res.json({ message: 'Page notifications marked as read' });
    }
  );
});

module.exports = router;
