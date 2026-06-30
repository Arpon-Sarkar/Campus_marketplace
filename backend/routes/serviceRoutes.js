const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'services');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginal}`);
  }
});

const allowedFileTypes = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = allowedFileTypes.some(type => file.mimetype.startsWith(type) || file.mimetype === type);
    if (!ok) return cb(new Error('Only image, PDF, DOC, or DOCX files are allowed.'));
    cb(null, true);
  }
});

const serviceUpload = upload.fields([
  { name: 'service_image', maxCount: 1 },
  { name: 'service_file', maxCount: 1 }
]);

function publicFileUrl(req, file) {
  return `${req.protocol}://${req.get('host')}/uploads/services/${file.filename}`;
}

function uploadedFileUrl(req, fieldName) {
  const file = req.files && req.files[fieldName] && req.files[fieldName][0];
  return file ? publicFileUrl(req, file) : null;
}

function uploadedFileMeta(req, fieldName) {
  const file = req.files && req.files[fieldName] && req.files[fieldName][0];
  if (!file) return null;
  return {
    url: publicFileUrl(req, file),
    name: file.originalname,
    type: file.mimetype
  };
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

function notify(userId, message, type = 'info') {
  if (!userId) return;
  db.query(
    'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
    [userId, message, type],
    () => {}
  );
}

// Get services. Public users see active services; admin can pass ?all=true
router.get('/', (req, res) => {
  const showAll = req.query.all === 'true' && req.query.admin_id;

  const sql = `
    SELECT
      services.*,
      users.name AS provider_name,
      users.profile_image AS provider_profile_image,
      COALESCE(review_stats.avg_rating, 0) AS avg_rating,
      COALESCE(review_stats.review_count, 0) AS review_count
    FROM services
    LEFT JOIN users ON services.user_id = users.id
    LEFT JOIN (
      SELECT service_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
      FROM reviews
      WHERE status = 'approved' AND service_id IS NOT NULL
      GROUP BY service_id
    ) review_stats ON review_stats.service_id = services.id
    ${showAll ? '' : "WHERE services.status IN ('active', 'unavailable')"}
    ORDER BY services.id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch services',
        error: err.message
      });
    }

    res.json(results);
  });
});



// Serve service attachment by service ID. This avoids broken/stale saved absolute URLs and opens PDFs inline.
router.get('/:id/file', (req, res) => {
  db.query('SELECT service_file_data, service_file_name, service_file_type FROM services WHERE id = ? LIMIT 1', [req.params.id], (err, rows) => {
    if (err) return res.status(500).send('Failed to load attachment');
    if (!rows.length || !rows[0].service_file_data) return res.status(404).send('Attachment not found');

    const fileData = rows[0].service_file_data;
    const fileName = rows[0].service_file_name || 'service-attachment';
    const fileType = rows[0].service_file_type || 'application/octet-stream';

    if (fileData.startsWith('data:')) {
      const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return res.status(400).send('Invalid attachment data');
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', match[1] || fileType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
      return res.send(buffer);
    }

    const marker = '/uploads/services/';
    const markerIndex = fileData.indexOf(marker);
    if (markerIndex === -1) return res.redirect(fileData);

    const storedName = decodeURIComponent(fileData.slice(markerIndex + marker.length)).replace(/[\\/]/g, '');
    const fullPath = path.join(uploadDir, storedName);
    if (!fullPath.startsWith(uploadDir) || !fs.existsSync(fullPath)) return res.status(404).send('Attachment file not found on server');

    res.setHeader('Content-Type', fileType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.sendFile(fullPath);
  });
});

// Get one service with provider and rating details
router.get('/:id', (req, res) => {
  const sql = `
    SELECT services.*, users.name AS provider_name, users.email AS provider_email, users.profile_image AS provider_profile_image,
      COALESCE(review_stats.avg_rating, 0) AS avg_rating,
      COALESCE(review_stats.review_count, 0) AS review_count
    FROM services
    LEFT JOIN users ON services.user_id = users.id
    LEFT JOIN (
      SELECT service_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
      FROM reviews
      WHERE status = 'approved' AND service_id IS NOT NULL
      GROUP BY service_id
    ) review_stats ON review_stats.service_id = services.id
    WHERE services.id = ?
  `;
  db.query(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch service', error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Service not found' });
    res.json(rows[0]);
  });
});

// Add new service.
// Admin service = active automatically.
// Normal verified user service = pending until admin approval.
router.post('/add', serviceUpload, (req, res) => {
  const { user_id, title, description, category, price, bkash_number, payment_note } = req.body;
  const service_image = uploadedFileUrl(req, 'service_image') || req.body.service_image || null;
  const attachment = uploadedFileMeta(req, 'service_file');
  const service_file_data = attachment ? attachment.url : (req.body.service_file_data || null);
  const service_file_name = attachment ? attachment.name : (req.body.service_file_name || null);
  const service_file_type = attachment ? attachment.type : (req.body.service_file_type || null);

  if (!user_id || !title || !description || !category || !price) {
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
      const isAdmin = user.role === 'admin';

      if (!isAdmin && user.verification_status !== 'verified') {
        return res.status(403).json({
          message: 'Only verified campus users can add services.'
        });
      }

      const status = isAdmin ? 'active' : 'pending';

      const sql = `
        INSERT INTO services (user_id, title, description, category, price, service_image, service_file_data, service_file_name, service_file_type, bkash_number, payment_note, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [user_id, title, description, category, price, service_image || null, service_file_data || null, service_file_name || null, service_file_type || null, bkash_number || null, payment_note || null, status],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: 'Failed to add service',
              error: err.message
            });
          }

          if (isAdmin) {
            notify(user_id, 'Your service was added and approved automatically.', 'service');

            return res.status(201).json({
              message: 'Service added successfully and approved automatically',
              serviceId: result.insertId,
              status
            });
          }

          notify(user_id, 'Your service was submitted and is waiting for admin approval.', 'service');

          res.status(201).json({
            message: 'Service submitted for admin approval',
            serviceId: result.insertId,
            status
          });
        }
      );
    }
  );
});


// Update own service. Keep the current listing status so an approved service does not disappear after editing.
router.put('/:id', serviceUpload, (req, res) => {
  const serviceId = req.params.id;
  const { user_id, title, description, category, price, bkash_number, payment_note } = req.body;
  const service_image = uploadedFileUrl(req, 'service_image') || req.body.service_image || null;
  const attachment = uploadedFileMeta(req, 'service_file');
  const service_file_data = attachment ? attachment.url : (req.body.service_file_data || null);
  const service_file_name = attachment ? attachment.name : (req.body.service_file_name || null);
  const service_file_type = attachment ? attachment.type : (req.body.service_file_type || null);

  if (!user_id || !title || !description || !category || !price) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query('SELECT user_id, status FROM services WHERE id = ? LIMIT 1', [serviceId], (readErr, rows) => {
    if (readErr) return res.status(500).json({ message: 'Service check failed', error: readErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Service not found' });
    if (Number(rows[0].user_id) !== Number(user_id)) return res.status(403).json({ message: 'You can edit only your own service.' });

    const sql = `
      UPDATE services
      SET title = ?, description = ?, category = ?, price = ?, service_image = ?, service_file_data = ?, service_file_name = ?, service_file_type = ?, bkash_number = ?, payment_note = ?, status = ?
      WHERE id = ?
    `;
    const currentStatus = rows[0].status || 'pending';
    db.query(sql, [title, description, category, price, service_image || null, service_file_data || null, service_file_name || null, service_file_type || null, bkash_number || null, payment_note || null, currentStatus, serviceId], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update service', error: err.message });
      notify(user_id, 'Your service details were updated successfully.', 'service');
      res.json({ message: 'Service updated successfully.' });
    });
  });
});

// Update service status by admin
router.put('/:id/status', requireAdmin, (req, res) => {
  const serviceId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  db.query(
    'UPDATE services SET status = ? WHERE id = ?',
    [status, serviceId],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: 'Failed to update service status',
          error: err.message
        });
      }

      db.query(
        'SELECT user_id, title FROM services WHERE id = ?',
        [serviceId],
        (readErr, rows) => {
          if (!readErr && rows.length) {
            notify(
              rows[0].user_id,
              `Your service "${rows[0].title}" status is now ${status}.`,
              'service'
            );
          }
        }
      );

      res.json({ message: 'Service status updated successfully' });
    }
  );
});

// Provider can make an approved service active or unavailable without admin approval.
router.put('/:id/availability', (req, res) => {
  const serviceId = req.params.id;
  const { user_id, status } = req.body;
  if (!user_id) return res.status(400).json({ message: 'User ID is required.' });
  if (!['active', 'unavailable'].includes(status)) return res.status(400).json({ message: 'Status must be active or unavailable.' });

  db.query('SELECT user_id, status FROM services WHERE id = ? LIMIT 1', [serviceId], (readErr, rows) => {
    if (readErr) return res.status(500).json({ message: 'Service check failed', error: readErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Service not found.' });
    if (Number(rows[0].user_id) !== Number(user_id)) return res.status(403).json({ message: 'You can update only your own service.' });
    if (!['active', 'unavailable'].includes(rows[0].status)) return res.status(400).json({ message: 'Only admin-approved services can be marked active or unavailable.' });

    db.query('UPDATE services SET status = ? WHERE id = ?', [status, serviceId], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update service availability', error: err.message });
      res.json({ message: `Service is now ${status === 'active' ? 'active' : 'not available'}.` });
    });
  });
});

// Delete service. Owner or admin only.
router.delete('/:id', (req, res) => {
  const userId = req.query.user_id || req.body.user_id;
  if (!userId) return res.status(400).json({ message: 'User ID is required.' });
  db.query('SELECT services.user_id, users.role FROM services LEFT JOIN users ON users.id = ? WHERE services.id = ? LIMIT 1', [userId, req.params.id], (readErr, rows) => {
    if (readErr) return res.status(500).json({ message: 'Service check failed', error: readErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Service not found.' });
    if (Number(rows[0].user_id) !== Number(userId) && rows[0].role !== 'admin') return res.status(403).json({ message: 'You can delete only your own service.' });
    db.query('DELETE FROM services WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to delete service', error: err.message });
      res.json({ message: 'Service deleted successfully' });
    });
  });
});

module.exports = router;