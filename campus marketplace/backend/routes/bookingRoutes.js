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

// Create service booking
// Student books service -> provider approves/rejects
router.post('/add', (req, res) => {
  const {
    user_id,
    service_id,
    requester_phone,
    preferred_contact,
    meeting_location,
    requested_datetime,
    payment_method,
    sender_number,
    transaction_id,
    booking_note
  } = req.body;

  if (!user_id || !service_id || !requester_phone || !preferred_contact || !meeting_location || !payment_method) {
    return res.status(400).json({
      message: 'Phone, contact method, meeting location, and payment method are required.'
    });
  }

  if (!['Phone', 'Email'].includes(preferred_contact)) {
    return res.status(400).json({ message: 'Contact method must be Phone or Email only.' });
  }

  if (!['Cash', 'bKash'].includes(payment_method)) {
    return res.status(400).json({
      message: 'Only Cash or bKash payment is allowed for service bookings.'
    });
  }

  if (payment_method === 'bKash' && (!sender_number || !transaction_id)) {
    return res.status(400).json({
      message: 'bKash sender number and transaction ID are required.'
    });
  }

  db.query(
    `
    SELECT 
      users.verification_status,
      services.title,
      services.user_id AS provider_id,
      services.status
    FROM users, services
    WHERE users.id = ? AND services.id = ?
    `,
    [user_id, service_id],
    (checkErr, rows) => {
      if (checkErr) {
        return res.status(500).json({
          message: 'Booking check failed',
          error: checkErr.message
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          message: 'User or service not found'
        });
      }

      const service = rows[0];

      if (service.verification_status !== 'verified') {
        return res.status(403).json({
          message: 'Only verified campus users can book services.'
        });
      }

      if (service.status !== 'active') {
        return res.status(400).json({
          message: 'This service is not active for booking.'
        });
      }

      if (Number(user_id) === Number(service.provider_id)) {
        return res.status(400).json({
          message: 'You cannot book your own service.'
        });
      }

      const bookingStatus = 'pending_provider_approval';
      const providerApprovalStatus = 'pending';
      const paymentStatus = payment_method === 'bKash' ? 'pending_verification' : 'unpaid';

      const sql = `
        INSERT INTO bookings
        (
          user_id,
          service_id,
          requester_phone,
          preferred_contact,
          meeting_location,
          requested_datetime,
          payment_method,
          sender_number,
          transaction_id,
          payment_status,
          booking_note,
          status,
          provider_approval_status,
          contact_visible
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
      `;

      db.query(
        sql,
        [
          user_id,
          service_id,
          requester_phone,
          preferred_contact,
          meeting_location,
          requested_datetime || null,
          payment_method,
          sender_number || null,
          transaction_id || null,
          paymentStatus,
          booking_note || null,
          bookingStatus,
          providerApprovalStatus
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: 'Booking failed',
              error: err.message
            });
          }

          notify(
            service.provider_id,
            `New service order received for "${service.title}". Please open Received Service Orders to approve or reject it.`,
            'booking',
            'service-orders.html'
          );

          notify(
            user_id,
            `Your booking for "${service.title}" was submitted and is waiting for provider approval.`,
            'booking',
            'booking.html'
          );

          res.status(201).json({
            message: 'Booking submitted successfully. Waiting for provider approval.',
            bookingId: result.insertId
          });
        }
      );
    }
  );
});

// Get all bookings for admin monitoring
router.get('/', (req, res) => {
  const sql = `
    SELECT
      bookings.*,
      students.name AS student_name,
      students.email AS student_email,
      students.profile_image AS student_profile_image,
      providers.id AS provider_id,
      providers.name AS provider_name,
      providers.email AS provider_email,
      providers.profile_image AS provider_profile_image,
      services.title AS service_title,
      services.price AS service_price,
      services.service_file_data,
      services.service_file_name,
      bookings.requester_phone AS visible_requester_phone
    FROM bookings
    JOIN users students ON bookings.user_id = students.id
    JOIN services ON bookings.service_id = services.id
    LEFT JOIN users providers ON services.user_id = providers.id
    ORDER BY bookings.id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch bookings',
        error: err.message
      });
    }

    res.json(results);
  });
});

// Get bookings made by one user
router.get('/user/:user_id', (req, res) => {
  const sql = `
    SELECT
      bookings.*,
      services.title AS service_title,
      services.price AS service_price,
      providers.id AS provider_id,
      providers.name AS provider_name,
      providers.email AS provider_email,
      providers.profile_image AS provider_profile_image,
      services.bkash_number AS provider_bkash_number,
      services.payment_note AS provider_payment_note,
      services.service_file_data,
      services.service_file_name
    FROM bookings
    JOIN services ON bookings.service_id = services.id
    LEFT JOIN users providers ON services.user_id = providers.id
    WHERE bookings.user_id = ?
    ORDER BY bookings.id DESC
  `;

  db.query(sql, [req.params.user_id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch user bookings',
        error: err.message
      });
    }

    res.json(results);
  });
});

// Get bookings received by service provider
router.get('/provider/:provider_id', (req, res) => {
  const sql = `
    SELECT
      bookings.*,
      services.title AS service_title,
      services.price AS service_price,
      services.service_file_data,
      services.service_file_name,
      students.name AS student_name,
      students.email AS student_email,
      students.profile_image AS student_profile_image,
      CASE WHEN bookings.contact_visible = TRUE AND bookings.preferred_contact = 'Phone' THEN bookings.requester_phone ELSE NULL END AS visible_requester_phone,
      CASE WHEN bookings.contact_visible = TRUE AND bookings.preferred_contact = 'Email' THEN students.email ELSE NULL END AS visible_student_email
    FROM bookings
    JOIN services ON bookings.service_id = services.id
    JOIN users students ON bookings.user_id = students.id
    WHERE services.user_id = ?
    ORDER BY bookings.id DESC
  `;

  db.query(sql, [req.params.provider_id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch provider bookings',
        error: err.message
      });
    }

    res.json(results);
  });
});

// Provider approves/rejects booking
router.put('/:id/provider-approval', (req, res) => {
  const bookingId = req.params.id;
  const { provider_id, action } = req.body;

  if (!provider_id || !action) {
    return res.status(400).json({ message: 'Provider ID and action are required.' });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action.' });
  }

  db.query(
    `
    SELECT
      bookings.*,
      services.user_id AS provider_id,
      services.title AS service_title
    FROM bookings
    JOIN services ON bookings.service_id = services.id
    WHERE bookings.id = ? AND services.user_id = ?
    `,
    [bookingId, provider_id],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Booking check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Booking not found or you are not the provider.' });

      const booking = rows[0];
      if (booking.status !== 'pending_provider_approval') {
        return res.status(400).json({ message: 'This booking was already processed. Pending bookings only can be approved/rejected.' });
      }

      const newStatus = action === 'approve' ? 'provider_approved' : 'provider_rejected';
      const newApprovalStatus = action === 'approve' ? 'approved' : 'rejected';

      db.query(
        `UPDATE bookings SET status = ?, provider_approval_status = ?, contact_visible = ? WHERE id = ?`,
        [newStatus, newApprovalStatus, action === 'approve', bookingId],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: 'Failed to update booking approval', error: updateErr.message });

          notify(
            booking.user_id,
            action === 'approve'
              ? `Your booking for "${booking.service_title}" was approved by the provider. Provider can now see your contact details.`
              : `Your booking for "${booking.service_title}" was rejected by the provider.`,
            'booking',
            'booking.html'
          );

          res.json({ message: action === 'approve' ? 'Booking approved successfully.' : 'Booking rejected successfully.' });
        }
      );
    }
  );
});

// Student can cancel only before provider approval
router.put('/:id/cancel', (req, res) => {
  const bookingId = req.params.id;
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ message: 'User ID is required.' });

  db.query(
    `SELECT bookings.*, services.title, services.user_id AS provider_id
     FROM bookings JOIN services ON bookings.service_id = services.id
     WHERE bookings.id = ? AND bookings.user_id = ?`,
    [bookingId, user_id],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Booking check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Booking not found or you are not the student.' });

      const booking = rows[0];
      if (booking.status !== 'pending_provider_approval') {
        return res.status(400).json({ message: 'You can cancel only before the provider approves the booking.' });
      }

      db.query('UPDATE bookings SET status = ?, provider_approval_status = ?, contact_visible = FALSE WHERE id = ?', ['cancelled', 'cancelled', bookingId], (err) => {
        if (err) return res.status(500).json({ message: 'Failed to cancel booking', error: err.message });
        notify(booking.provider_id, `Student cancelled the booking for "${booking.title}" before approval.`, 'booking', 'service-orders.html');
        notify(booking.user_id, `Your booking for "${booking.title}" was cancelled.`, 'booking', 'booking.html');
        res.json({ message: 'Booking cancelled successfully.' });
      });
    }
  );
});

// Admin or provider can update booking/payment status
router.put('/:id/status', (req, res) => {
  const bookingId = req.params.id;
  const { status, payment_status } = req.body;

  if (!status && !payment_status) {
    return res.status(400).json({ message: 'At least one status value is required' });
  }

  const allowedStatuses = ['pending_provider_approval', 'provider_approved', 'processing', 'service_done', 'completed', 'issue_reported', 'provider_rejected', 'cancelled'];
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid booking status.' });
  }

  db.query(
    `
    SELECT bookings.*, services.user_id AS provider_id, services.title
    FROM bookings
    JOIN services ON bookings.service_id = services.id
    WHERE bookings.id = ?
    `,
    [bookingId],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Booking check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Booking not found.' });

      const booking = rows[0];
      const finalPaymentStatus = payment_status || booking.payment_status;

      if (payment_status === 'unpaid' && (booking.payment_status === 'paid' || ['service_done', 'completed'].includes(booking.status))) {
        return res.status(400).json({ message: 'Paid or completed service bookings cannot be marked unpaid.' });
      }

      if (status === 'completed') {
        return res.status(400).json({ message: 'Student confirmation is required before completing this service booking.' });
      }

      if (status === 'service_done' && finalPaymentStatus !== 'paid') {
        return res.status(400).json({ message: 'Confirm payment first. Then you can request student service confirmation.' });
      }

      const updates = [];
      const values = [];

      if (status) {
        updates.push('status = ?');
        values.push(status);
      }

      if (payment_status) {
        updates.push('payment_status = ?');
        values.push(payment_status);
      }

      values.push(bookingId);

      db.query(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return res.status(500).json({ message: 'Failed to update booking', error: err.message });

        if (status) {
          const studentMessage = status === 'service_done'
            ? `Your service booking for "${booking.title}" is marked done. Please confirm if you received the service properly.`
            : `Your booking for "${booking.title}" is now ${status}.`;

          notify(booking.user_id, studentMessage, 'booking', 'booking.html');
          notify(booking.provider_id, `Booking for your service "${booking.title}" is now ${status}.`, 'booking', 'service-orders.html');
        }

        if (payment_status) {
          notify(booking.user_id, `Payment status for "${booking.title}" is now ${payment_status}.`, 'payment', 'booking.html');
          notify(booking.provider_id, `Payment status for your service booking "${booking.title}" is now ${payment_status}.`, 'payment', 'service-orders.html');
        }

        res.json({ message: 'Booking updated successfully' });
      });
    }
  );
});

// Student confirms whether the service was received properly
router.put('/:id/student-confirmation', (req, res) => {
  const bookingId = req.params.id;
  const { user_id, received, issue_details, issue_category, issue_image } = req.body;

  if (!user_id || typeof received !== 'boolean') {
    return res.status(400).json({ message: 'User ID and received confirmation are required.' });
  }

  if (received === false && (!issue_details || issue_details.trim().length < 10)) {
    return res.status(400).json({ message: 'Please describe the service issue with at least 10 characters.' });
  }

  db.query(
    `
    SELECT bookings.*, services.user_id AS provider_id, services.title
    FROM bookings
    JOIN services ON bookings.service_id = services.id
    WHERE bookings.id = ? AND bookings.user_id = ?
    `,
    [bookingId, user_id],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ message: 'Booking check failed', error: findErr.message });
      if (!rows.length) return res.status(404).json({ message: 'Booking not found or you are not the student.' });

      const booking = rows[0];
      if (booking.status !== 'service_done') {
        return res.status(400).json({ message: 'This booking is not waiting for student confirmation.' });
      }

      const newStatus = received ? 'completed' : 'issue_reported';
      const cleanIssueDetails = received ? null : issue_details.trim();
      const cleanIssueCategory = received ? null : (issue_category || 'Other');
      const cleanIssueImage = received ? null : (issue_image || null);
      db.query('UPDATE bookings SET status = ?, issue_category = ?, issue_details = ?, issue_image = ?, issue_status = ?, issue_reported_at = ? WHERE id = ?', [newStatus, cleanIssueCategory, cleanIssueDetails, cleanIssueImage, received ? 'resolved' : 'open', received ? null : new Date(), bookingId], (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Failed to update confirmation', error: updateErr.message });

        notify(booking.provider_id,
          received
            ? `Student confirmed receiving "${booking.title}" properly. Service booking is completed.`
            : `Student reported a problem with "${booking.title}": ${cleanIssueDetails}. Please contact the student and check Admin Panel.`,
          'booking',
          'service-orders.html'
        );

        notify(booking.user_id,
          received
            ? `Thanks. Your service booking for "${booking.title}" is completed. You can now review it.`
            : `Your issue report for "${booking.title}" was sent to the provider and admin. You can still rate/review this service.`,
          'booking',
          'booking.html'
        );

        if (!received) {
          notifyAdmins(
            `Service booking issue reported for "${booking.title}". Student issue (${cleanIssueCategory}): ${cleanIssueDetails}`,
            'issue',
            'admin.html'
          );
        }

        res.json({ message: received ? 'Service booking completed successfully.' : 'Issue reported to provider and admin.' });
      });
    }
  );
});


// Admin can update reported issue review status
router.put('/:id/issue-status', requireAdmin, (req, res) => {
  const { issue_status } = req.body;
  if (!['open', 'reviewing', 'resolved'].includes(issue_status)) {
    return res.status(400).json({ message: 'Use open, reviewing, or resolved.' });
  }
  db.query('UPDATE bookings SET issue_status = ? WHERE id = ?', [issue_status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update issue status', error: err.message });
    res.json({ message: 'Service booking issue status updated.' });
  });
});

// Delete booking
router.delete('/:id', (req, res) => {
  db.query('DELETE FROM bookings WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to delete booking',
        error: err.message
      });
    }

    res.json({
      message: 'Booking deleted successfully'
    });
  });
});

module.exports = router;