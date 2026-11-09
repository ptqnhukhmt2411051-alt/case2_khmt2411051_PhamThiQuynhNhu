
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

// Gui email nhac viec
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
      // Neu da nhac cho dung han nay thi bo qua
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

      // Loai bo ID trung lap
      const uniqueRecipientIds = [
        ...new Set(recipientIds)
      ];

      if (uniqueRecipientIds.length === 0) {
        continue;
      }

      const recipients = await User.find({
        _id: {
          $in: uniqueRecipientIds
        }
      }).select('name email');

      let allEmailsSent = true;

      for (const user of recipients) {
        if (!user.email) {
          continue;
        }

        const sent = await sendTaskReminderEmail(
          user.email,
          task
        );

        if (!sent) {
          allEmailsSent = false;
        }
      }

      // Chi danh dau da nhac khi cac email gui thanh cong
      if (allEmailsSent) {
        task.reminderSentForDueDate = task.dueDate;

        await task.save();

        console.log(
          `Da nhac viec thanh cong: ${task.title}`
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

// Chay kiem tra moi 15 phut
const startTaskReminderScheduler = () => {
  cron.schedule('*/15 * * * *', () => {
    console.log('Dang kiem tra cac cong viec sap den han...');
    checkTaskReminders();
  });

  console.log('Da khoi dong lich nhac viec moi 15 phut');
};

module.exports = {
  startTaskReminderScheduler,
  checkTaskReminders
};
