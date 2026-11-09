const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Hàm gửi email thông báo giao công việc
const sendAssignmentEmail = async (recipientEmail, task) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      throw new Error('Chưa cấu hình EMAIL_USER hoặc EMAIL_APP_PASSWORD trong .env');
    }

    await transporter.sendMail({
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: 'Bạn vừa được giao một công việc mới',
      text: `
Xin chào!

Bạn vừa được giao một công việc mới.

Tên công việc: ${task.title}
Mô tả: ${task.description || 'Không có mô tả'}
Mức độ ưu tiên: ${task.priority || 'Chưa xác định'}
Trạng thái: ${task.status || 'todo'}

Vui lòng đăng nhập ứng dụng Task Manager để xem chi tiết.

Trân trọng,
Task Manager
      `,
    });

    console.log(`Đã gửi email giao việc đến: ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Lỗi gửi email giao việc đến ${recipientEmail}:`, error.message);
    return false;
  }
};

// Hàm gửi email khi người dùng được mời chia sẻ công việc
const sendShareInvitationEmail = async (recipientEmail, task, permission = 'viewer') => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      throw new Error('Chưa cấu hình EMAIL_USER hoặc EMAIL_APP_PASSWORD trong .env');
    }

    const permissionText =
      permission === 'editor'
        ? 'Chỉnh sửa công việc'
        : 'Chỉ xem công việc';

    await transporter.sendMail({
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: 'Bạn được mời tham gia công việc trên Task Manager',
      text: `
Xin chào!

Bạn vừa được mời tham gia một công việc trên ứng dụng Task Manager.

Tên công việc: ${task.title}
Mô tả: ${task.description || 'Không có mô tả'}
Mức độ ưu tiên: ${task.priority || 'Chưa xác định'}

Quyền được cấp: ${permissionText}

Vui lòng đăng nhập ứng dụng Task Manager bằng tài khoản của bạn để xem công việc được chia sẻ.

Trân trọng,
Task Manager
      `,
    });

    console.log(`Đã gửi email mời chia sẻ đến: ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Lỗi gửi email mời chia sẻ đến ${recipientEmail}:`, error.message);
    return false;
  }
};

module.exports = {
  sendAssignmentEmail,
  sendShareInvitationEmail,
};