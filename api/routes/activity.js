
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const Task = require('../models/Task');
const TaskActivity = require('../models/TaskActivity');
const authMiddleware = require('../middleware/authMiddleware');

const getId = (value) => String(value?._id ?? value);

const canAccessTask = (task, userId) => {
  const id = String(userId);

  return (
    getId(task.createdBy) === id ||
    getId(task.assignedTo) === id ||
    (task.assignedUsers || []).some(user => getId(user) === id) ||
    (task.sharedWith || []).some(user => getId(user) === id) ||
    (task.sharedPermissions || []).some(
      item => getId(item.user) === id
    )
  );
};

// GET /api/tasks/:taskId/activities
router.get('/:taskId/activities', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    if (!canAccessTask(task, req.userId)) {
      return res.status(403).json({
        message: 'Ban khong co quyen xem lich su cong viec'
      });
    }

    const activities = await TaskActivity.find({ task: taskId })
      .populate('actor', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json(activities);
  } catch (error) {
    return res.status(500).json({
      message: 'Loi lay lich su hoat dong',
      error: error.message
    });
  }
});

module.exports = router;
