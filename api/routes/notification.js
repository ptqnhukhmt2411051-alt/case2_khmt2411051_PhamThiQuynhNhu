
const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/notifications
// Lấy danh sách thông báo của tài khoản hiện tại
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.userId,
    })
      .populate('sender', 'name email')
      .populate('task', 'title')
      .sort({ createdAt: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error('Loi lay thong bao:', error);

    return res.status(500).json({
      message: 'Loi lay thong bao',
      error: error.message,
    });
  }
});

module.exports = router;
