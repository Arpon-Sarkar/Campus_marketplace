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

  db.query(
    'INSERT INTO notifications (user_id, message, type, link_url) VALUES (?, ?, ?, ?)',
    [userId, message, type, linkUrl],
    () => {}
  );
}

function notifyAdmins(message, type = 'admin', linkUrl = 'admin.html') {
  db.query("SELECT id FROM users WHERE role = 'admin'", (err, admins) => {
    if (err || !admins || !admins.length) return;
    admins.forEach(admin => notify(admin.id, message, type, linkUrl));
  });
}

function deliveryCharge(location) {
  if (!location || location === 'Varendra University Campus') return 0;
  if (['Kazla', 'Talaimari', 'Binodpur'].includes(location)) return 30;
  if (location === 'Other Rajshahi Area') return 70;
  return 50;
}

// Place product order
// Buyer orders product -> Seller approves/rejects
router.post('/', (req, res) => {
  const {
    buyer_id,
    product_id,
    buyer_phone,
    delivery_type,
    delivery_location,
    delivery_address,
    payment_method,
    sender_number,
    transaction_id,
    note
  } = req.body;

  if (!buyer_id || !product_id || !buyer_phone || !delivery_location || !delivery_address || !payment_method) {
    return res.status(400).json({
      message: 'Phone, delivery location, address, and payment method are required.'
    });
  }

  if (!['Cash on Delivery', 'bKash'].includes(payment_method)) {
    return res.status(400).json({
      message: 'Only Cash on Delivery or bKash payment is allowed for product orders.'
    });
  }

  db.query(
    `
    SELECT 
      users.verification_status,
      products.price,
      products.title,
      products.user_id AS seller_id,
      products.status,
      products.quantity,
      products.sold_quantity,
      GREATEST(COALESCE(products.quantity, 1) - COALESCE(products.sold_quantity, 0), 0) AS remaining_quantity,
      (
        SELECT COUNT(*)
        FROM orders pending_orders
        WHERE pending_orders.product_id = products.id
          AND pending_orders.status = 'pending_seller_approval'
      ) AS pending_quantity
    FROM users, products
    WHERE users.id = ? AND products.id = ?
    `,
    [buyer_id, product_id],
    (checkErr, rows) => {
      if (checkErr) {
        return res.status(500).json({
          message: 'Order check failed',
          error: checkErr.message
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          message: 'Buyer or product not found'
        });
      }

      const product = rows[0];

      if (product.verification_status !== 'verified') {
        return res.status(403).json({
          message: 'Only verified campus users can order products.'
        });
      }

      const remainingQuantity = Number(product.remaining_quantity || 0);
      const pendingQuantity = Number(product.pending_quantity || 0);

      if (product.status !== 'active' || remainingQuantity <= 0 || pendingQuantity >= remainingQuantity) {
        return res.status(400).json({
          message: 'This product is sold out, reserved by another pending order, or not active for ordering.'
        });
      }

      if (Number(buyer_id) === Number(product.seller_id)) {
        return res.status(400).json({
          message: 'You cannot order your own product.'
        });
      }

      if (payment_method === 'bKash' && (!sender_number || !transaction_id)) {
        return res.status(400).json({
          message: 'bKash sender number and transaction ID are required.'
        });
      }

      const charge = deliveryCharge(delivery_location);
      const total = Number(product.price || 0) + charge;

      const paymentStatus =
        payment_method === 'bKash' ? 'pending_verification' : 'unpaid';

      const orderStatus = 'pending_seller_approval';

      const sql = `
        INSERT INTO orders
        (
          buyer_id,
          product_id,
          buyer_phone,
          delivery_type,
          delivery_location,
          delivery_address,
          payment_method,
          sender_number,
          transaction_id,
          payment_status,
          delivery_charge,
          total_amount,
          note,
          status,
          contact_visible,
          delivery_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 'not_started')
      `;

      db.query(
        sql,
        [
          buyer_id,
          product_id,
          buyer_phone,
          delivery_type || 'Rajshahi City Delivery',
          delivery_location,
          delivery_address,
          payment_method,
          sender_number || null,
          transaction_id || null,
          paymentStatus,
          charge,
          total,
          note || null,
          orderStatus
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: 'Order failed',
              error: err.message
            });
          }

          notify(
            product.seller_id,
            `New order received for "${product.title}". Please open Received Product Orders to approve or reject it.`,
            'order',
            'seller-orders.html'
          );

          notify(
            buyer_id,
            `Your order for "${product.title}" was placed and is waiting for seller approval.`,
            'order',
            'orders.html'
          );

          res.status(201).json({
            message: 'Order placed successfully. Waiting for seller approval.',
            orderId: result.insertId
          });
        }
      );
    }
  );
});

// Get all orders for admin monitoring
router.get('/', (req, res) => {
  const sql = `
    SELECT 
      orders.*,
      buyers.name AS buyer_name,
      buyers.email AS buyer_email,
      buyers.profile_image AS buyer_profile_image,
      sellers.id AS seller_id,
      sellers.name AS seller_name,
      sellers.email AS seller_email,
      products.title AS product_name,
      products.price AS product_price,
      orders.buyer_phone AS visible_buyer_phone,
      orders.delivery_address AS visible_delivery_address
    FROM orders
    JOIN users buyers ON orders.buyer_id = buyers.id
    JOIN products ON orders.product_id = products.id
    LEFT JOIN users sellers ON products.user_id = sellers.id
    ORDER BY orders.id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch orders',
        error: err.message
      });
    }

    res.json(results);
  });
});

// Get orders of one buyer
router.get('/user/:buyer_id', (req, res) => {
  const sql = `
    SELECT 
      orders.*,
      products.title AS product_name,
      products.price AS product_price,
      products.description AS product_description,
      products.bkash_number AS seller_bkash_number,
      products.payment_note AS seller_payment_note,
      users.id AS seller_id, users.name AS seller_name, users.profile_image AS seller_profile_image
    FROM orders
    JOIN products ON orders.product_id = products.id
    LEFT JOIN users ON products.user_id = users.id
    WHERE orders.buyer_id = ?
    ORDER BY orders.id DESC
  `;

  db.query(sql, [req.params.buyer_id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch user orders',
        error: err.message
      });
    }

    res.json(results);
  });
});

// Get orders received by seller
router.get('/seller/:seller_id', (req, res) => {
  const sql = `
    SELECT 
      orders.*,
      products.title AS product_name,
      products.price AS product_price,
      buyers.name AS buyer_name,
      buyers.email AS buyer_email,
      buyers.profile_image AS buyer_profile_image,
      CASE WHEN orders.contact_visible = TRUE THEN orders.buyer_phone ELSE NULL END AS visible_buyer_phone,
      CASE WHEN orders.contact_visible = TRUE THEN orders.delivery_address ELSE NULL END AS visible_delivery_address
    FROM orders
    JOIN products ON orders.product_id = products.id
    JOIN users buyers ON orders.buyer_id = buyers.id
    WHERE products.user_id = ?
    ORDER BY orders.id DESC
  `;

  db.query(sql, [req.params.seller_id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch seller orders',
        error: err.message
      });
    }

    res.json(results);
  });
});

// Seller approves or rejects order
// Approval reserves/decreases stock immediately. Buyer confirmation no longer changes stock.
router.put('/:id/seller-approval', (req, res) => {
  const orderId = req.params.id;
  const { seller_id, action } = req.body;

  if (!seller_id || !action) {
    return res.status(400).json({ message: 'Seller ID and action are required.' });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action.' });
  }

  db.query(
    `
    SELECT
      orders.*,
      products.user_id AS seller_id,
      products.title AS product_title,
      products.quantity,
      products.sold_quantity,
      GREATEST(COALESCE(products.quantity, 1) - COALESCE(products.sold_quantity, 0), 0) AS remaining_quantity
    FROM orders
    JOIN products ON orders.product_id = products.id
    WHERE orders.id = ? AND products.user_id = ?
    `,
    [orderId, seller_id],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Order check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Order not found or you are not the seller.' });

      const order = rows[0];

      if (order.status !== 'pending_seller_approval') {
        return res.status(400).json({ message: 'This order was already processed. Pending orders only can be approved/rejected.' });
      }

      if (action === 'reject') {
        return db.query(
          'UPDATE orders SET status = ?, contact_visible = FALSE WHERE id = ?',
          ['seller_rejected', orderId],
          (rejectErr) => {
            if (rejectErr) return res.status(500).json({ message: 'Failed to reject order', error: rejectErr.message });
            notify(order.buyer_id, `Your order for "${order.product_title}" was rejected by the seller.`, 'order', 'orders.html');
            res.json({ message: 'Order rejected successfully.' });
          }
        );
      }

      if (Number(order.remaining_quantity || 0) <= 0) {
        return res.status(400).json({ message: 'This product is already out of stock. This order cannot be approved.' });
      }

      // First reserve/decrease stock. The WHERE condition prevents approving more orders than stock.
      db.query(
        `
        UPDATE products
        SET sold_quantity = COALESCE(sold_quantity, 0) + 1,
          status = CASE
            WHEN COALESCE(sold_quantity, 0) + 1 >= COALESCE(quantity, 1) THEN 'sold'
            ELSE 'active'
          END
        WHERE id = ? AND COALESCE(sold_quantity, 0) < COALESCE(quantity, 1)
        `,
        [order.product_id],
        (stockErr, stockResult) => {
          if (stockErr) return res.status(500).json({ message: 'Failed to reserve stock', error: stockErr.message });
          if (!stockResult.affectedRows) return res.status(400).json({ message: 'This product is already out of stock. This order cannot be approved.' });

          db.query(
            'UPDATE orders SET status = ?, contact_visible = TRUE WHERE id = ?',
            ['seller_approved', orderId],
            (updateErr) => {
              if (updateErr) return res.status(500).json({ message: 'Stock was reserved, but order approval update failed', error: updateErr.message });

              notify(order.buyer_id, `Your order for "${order.product_title}" was approved by the seller. Seller can now see your contact and delivery details.`, 'order', 'orders.html');
              res.json({ message: 'Order approved successfully. Product stock has been updated.' });
            }
          );
        }
      );
    }
  );
});

// Buyer can cancel only before seller approval
router.put('/:id/cancel', (req, res) => {
  const orderId = req.params.id;
  const { buyer_id } = req.body;

  if (!buyer_id) return res.status(400).json({ message: 'Buyer ID is required.' });

  db.query(
    `SELECT orders.*, products.title, products.user_id AS seller_id
     FROM orders JOIN products ON orders.product_id = products.id
     WHERE orders.id = ? AND orders.buyer_id = ?`,
    [orderId, buyer_id],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Order check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Order not found or you are not the buyer.' });

      const order = rows[0];
      if (order.status !== 'pending_seller_approval') {
        return res.status(400).json({ message: 'You can cancel only before the seller approves the order.' });
      }

      db.query('UPDATE orders SET status = ?, contact_visible = FALSE WHERE id = ?', ['cancelled', orderId], (err) => {
        if (err) return res.status(500).json({ message: 'Failed to cancel order', error: err.message });
        notify(order.seller_id, `Buyer cancelled the order for "${order.title}" before approval.`, 'order', 'seller-orders.html');
        notify(order.buyer_id, `Your order for "${order.title}" was cancelled.`, 'order', 'orders.html');
        res.json({ message: 'Order cancelled successfully.' });
      });
    }
  );
});

// Admin or seller can update order/payment/delivery status
router.put('/:id/status', (req, res) => {
  const orderId = req.params.id;
  const { status, payment_status, delivery_status } = req.body;

  if (!status && !payment_status && !delivery_status) {
    return res.status(400).json({ message: 'At least one status value is required' });
  }

  const allowedStatuses = ['pending_seller_approval', 'seller_approved', 'processing', 'awaiting_buyer_confirmation', 'completed', 'issue_reported', 'seller_rejected', 'cancelled'];
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid order status.' });
  }

  db.query(
    `
    SELECT
      orders.*,
      products.user_id AS seller_id,
      products.title
    FROM orders
    JOIN products ON orders.product_id = products.id
    WHERE orders.id = ?
    `,
    [orderId],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Order check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Order not found.' });

      const order = rows[0];
      const finalPaymentStatus = payment_status || order.payment_status;

      if (payment_status === 'unpaid' && (order.payment_status === 'paid' || ['awaiting_buyer_confirmation', 'completed'].includes(order.status))) {
        return res.status(400).json({ message: 'Paid or completed orders cannot be marked unpaid.' });
      }

      if (status === 'completed') {
        return res.status(400).json({ message: 'Buyer confirmation is required before completing this order.' });
      }

      if (status === 'awaiting_buyer_confirmation' && finalPaymentStatus !== 'paid') {
        return res.status(400).json({ message: 'Confirm payment first. Then you can request buyer delivery confirmation.' });
      }

      const updates = [];
      const values = [];

      if (status) {
        updates.push('status = ?');
        values.push(status);

        if (status === 'awaiting_buyer_confirmation') {
          updates.push('delivery_status = ?');
          values.push('delivered');
        }
      }

      if (payment_status) {
        updates.push('payment_status = ?');
        values.push(payment_status);
      }

      if (delivery_status) {
        updates.push('delivery_status = ?');
        values.push(delivery_status);
      }

      values.push(orderId);

      db.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return res.status(500).json({ message: 'Failed to update order', error: err.message });

        if (status) {
          const buyerMessage = status === 'awaiting_buyer_confirmation'
            ? `Your order for "${order.title}" is marked delivered. Please confirm if you received it properly.`
            : `Your order for "${order.title}" is now ${status}.`;

          notify(order.buyer_id, buyerMessage, 'order', 'orders.html');
          notify(order.seller_id, `Order for your product "${order.title}" is now ${status}.`, 'order', 'seller-orders.html');
        }

        if (payment_status) {
          notify(order.buyer_id, `Payment status for "${order.title}" is now ${payment_status}.`, 'payment', 'orders.html');
          notify(order.seller_id, `Payment status for your product order "${order.title}" is now ${payment_status}.`, 'payment', 'seller-orders.html');
        }

        if (delivery_status) {
          notify(order.buyer_id, `Delivery status for "${order.title}" is now ${delivery_status}.`, 'delivery', 'orders.html');
        }

        res.json({ message: 'Order updated successfully' });
      });
    }
  );
});

// Buyer confirms whether the product order was received properly
router.put('/:id/buyer-confirmation', (req, res) => {
  const orderId = req.params.id;
  const { buyer_id, received, issue_details, issue_category, issue_image } = req.body;

  if (!buyer_id || typeof received !== 'boolean') {
    return res.status(400).json({ message: 'Buyer ID and received confirmation are required.' });
  }

  if (received === false && (!issue_details || issue_details.trim().length < 10)) {
    return res.status(400).json({ message: 'Please describe the product issue with at least 10 characters.' });
  }

  db.query(
    `
    SELECT orders.*, products.user_id AS seller_id, products.title
    FROM orders
    JOIN products ON orders.product_id = products.id
    WHERE orders.id = ? AND orders.buyer_id = ?
    `,
    [orderId, buyer_id],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Order check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Order not found or you are not the buyer.' });

      const order = rows[0];
      if (order.status !== 'awaiting_buyer_confirmation') {
        return res.status(400).json({ message: 'This order is not waiting for buyer confirmation.' });
      }

      const newStatus = received ? 'completed' : 'issue_reported';
      const cleanIssueDetails = received ? null : issue_details.trim();
      const cleanIssueCategory = received ? null : (issue_category || 'Other');
      const cleanIssueImage = received ? null : (issue_image || null);
      db.query(
        'UPDATE orders SET status = ?, delivery_status = ?, issue_category = ?, issue_details = ?, issue_image = ?, issue_status = ?, issue_reported_at = ? WHERE id = ?',
        [newStatus, received ? 'delivered' : order.delivery_status, cleanIssueCategory, cleanIssueDetails, cleanIssueImage, received ? 'resolved' : 'open', received ? null : new Date(), orderId],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: 'Failed to update confirmation', error: updateErr.message });


          notify(order.seller_id,
            received
              ? `Buyer confirmed receiving "${order.title}" properly. Order is completed.`
              : `Buyer reported a problem with "${order.title}": ${cleanIssueDetails}. Please contact the buyer and check Admin Panel.`,
            'order',
            'seller-orders.html'
          );

          notify(order.buyer_id,
            received
              ? `Thanks. Your order for "${order.title}" is completed. You can now review it.`
              : `Your issue report for "${order.title}" was sent to the seller and admin. You can still rate/review this order.`,
            'order',
            'orders.html'
          );

          if (!received) {
            notifyAdmins(
              `Product order issue reported for "${order.title}". Buyer issue (${cleanIssueCategory}): ${cleanIssueDetails}`,
              'issue',
              'admin.html'
            );
          }

          res.json({ message: received ? 'Order completed successfully.' : 'Issue reported to seller and admin.' });
        }
      );
    }
  );
});


// Admin can update reported issue review status
router.put('/:id/issue-status', requireAdmin, (req, res) => {
  const { issue_status } = req.body;
  if (!['open', 'reviewing', 'resolved'].includes(issue_status)) {
    return res.status(400).json({ message: 'Use open, reviewing, or resolved.' });
  }
  db.query('UPDATE orders SET issue_status = ? WHERE id = ?', [issue_status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update issue status', error: err.message });
    res.json({ message: 'Product order issue status updated.' });
  });
});

// Delete order
router.delete('/:id', (req, res) => {
  db.query('DELETE FROM orders WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to delete order',
        error: err.message
      });
    }

    res.json({
      message: 'Order deleted successfully'
    });
  });
});

module.exports = router;