const {
  sendAssignmentEmail,
  sendShareInvitationEmail,
  sendTaskUpdateEmail,
  sendTaskCompletedEmail,
} = require('../config/email');
const {
  createTaskNotifications,
} = require('../utils/notificationHelper');


const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Task = require('../models/Task');
const User = require('../models/User');

const authMiddleware = require('../middleware/authMiddleware');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Lay thong tin cong viec kem cac tai khoan lien quan
const populateTask = (query) => {
 return query
    .populate('createdBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('assignedUsers', 'name email')
    .populate('acceptedBy', 'name email')
    .populate('sharedWith', 'name email')
    .populate('sharedPermissions.user', 'name email');
};




// Lay ID ke ca khi du lieu da populate
const getUserId = (value) => {
  return String(value?._id ?? value);
};

// Kiem tra nguoi dung co quyen xem cong viec
const canAccessTask = (task, userId) => {
  const id = String(userId);

  return (
    getUserId(task.createdBy) === id ||
    getUserId(task.assignedTo) === id ||
    (task.assignedUsers || []).some(
      user => getUserId(user) === id
    ) ||
    (task.sharedWith || []).some(
      user => getUserId(user) === id
    ) ||
    (task.sharedPermissions || []).some(
      item => getUserId(item.user) === id
    )
  );
};

// Lay quyen cua nguoi dung tren cong viec
const getTaskPermission = (task, userId) => {
  const id = String(userId);

  if (getUserId(task.createdBy) === id) {
    return 'owner';
  }

  const permission = (task.sharedPermissions || []).find(
    item => getUserId(item.user) === id
  );

  if (permission) {
    return permission.permission;
  }

  return 'viewer';
};

// =====================================================
// TIM TAI KHOAN THEO EMAIL
// GET /api/tasks/users/search
// =====================================================
router.get('/users/search', authMiddleware, async (req, res) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: 'Vui long nhap email can tim'
      });
    }

    const users = await User.find({
      email: { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      _id: { $ne: req.userId }
    }).select('name email');

    return res.status(200).json({
      message: 'Tim tai khoan thanh cong',
      users
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Loi tim tai khoan',
      error: error.message
    });
  }
});

// =====================================================
// C - CHIA SE CONG VIEC CHO NHIEU NGUOI
// POST /api/tasks/:id/share
// Body: { emails: [], permission: 'viewer' }


// =====================================================
// C3 - CHIA SE CONG VIEC CHO NHIEU NGUOI
// POST /api/tasks/:id/share
// Body: { emails: [], permission: 'viewer' | 'editor' }
// =====================================================
router.post('/:id/share', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { emails, permission = 'viewer' } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        message: 'Vui long nhap email nguoi can chia se'
      });
    }

    if (!['viewer', 'editor'].includes(permission)) {
      return res.status(400).json({
        message: 'Quyen chia se khong hop le'
      });
    }

    const normalizedEmails = [
      ...new Set(
        emails
          .filter(email => typeof email === 'string')
          .map(email => email.trim().toLowerCase())
          .filter(Boolean)
      )
    ];

    if (normalizedEmails.length === 0) {
      return res.status(400).json({
        message: 'Danh sach email khong hop le'
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    if (getUserId(task.createdBy) !== String(req.userId)) {
      return res.status(403).json({
        message: 'Chi nguoi tao moi duoc chia se cong viec'
      });
    }

    const creator = await User.findById(req.userId).select('email');

    if (!creator) {
      return res.status(404).json({
        message: 'Khong tim thay tai khoan nguoi chia se'
      });
    }

    if (normalizedEmails.includes(
      (creator.email || '').trim().toLowerCase()
    )) {
      return res.status(400).json({
        message: 'Khong the chia se cong viec cho chinh minh'
      });
    }

    const recipients = await User.find({
      email: { $in: normalizedEmails }
    }).select('_id name email');

    const foundEmails = recipients.map(user =>
      (user.email || '').trim().toLowerCase()
    );

    const notFoundEmails = normalizedEmails.filter(
      email => !foundEmails.includes(email)
    );

    if (notFoundEmails.length > 0) {
      return res.status(404).json({
        message: 'Mot hoac nhieu email khong ton tai',
        notFoundEmails
      });
    }

    if (!Array.isArray(task.sharedWith)) {
      task.sharedWith = [];
    }

    if (!Array.isArray(task.sharedPermissions)) {
      task.sharedPermissions = [];
    }

    let addedCount = 0;
    const newlySharedUsers = [];

    for (const user of recipients) {
      const userId = String(user._id);

      const alreadyShared = task.sharedWith.some(
        item => getUserId(item) === userId
      );

      if (!alreadyShared) {
        task.sharedWith.push(user._id);
        addedCount++;
        newlySharedUsers.push(user);
      }

      const existingPermission = task.sharedPermissions.find(
        item => getUserId(item.user) === userId
      );

      if (existingPermission) {
        existingPermission.permission = permission;
      } else {
        task.sharedPermissions.push({
          user: user._id,
          permission
        });
      }
    }

    await task.save();
    await createTaskNotifications({
      recipientIds: newlySharedUsers.map((user) => user._id),
      senderId: req.userId,
      taskId: task._id,
      type: 'share',
      title: 'Bạn được chia sẻ công việc',
      message: `Bạn vừa được chia sẻ công việc "${task.title}"`,
    });

    const result = await populateTask(Task.findById(id));



    // Gui email moi cho nguoi duoc chia se lan dau
    const emailResults = await Promise.allSettled(
      newlySharedUsers.map(user =>
        sendShareInvitationEmail(user.email, result, permission)
      )
    );

    const emailSentCount = emailResults.filter(
      item =>
        item.status === 'fulfilled' &&
        item.value === true
    ).length;

    return res.status(200).json({
      message: 'Chia se cong viec thanh cong',
      addedCount,
      sharedCount: result.sharedWith.length,
      emailSentCount,
      emailTotal: newlySharedUsers.length,
      task: result
    });

  } catch (error) {
    console.error('LOI CHIA SE CONG VIEC:', error);

    return res.status(500).json({
      message: 'Loi chia se cong viec',
      error: error.message
    });
  }
});
// =====================================================
// CAP NHAT CONG VIEC VA GUI EMAIL KHI THAY DOI
// PUT /api/tasks/:id
// =====================================================
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    // Kiem tra quyen cap nhat
    const isOwner =
      getUserId(task.createdBy) === String(req.userId);

    const permission = getTaskPermission(task, req.userId);

    if (!isOwner && permission !== 'editor') {
      return res.status(403).json({
        message: 'Ban khong co quyen chinh sua cong viec'
      });
    }

    // Luu du lieu cu
    const oldData = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedTo: getUserId(task.assignedTo),
      startDate: task.startDate
        ? new Date(task.startDate).getTime()
        : null,
      dueDate: task.dueDate
        ? new Date(task.dueDate).getTime()
        : null
    };

    const allowedFields = [
      'title',
      'description',
      'assignedTo',
      'status',
      'priority',
      'startDate',
      'dueDate'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    if (typeof task.title !== 'string' || !task.title.trim()) {
      return res.status(400).json({
        message: 'Ten cong viec khong duoc de trong'
      });
    }

    task.title = task.title.trim();

    const validStatuses = ['todo', 'in_progress', 'completed'];

    if (!validStatuses.includes(task.status)) {
      return res.status(400).json({
        message: 'Trang thai cong viec khong hop le'
      });
    }

    const validPriorities = ['low', 'medium', 'high'];

    if (!validPriorities.includes(task.priority)) {
      return res.status(400).json({
        message: 'Muc do uu tien khong hop le'
      });
    }

    if (
      task.assignedTo &&
      !isValidId(getUserId(task.assignedTo))
    ) {
      return res.status(400).json({
        message: 'ID nguoi duoc giao khong hop le'
      });
    }

    await task.save();

    const result = await populateTask(Task.findById(id));

    // So sanh cac thay doi
    const changes = [];

    const addChange = (field, label, oldValue, newValue) => {
      if (oldValue !== newValue) {
        changes.push({
          field,
          label,
          oldValue,
          newValue
        });
      }
    };

    addChange('title', 'Ten cong viec', oldData.title, task.title);

    addChange(
      'description',
      'Mo ta cong viec',
      oldData.description || 'Khong co',
      task.description || 'Khong co'
    );

    addChange('status', 'Trang thai', oldData.status, task.status);

    addChange(
      'priority',
      'Muc do uu tien',
      oldData.priority,
      task.priority
    );

    addChange(
      'assignedTo',
      'Nguoi phu trach',
      oldData.assignedTo,
      getUserId(task.assignedTo)
    );

    const newStartDate = task.startDate
      ? new Date(task.startDate).getTime()
      : null;

    addChange(
      'startDate',
      'Ngay bat dau',
      oldData.startDate,
      newStartDate
    );

    const newDueDate = task.dueDate
      ? new Date(task.dueDate).getTime()
      : null;

    addChange(
      'dueDate',
      'Han hoan thanh',
      oldData.dueDate,
      newDueDate
    );

    let emailSentCount = 0;
    let emailTotal = 0;

    if (changes.length > 0) {
      const recipientIds = [
        ...(task.createdBy ? [task.createdBy] : []),
        ...(task.assignedUsers || []),
        ...(task.assignedTo ? [task.assignedTo] : []),
        ...(task.sharedWith || []),
        ...(task.sharedPermissions || []).map(item => item.user)
      ]
        .filter(Boolean)
        .map(item => getUserId(item))
        .filter(Boolean);

      const uniqueRecipientIds = [
        ...new Set(recipientIds)
      ].filter(userId => userId !== String(req.userId));
      // Xac dinh loai thong bao
      const isJustCompleted =
        oldData.status !== 'completed' &&
        task.status === 'completed';

      // Tao thong bao cho cac thanh vien lien quan
      await createTaskNotifications({
        recipientIds: uniqueRecipientIds,
        senderId: req.userId,
        taskId: task._id,
        type: isJustCompleted ? 'completed' : 'update',
        title: isJustCompleted
            ? 'Công việc đã hoàn thành'
            : 'Công việc vừa được cập nhật',
        message: isJustCompleted
            ? `Công việc "${task.title}" đã được hoàn thành`
            : `Công việc "${task.title}" vừa có thay đổi`,
      });

      console.log(
        'Danh sach ID nguoi nhan email:',
        uniqueRecipientIds
      );

      const recipients = await User.find({
        _id: { $in: uniqueRecipientIds }
      }).select('name email');

      emailTotal = recipients.length;


      const emailResults = await Promise.allSettled(
        recipients.map(user => {
          if (isJustCompleted) {
            return sendTaskCompletedEmail(user.email, result);
          }

          return sendTaskUpdateEmail(user.email, result, changes);
        })
      );

      emailSentCount = emailResults.filter(
        item =>
          item.status === 'fulfilled' &&
          item.value === true
      ).length;

      console.log(
        `Cap nhat cong viec ${id}: da gui ${emailSentCount}/${emailTotal} email`
      );
    }

    return res.status(200).json({
      message: 'Cap nhat cong viec thanh cong',
      changes,
      emailSentCount,
      emailTotal,
      task: result
    });

  } catch (error) {
    console.error('LOI CAP NHAT CONG VIEC:', error);

    return res.status(500).json({
      message: 'Loi cap nhat cong viec',
      error: error.message
    });
  }
});

// TAO CONG VIEC MOI
// POST /api/tasks
// =====================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      startDate,
      dueDate,
      assignedTo
    } = req.body;

    // Kiem tra tieu de
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        message: 'Vui long nhap ten cong viec'
      });
    }

    // Kiem tra trang thai
    const validStatuses = ['todo', 'in_progress', 'completed'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Trang thai cong viec khong hop le'
      });
    }

    // Kiem tra muc do uu tien
    const validPriorities = ['low', 'medium', 'high'];

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        message: 'Muc do uu tien khong hop le'
      });
    }

    // Kiem tra nguoi duoc giao neu co
    if (
      assignedTo &&
      !mongoose.Types.ObjectId.isValid(assignedTo)
    ) {
      return res.status(400).json({
        message: 'ID nguoi duoc giao khong hop le'
      });
    }

    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);

      if (!assignedUser) {
        return res.status(404).json({
          message: 'Khong tim thay nguoi duoc giao'
        });
      }
    }

    // Tao cong viec
    const task = new Task({
      title: title.trim(),
      description: description || '',
      createdBy: req.userId,
      assignedTo: assignedTo || null,
      status: status || 'todo',
      priority: priority || 'medium',
      startDate: startDate || null,
      dueDate: dueDate || null,
      assignedUsers: assignedTo ? [assignedTo] : [],
      acceptedBy: [],
      sharedWith: [],
      sharedPermissions: []
    });

    await task.save();

    // Tao thong bao neu cong viec moi duoc giao cho nguoi khac
    if (assignedTo) {
      await createTaskNotifications({
        recipientIds: [assignedTo],
        senderId: req.userId,
        taskId: task._id,
        type: 'assignment',
        title: 'Bạn được giao công việc mới',
        message: `Bạn vừa được giao công việc "${task.title}"`,
      });
    }

    // Lay thong tin cong viec kem tai khoan
    const result = await populateTask(
      Task.findById(task._id)
    );

    return res.status(201).json({
      message: 'Tao cong viec thanh cong',
      task: result
    });

  } catch (error) {
    console.error('Loi tao cong viec:', error);

    return res.status(500).json({
      message: 'Loi tao cong viec',
      error: error.message
    });
  }
});

// =====================================================
// LAY CHI TIET CONG VIEC
// GET /api/tasks/:id
// =====================================================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    const task = await populateTask(Task.findById(id));

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    if (!canAccessTask(task, req.userId)) {
      return res.status(403).json({
        message: 'Ban khong co quyen xem cong viec nay'
      });
    }

    return res.status(200).json(task);
  } catch (error) {
    return res.status(500).json({
      message: 'Loi lay chi tiet cong viec',
      error: error.message
    });
  }
});
 //=====================================================
// LAY DANH SACH CONG VIEC
// GET /api/tasks
// =====================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const tasks = await populateTask(
      Task.find({
        $or: [
          { createdBy: userId },
          { assignedTo: userId },
          { assignedUsers: userId },
          { sharedWith: userId },
          { 'sharedPermissions.user': userId }
        ]
      }).sort({ createdAt: -1 })
    );

    return res.status(200).json(tasks);
  } catch (error) {
    console.error('Loi lay danh sach cong viec:', error);
    return res.status(500).json({
      message: 'Loi lay danh sach cong viec',
      error: error.message
    });
  }
});

// =====================================================
// C2 - CHI DINH NGUOI PHU TRACH CHINH
// PUT /api/tasks/:id/primary-assignee
// =====================================================
router.put('/:id/primary-assignee', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { primaryEmail } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    if (
      typeof primaryEmail !== 'string' ||
      !primaryEmail.trim()
    ) {
      return res.status(400).json({
        message: 'Vui long nhap email nguoi phu trach chinh'
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    const isOwner =
      String(task.createdBy) === String(req.userId);

    const permission = getTaskPermission(task, req.userId);

    if (!isOwner && permission !== 'editor') {
      return res.status(403).json({
        message: 'Ban khong co quyen chinh sua cong viec'
      });
    }

    const normalizedEmail = primaryEmail.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    }).select('_id name email');

    if (!user) {
      return res.status(404).json({
        message: 'Khong tim thay tai khoan'
      });
    }

    const isAssigned = (task.assignedUsers || []).some(
      userId => String(userId) === String(user._id)
    );

    if (!isAssigned) {
      return res.status(400).json({
        message: 'Nguoi phu trach chinh phai nam trong danh sach duoc giao'
      });
    }

    task.assignedTo = user._id;

    await task.save();

    const result = await populateTask(
      Task.findById(id)
    );

    return res.status(200).json({
      message: 'Chi dinh nguoi phu trach chinh thanh cong',
      task: result
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Loi chi dinh nguoi phu trach chinh',
      error: error.message
    });
  }
});

// =====================================================
// C1 - GIAO CONG VIEC CHO MOT HOAC NHIEU NGUOI
// PUT /api/tasks/:id/assign
// =====================================================
// Giao cong viec cho nhieu nguoi va gui email thong bao
// =====================================================
router.put('/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { emails, primaryEmail } = req.body;

    // Kiem tra ID cong viec
    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    // Kiem tra danh sach email
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        message: 'Vui long chon it nhat mot nguoi duoc giao'
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    // Chi nguoi tao moi duoc giao cong viec
    if (String(task.createdBy) !== String(req.userId)) {
      return res.status(403).json({
        message: 'Chi nguoi tao moi duoc giao cong viec'
      });
    }

    // Chuan hoa va loai bo email trung lap
    const normalizedEmails = [
      ...new Set(
        emails
          .filter(email => typeof email === 'string')
          .map(email => email.trim().toLowerCase())
          .filter(Boolean)
      )
    ];

    if (normalizedEmails.length === 0) {
      return res.status(400).json({
        message: 'Danh sach email khong hop le'
      });
    }

    // Tim tai khoan theo email
    const users = await User.find({
      email: { $in: normalizedEmails }
    }).select('_id name email');

    if (users.length !== normalizedEmails.length) {
      return res.status(404).json({
        message: 'Mot hoac nhieu email khong ton tai'
      });
    }

    const userIds = users.map(user => user._id);

    // Khong cho phep giao cho chinh minh
    if (
      userIds.some(
        userId => String(userId) === String(req.userId)
      )
    ) {
      return res.status(400).json({
        message: 'Khong the giao cong viec cho chinh minh'
      });
    }

    // Xac dinh nguoi phu trach chinh
    let primaryUser = users[0];

    if (
      primaryEmail !== undefined &&
      primaryEmail !== null &&
      primaryEmail !== ''
    ) {
      if (typeof primaryEmail !== 'string') {
        return res.status(400).json({
          message: 'Email nguoi phu trach khong hop le'
        });
      }

      const normalizedPrimaryEmail =
        primaryEmail.trim().toLowerCase();

      primaryUser = users.find(
        user =>
          user.email.trim().toLowerCase() === normalizedPrimaryEmail
      );

      if (!primaryUser) {
        return res.status(400).json({
          message: 'Nguoi phu trach chinh phai nam trong danh sach C1'
        });
      }
    }

    // Lay danh sach nguoi da duoc giao truoc do
    const oldAssignedIds = new Set(
      (task.assignedUsers || []).map(
        user => getUserId(user)
      )
    );

    // Chi lay nhung nguoi moi duoc giao
    const newlyAssignedUsers = users.filter(
      user => !oldAssignedIds.has(String(user._id))
    );

    // Cap nhat danh sach nguoi duoc giao
    task.assignedUsers = userIds;
    task.assignedTo = primaryUser._id;
    task.acceptedBy = [];

    await task.save();
    await createTaskNotifications({
      recipientIds: newlyAssignedUsers.map((user) => user._id),
      senderId: req.userId,
      taskId: task._id,
      type: 'assignment',
      title: 'Bạn được giao công việc mới',
      message: `Bạn vừa được giao công việc "${task.title}"`,
    });

    // Lay thong tin cong viec sau khi luu
    const result = await populateTask(
      Task.findById(id)
    );

    // Gui email cho nhung nguoi moi duoc giao
    // Loi gui email khong lam that bai viec giao cong viec
    const emailResults = await Promise.allSettled(
      newlyAssignedUsers.map(user =>
        sendAssignmentEmail(user.email, task)
      )
    );

    const emailSentCount = emailResults.filter(
      result => result.status === 'fulfilled' && result.value === true
    ).length;

    return res.status(200).json({
      message: 'Giao cong viec thanh cong',
      task: result,
      emailSentCount,
      emailTotal: newlyAssignedUsers.length
    });

  } catch (error) {
    console.error('Loi giao cong viec:', error);

    return res.status(500).json({
      message: 'Loi giao cong viec',
      error: error.message
    });
  }
});

// =====================================================
// NHAN / CHAP NHAN CONG VIEC
// POST /api/tasks/:id/accept
// =====================================================
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    const isAssigned =
      String(task.assignedTo) === userId ||
      (task.assignedUsers || []).some(
        item => String(item) === userId
      );

    if (!isAssigned) {
      return res.status(403).json({
        message: 'Ban khong duoc giao cong viec nay'
      });
    }

    if (
      !(task.acceptedBy || []).some(
        item => String(item) === userId
      )
    ) {
      task.acceptedBy.push(req.userId);
    }

    await task.save();

    const result = await populateTask(
      Task.findById(id)
    );

    return res.status(200).json({
      message: 'Nhan cong viec thanh cong',
      task: result
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Loi nhan cong viec',
      error: error.message
    });
  }
});




// =====================================================
// XOA CONG VIEC
// DELETE /api/tasks/:id
// Chi nguoi tao cong viec moi duoc xoa
// =====================================================
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Kiem tra ID
    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    // Tim cong viec
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    // Chi nguoi tao moi duoc xoa
    if (String(task.createdBy) !== String(req.userId)) {
      return res.status(403).json({
        message: 'Chi nguoi tao moi duoc xoa cong viec'
      });
    }

    // Xoa cong viec khoi MongoDB
    await Task.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'Xoa cong viec thanh cong',
      taskId: id
    });

  } catch (error) {
    console.error('LOI XOA CONG VIEC:', error);

    return res.status(500).json({
      message: 'Loi xoa cong viec',
      error: error.message
    });
  }
});

// =====================================================
// XOA CONG VIEC
// DELETE /api/tasks/:id
// =====================================================
// Thu hồi quyền truy cập của người được chia sẻ
router.delete('/:id/share', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    // Kiểm tra ID công việc
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'ID công việc không hợp lệ'
      });
    }

    // Kiểm tra email
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        message: 'Vui lòng cung cấp email người cần thu hồi quyền'
      });
    }

    // Lấy ID người đang đăng nhập
    const userId = String(req.userId || req.user?.id || req.user?._id || '');

    if (!userId) {
      return res.status(401).json({
        message: 'Không xác định được tài khoản đăng nhập'
      });
    }

    // Hàm lấy ID, hỗ trợ cả ObjectId và object đã populate
    const getId = (value) => {
      if (!value) return '';
      return String(value._id || value.id || value);
    };

    // Tìm công việc
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Không tìm thấy công việc'
      });
    }

    // Chỉ người tạo công việc mới được thu hồi quyền
    if (getId(task.createdBy) !== userId) {
      return res.status(403).json({
        message: 'Bạn không có quyền thu hồi truy cập'
      });
    }

    // Tìm người dùng theo email
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    }).select('_id name email');

    if (!user) {
      return res.status(404).json({
        message: 'Không tìm thấy người dùng'
      });
    }

    const targetUserId = String(user._id);

    // Kiểm tra người này có được chia sẻ công việc không
    const isShared = (task.sharedWith || []).some(
      item => getId(item) === targetUserId
    );

    if (!isShared) {
      return res.status(400).json({
        message: 'Người dùng chưa được chia sẻ công việc'
      });
    }

    // Xóa người dùng khỏi danh sách chia sẻ
    task.sharedWith = (task.sharedWith || []).filter(
      item => getId(item) !== targetUserId
    );

    // Xóa quyền Viewer / Editor
    task.sharedPermissions = (task.sharedPermissions || []).filter(
      item => getId(item.user) !== targetUserId
    );

    // Lưu vào MongoDB
    await task.save();

    return res.status(200).json({
      message: 'Đã thu hồi quyền truy cập thành công'
    });

  } catch (error) {
    console.error('LỖI THU HỒI QUYỀN:', error);

    return res.status(500).json({
      message: 'Lỗi máy chủ khi thu hồi quyền truy cập',
      error: error.message
    });
  }
});

module.exports = router;
