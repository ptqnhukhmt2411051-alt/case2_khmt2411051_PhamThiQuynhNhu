const mongoose = require('mongoose');
const Notification = require('../models/Notification');

const createTaskNotifications = async ({
  recipientIds = [],
  senderId,
  taskId,
  type,
  title,
  message,
}) => {
  try {
    console.log('===== BAT DAU TAO THONG BAO =====');
    console.log('Recipient IDs:', recipientIds);
    console.log('Sender ID:', senderId);
    console.log('Task ID:', taskId);
    console.log('Type:', type);

    const sender = String(senderId);

    const uniqueRecipientIds = [
      ...new Set(
        recipientIds
          .filter(Boolean)
          .map(id => String(id))
          .filter(id => id !== sender)
      ),
    ];

    if (uniqueRecipientIds.length === 0) {
      console.log('Khong co nguoi nhan thong bao');
      return 0;
    }

    const notifications = uniqueRecipientIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => ({
        recipient: id,
        sender: senderId,
        task: taskId || null,
        type,
        title,
        message,
        isRead: false,
      }));

    if (notifications.length === 0) {
      console.log('Khong co ID nguoi nhan hop le');
      return 0;
    }

    const result = await Notification.insertMany(notifications);

    console.log('Da tao thanh cong:', result.length);
    console.log('===== KET THUC TAO THONG BAO =====');

    return result.length;
  } catch (error) {
    console.error('===== LOI TAO THONG BAO =====');
    console.error(error);
    return 0;
  }
};

module.exports = {
  createTaskNotifications,
};