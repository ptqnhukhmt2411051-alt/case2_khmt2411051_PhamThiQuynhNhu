const cron = require('node-cron');

const Task = require('../models/Task');
const User = require('../models/User');

const {
  sendTaskReminderEmail
} = require('../config/email');

// Lay ID cua nguoi dung
const getUserId = (value) => {
  return String(value?._id ?? value);
};

// =====================================================
// KIEM TRA VA GUI EMAIL NHAC VIEC
// =====================================================
const checkTaskReminders = async () => {
  try {
    const now = new Date();

    // Tim cong viec con han trong vong 24 gio
    const reminderLimit = new Date(
      now.getTime() + 24 * 60 * 60 * 1000
    );

    const tasks = await Task.find({
      dueDate: {
        $gt: now,
        $lte: reminderLimit
      },
      status: {
        $ne: 'completed'
      }
    });

    for (const task of tasks) {
      // Kiem tra da nhac cho han nay chua
      const alreadyReminded =
        task.reminderSentForDueDate &&
        new Date(task.reminderSentForDueDate).getTime() ===
        new Date(task.dueDate).getTime();

      if (alreadyReminded) {
        continue;
      }

      // Lay nguoi tao va nhung nguoi duoc giao
      const recipientIds = [
        task.createdBy,
        task.assignedTo,
        ...(task.assignedUsers || [])
      ]
        .filter(Boolean)
        .map(item => getUserId(item));

      const uniqueRecipientIds = [
        ...new Set(recipientIds)
      ];

      if (uniqueRecipientIds.length === 0) {
        console.log(
          'Cong viec chua co nguoi nhan email:',
          task.title
        );
        continue;
      }

      const recipients = await User.find({
        _id: {
          $in: uniqueRecipientIds
        }
      }).select('name email');

      let allEmailsSent = true;
      let attemptedCount = 0;

      for (const user of recipients) {
        if (!user.email) {
          allEmailsSent = false;
          continue;
        }

        attemptedCount++;

        const sent = await sendTaskReminderEmail(
          user.email,
          task
        );

        if (!sent) {
          allEmailsSent = false;
        }
      }

      // Chi danh dau da nhac khi co it nhat mot email
      // duoc thu gui va tat ca cac email deu thanh cong
      if (attemptedCount > 0 && allEmailsSent) {
        task.reminderSentForDueDate = task.dueDate;

        await task.save();

        console.log(
          'Da nhac viec thanh cong:',
          task.title
        );
      } else {
        console.log(
          'Nhac viec chua hoan tat, se thu lai o lan kiem tra sau:',
          task.title
        );
      }
    }
  } catch (error) {
    console.error(
      'LOI KIEM TRA NHAC VIEC:',
      error.message
    );
  }
};

// =====================================================
// KHOI DONG LICH NHAC VIEC MOI 15 PHUT
// =====================================================
const startTaskReminderScheduler = () => {
  cron.schedule('*/15 * * * *', () => {
    console.log(
      'Dang kiem tra cac cong viec sap den han...'
    );

    checkTaskReminders();
  });

  console.log(
    'Da khoi dong lich nhac viec moi 15 phut'
  );
};

module.exports = {
  startTaskReminderScheduler,
  checkTaskReminders
};