const {
  sendAssignmentEmail,
  sendShareInvitationEmail,
  sendTaskUpdateEmail,
  sendTaskCompletedEmail
} = require('../config/email');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Task = require('../models/Task');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const TaskActivity = require('../models/TaskActivity');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const TaskHistory = require('../models/TaskHistory');

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
// Ghi lich su hoat dong cua cong viec
const logTaskActivity = async ({
  task,
  actor,
  action,
  description,
  details = {}
}) => {
  try {
    await TaskActivity.create({
      task: task._id,
      taskTitle: task.title || '',
      actor,
      action,
      description,
      details
    });
  } catch (error) {
    console.error('Loi ghi lich su hoat dong:', error);
  }
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

    if (String(task.createdBy) !== String(req.userId)) {
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

    if (normalizedEmails.includes(creator.email.toLowerCase())) {
      return res.status(400).json({
        message: 'Khong the chia se cong viec cho chinh minh'
      });
    }

    const recipients = await User.find({
      email: { $in: normalizedEmails }
    }).select('_id name email');

    if (recipients.length !== normalizedEmails.length) {
      const foundEmails = recipients.map(
        user => user.email.toLowerCase()
      );

      return res.status(404).json({
        message: 'Mot hoac nhieu email khong ton tai',
        notFoundEmails: normalizedEmails.filter(
          email => !foundEmails.includes(email)
        )
      });
    }

    if (!task.sharedWith) {
      task.sharedWith = [];
    }

    if (!task.sharedPermissions) {
      task.sharedPermissions = [];
    }

   let addedCount = 0;
   const newlySharedRecipients = [];

   for (const user of recipients) {
     const userId = String(user._id);

     const alreadyShared = task.sharedWith.some(
       item => getUserId(item) === userId
     );

     if (!alreadyShared) {
       task.sharedWith.push(user._id);
       addedCount++;
       newlySharedRecipients.push(user);
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

   await Promise.allSettled(
     newlySharedRecipients.map(user =>
       sendShareInvitationEmail(user.email, task, permission)
     )
   );

   await logTaskActivity({
     task,
     actor: req.userId,
     action: 'share',
     description: `Đã chia sẻ công việc cho ${recipients.length} người`,
     details: {
       emails: recipients.map(user => user.email),
       permission
     }
   });

   const updatedTask = await populateTask(Task.findById(id));

     return res.status(200).json({
         message: 'Chia se cong viec thanh cong',
         task: updatedTask,
         addedCount,
         sharedCount: task.sharedWith.length
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
// CAP NHAT QUYEN CHIA SE
// PUT /api/tasks/:id/share-permission
// Body: { email: "user@gmail.com", permission: "editor" }
// =====================================================
router.put('/:id/share-permission', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, permission } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

    if (
      typeof email !== 'string' ||
      !email.trim() ||
      !['viewer', 'editor'].includes(permission)
    ) {
      return res.status(400).json({
        message: 'Email hoac quyen chia se khong hop le'
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Khong tim thay cong viec'
      });
    }

    if (String(task.createdBy) !== String(req.userId)) {
      return res.status(403).json({
        message: 'Chi nguoi tao moi duoc thay doi quyen chia se'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select('_id name email');

    if (!user) {
      return res.status(404).json({
        message: 'Khong tim thay tai khoan'
      });
    }

    const isShared = (task.sharedWith || []).some(
      item => getUserId(item) === String(user._id)
    );

    if (!isShared) {
      return res.status(400).json({
        message: 'Nguoi nay chua duoc chia se cong viec'
      });
    }

    if (!task.sharedPermissions) {
      task.sharedPermissions = [];
    }

    const existingPermission = task.sharedPermissions.find(
      item => getUserId(item.user) === String(user._id)
    );

    if (existingPermission) {
      existingPermission.permission = permission;
    } else {
      task.sharedPermissions.push({
        user: user._id,
        permission
      });
    }

    await task.save();
    await logTaskActivity({
      task,
      actor: req.userId,
      action: 'change_share_permission',
      description: `Đã thay đổi quyền chia sẻ của ${user.email} thành ${permission}`,
      details: {
        email: user.email,
        permission
      }
    });
    const result = await populateTask(Task.findById(id));

    return res.status(200).json({
      message: 'Cap nhat quyen chia se thanh cong',
      task: result
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Loi cap nhat quyen chia se',
      error: error.message
    });
  }
});
// TAO CONG VIEC MOI
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      startDate,
      dueDate
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: 'Vui long nhap ten cong viec'
      });
    }

    const task = await Task.create({
      title: title.trim(),
      description: description || '',
      createdBy: req.userId,
      assignedTo: null,
      assignedUsers: [],
      acceptedBy: [],
      sharedWith: [],
      sharedPermissions: [],
      status: status || 'todo',
      priority: priority || 'medium',
      startDate: startDate || null,
      dueDate: dueDate || null
    });

    const result = await populateTask(
      Task.findById(task._id)
    );

    return res.status(201).json({
      message: 'Tao cong viec thanh cong',
      task: result
    });
  } catch (error) {
    console.error('LOI TAO CONG VIEC:', error);

    return res.status(500).json({
      message: 'Loi tao cong viec',
      error: error.message
    });
  }
});

// =====================================================
// LAY DANH SACH CONG VIEC
// GET /api/tasks
// =====================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [
        { createdBy: req.userId },
        { assignedTo: req.userId },
        { assignedUsers: req.userId },
        { sharedWith: req.userId }
      ]
    })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('assignedUsers', 'name email')
      .populate('acceptedBy', 'name email')
      .populate('sharedWith', 'name email')
      .populate('sharedPermissions.user', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json(tasks);
  } catch (error) {
    return res.status(500).json({
      message: 'Loi lay danh sach cong viec',
      error: error.message
    });
  }
});
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const histories = await TaskHistory.find({
      $or: [
        { createdBy: req.userId },
        { assignedTo: req.userId },
        { assignedUsers: req.userId },
        { completedBy: req.userId }
      ]
    })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('assignedUsers', 'name email')
      .populate('completedBy', 'name email')
      .sort({ completedAt: -1 });

    return res.status(200).json(histories);
  } catch (error) {
    return res.status(500).json({
      message: 'Loi lay lich su cong viec',
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

    const oldPrimaryAssigneeId = getUserId(task.assignedTo);

    task.assignedTo = user._id;

    await task.save();
    // Chỉ gửi email nếu người phụ trách chính thực sự thay đổi.
    if (oldPrimaryAssigneeId !== String(user._id)) {
      await Promise.allSettled([
        sendAssignmentEmail(user.email, task)
      ]);
    }
    await logTaskActivity({
      task,
      actor: req.userId,
      action: 'change_primary_assignee',
      description: `Đã thay đổi người phụ trách chính thành ${user.email}`,
      details: {
        email: user.email
      }
    });

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
router.put('/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { emails, primaryEmail } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'ID cong viec khong hop le'
      });
    }

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

    if (String(task.createdBy) !== String(req.userId)) {
      return res.status(403).json({
        message: 'Chi nguoi tao moi duoc giao cong viec'
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

    const users = await User.find({
      email: { $in: normalizedEmails }
    }).select('_id name email');

    if (users.length !== normalizedEmails.length) {
      return res.status(404).json({
        message: 'Mot hoac nhieu email khong ton tai'
      });
    }

    const userIds = users.map(user => user._id);

    if (
      userIds.some(
        userId => String(userId) === String(req.userId)
      )
    ) {
      return res.status(400).json({
        message: 'Khong the giao cong viec cho chinh minh'
      });
    }

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

      const normalizedPrimaryEmail = primaryEmail.trim().toLowerCase();

      primaryUser = users.find(
        user => user.email.trim().toLowerCase() === normalizedPrimaryEmail
      );

      if (!primaryUser) {
        return res.status(400).json({
          message: 'Nguoi phu trach chinh phai nam trong danh sach C1'
        });
      }
    }

    task.assignedUsers = userIds;
    task.assignedTo = primaryUser._id;
    task.acceptedBy = [];

    await task.save();
    // Gửi email thông báo giao công việc cho những người được giao.
    await Promise.allSettled(
      users.map(user =>
        sendAssignmentEmail(user.email, task)
      )
    );
    await logTaskActivity({
      task,
      actor: req.userId,
      action: 'assign',
      description: `Đã giao công việc cho ${users.length} người`,
      details: {
        emails: users.map(user => user.email)
      }
    });

    const result = await populateTask(
      Task.findById(id)
    );

    return res.status(200).json({
      message: 'Giao cong viec thanh cong',
      task: result
    });
  } catch (error) {
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
    await logTaskActivity({
      task,
      actor: req.userId,
      action: 'accept',
      description: 'Đã chấp nhận công việc'
    });

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
// CAP NHAT CONG VIEC
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

      if (String(task.createdBy) !== String(req.userId)) {
        return res.status(403).json({
          message: 'Chi nguoi tao moi duoc cap nhat cong viec'
        });
      }

      const oldStatus = task.status;
      const oldPriority = task.priority;

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

      if (
        task.assignedTo &&
        !isValidId(task.assignedTo)
      ) {
        return res.status(400).json({
          message: 'ID nguoi duoc giao khong hop le'
        });
      }

      await task.save();
      // Gửi email khi công việc vừa chuyển sang trạng thái Hoàn thành.
      if (oldStatus !== 'completed' && task.status === 'completed') {
        try {
          // Lấy ID người tạo, người được giao và người được chia sẻ.
          const recipientIds = [
            task.createdBy,
            task.assignedTo,
            ...(task.assignedUsers || []),
            ...(task.sharedWith || []),
            ...(task.sharedPermissions || []).map(item => item.user)
          ]
            .filter(Boolean)
            .map(getUserId)
            .filter(id => id && id !== 'null' && id !== 'undefined');

          // Loại bỏ ID trùng nhau.
          const uniqueRecipientIds = [...new Set(recipientIds)];

          // Lấy thông tin email của những người nhận.
          const recipients = await User.find({
            _id: { $in: uniqueRecipientIds }
          }).select('name email');

          // Gửi email cho tất cả người nhận.
          const emailResults = await Promise.allSettled(
            recipients
              .filter(user => user.email)
              .map(user => sendTaskCompletedEmail(user.email, task))
          );

          const failedCount = emailResults.filter(
            result => result.status === 'rejected'
          ).length;

          console.log(
            `Email hoàn thành công việc: ${recipients.length - failedCount}/${recipients.length} gửi thành công.`
          );
        } catch (emailError) {
          // Lỗi gửi email không làm mất kết quả cập nhật công việc.
          console.error('Loi gui email hoan thanh cong viec:', emailError);
        }
      }
      if (oldStatus !== task.status) {
        await logTaskActivity({
          task,
          actor: req.userId,
          action: 'change_status',
          description: `Đã thay đổi trạng thái từ ${oldStatus} thành ${task.status}`
        });
      }

      if (oldPriority !== task.priority) {
        await logTaskActivity({
          task,
          actor: req.userId,
          action: 'change_priority',
          description: `Đã thay đổi mức độ ưu tiên từ ${oldPriority} thành ${task.priority}`
        });
      }

      // Lưu lịch sử khi vừa hoàn thành công việc.
      // Nếu lần lưu lịch sử trước bị lỗi, lần cập nhật sau
      // vẫn có thể bổ sung bản ghi còn thiếu.
      if (task.status === 'completed') {
        const isJustCompleted = oldStatus !== 'completed';
        const historyExists = await TaskHistory.exists({
          taskId: task._id
        });

        if (isJustCompleted || !historyExists) {
          await TaskHistory.findOneAndUpdate(
            { taskId: task._id },
            {
              $set: {
                title: task.title,
                description: task.description || '',
                createdBy: task.createdBy,
                assignedTo: task.assignedTo,
                assignedUsers: task.assignedUsers || [],
                priority: task.priority,
                startDate: task.startDate,
                dueDate: task.dueDate,
                completedBy: req.userId,
                completedAt: new Date()
              }
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
              runValidators: true
            }
          );
        }
      }

      const result = await populateTask(
        Task.findById(id)
      );

      return res.status(200).json({
        message: 'Cap nhat cong viec thanh cong',
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
    await logTaskActivity({
      task,
      actor: req.userId,
      action: 'revoke_share',
      description: `Đã thu hồi quyền chia sẻ của ${user.email}`,
      details: {
        email: user.email
      }
    });


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
