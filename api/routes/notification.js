const express = require('express');
const mongoose = require('mongoose');

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
      .populate('task', 'title status priority')
      .sort({ createdAt: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error('Lỗi lấy thông báo:', error);

    return res.status(500).json({
      message: 'Không thể tải danh sách thông báo',
    });
  }
});

// GET /api/notifications/unread-count
// Đếm số thông báo chưa đọc
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false,
    });

    return res.status(200).json({ count });
  } catch (error) {
    console.error('Lỗi đếm thông báo:', error);

    return res.status(500).json({
      message: 'Không thể đếm thông báo chưa đọc',
    });
  }
});

// PATCH /api/notifications/read-all
// Đánh dấu tất cả thông báo đã đọc
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.userId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    return res.status(200).json({
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Lỗi đánh dấu tất cả đã đọc:', error);

    return res.status(500).json({
      message: 'Không thể cập nhật thông báo',
    });
  }
});

// PATCH /api/notifications/:id/read
// Đánh dấu một thông báo đã đọc
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'ID thông báo không hợp lệ',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.userId,
      },
      {
        $set: { isRead: true },
      },
      {
        new: true,
      }
    )
      .populate('sender', 'name email')
      .populate('task', 'title status priority');

    if (!notification) {
      return res.status(404).json({
        message: 'Không tìm thấy thông báo',
      });
    }

    return res.status(200).json({
      message: 'Đã đánh dấu thông báo là đã đọc',
      notification,
    });
  } catch (error) {
    console.error('Lỗi cập nhật thông báo:', error);

    return res.status(500).json({
      message: 'Không thể cập nhật thông báo',
    });
  }
});

module.exports = router;