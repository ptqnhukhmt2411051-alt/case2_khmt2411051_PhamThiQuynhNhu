
const nodemailer = require('nodemailer');

// Cấu hình Gmail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
  tls: {
    minVersion: 'TLSv1.2',
  },
});

// Hàm gửi email dùng chung
const sendInvitationEmail = async ({
  recipientEmail,
  task,
  invitationType,
  permission = 'viewer',
}) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      throw new Error(
        'Thieu EMAIL_USER hoac EMAIL_APP_PASSWORD trong file .env'
      );
    }

    if (!recipientEmail) {
      throw new Error('Email nguoi nhan khong hop le');
    }

    const isAssignment = invitationType === 'assignment';

    const subject = isAssignment
      ? 'Ban vua duoc giao mot cong viec moi'
      : 'Ban duoc moi xem cong viec trong Task Manager';

    const permissionText =
      permission === 'editor'
        ? 'Ban co quyen xem va chinh sua cong viec.'
        : 'Ban co quyen xem cong viec.';

    const text = `
Xin chao!

${isAssignment
  ? 'Ban vua duoc giao tham gia mot cong viec moi.'
  : 'Ban vua duoc moi chia se mot cong viec.'}

Thong tin cong viec:
- Ten cong viec: ${task.title || 'Chua co ten'}
- Mo ta: ${task.description || 'Khong co mo ta'}
- Muc do uu tien: ${task.priority || 'Chua xac dinh'}
- Trang thai: ${task.status || 'todo'}

${isAssignment ? '' : permissionText}

Vui long dang nhap ung dung Task Manager de xem chi tiet.

Tran trong,
Task Manager
`;

    const info = await transporter.sendMail({
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject,
      text,
    });

    console.log(
      `Da gui email den ${recipientEmail}. Message ID: ${info.messageId}`
    );

    return true;
  } catch (error) {
    console.error(
      `Loi gui email den ${recipientEmail}:`,
      error.message
    );

    return false;
  }
};

// Gửi email khi giao công việc
const sendAssignmentEmail = async (recipientEmail, task) => {
  return sendInvitationEmail({
    recipientEmail,
    task,
    invitationType: 'assignment',
  });
};

// Gửi email khi chia sẻ công việc
const sendShareInvitationEmail = async (
  recipientEmail,
  task,
  permission = 'viewer'
) => {
  return sendInvitationEmail({
    recipientEmail,
    task,
    invitationType: 'share',
    permission,
  });
};

module.exports = {
  sendAssignmentEmail,
  sendShareInvitationEmail,
};
