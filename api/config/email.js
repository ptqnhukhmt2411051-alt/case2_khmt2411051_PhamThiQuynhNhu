
const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');

// CAU HINH GMAIL SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  },
  tls: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});

// =====================================================
// LUU LICH SU GUI EMAIL
// =====================================================
const saveEmailLog = async ({
  recipientEmail,
  emailType,
  subject,
  task,
  status,
  messageId = null,
  errorMessage = null
}) => {
  try {
    await EmailLog.create({
      recipientEmail: recipientEmail || 'unknown',
      emailType,
      subject: subject || '',
      task: task?._id || null,
      taskTitle: task?.title || '',
      status,
      messageId,
      errorMessage: errorMessage
        ? String(errorMessage).substring(0, 2000)
        : null,
      sentAt: new Date()
    });
  } catch (error) {
    // Loi luu lich su khong duoc lam dung chuong trinh
    console.error(
      'Loi luu lich su email:',
      error.message
    );
  }
};

// =====================================================
// HAM GUI EMAIL DUNG CHUNG VA LUU LICH SU
// =====================================================
const sendAndLogEmail = async ({
  recipientEmail,
  task,
  emailType,
  mailOptions
}) => {
  try {
    if (!process.env.EMAIL_USER ||
        !process.env.EMAIL_APP_PASSWORD) {
      throw new Error(
        'Thieu cau hinh email trong file .env'
      );
    }

    if (!recipientEmail) {
      throw new Error('Email nguoi nhan khong hop le');
    }

    const info = await transporter.sendMail({
      ...mailOptions,
      from: '"Task Manager" <' + process.env.EMAIL_USER + '>',
      to: recipientEmail
    });

    await saveEmailLog({
      recipientEmail,
      emailType,
      subject: mailOptions.subject,
      task,
      status: 'success',
      messageId: info.messageId
    });

    console.log(
      'Da gui email thanh cong den ' + recipientEmail +
      '. Message ID: ' + info.messageId
    );

    return true;
  } catch (error) {
    console.error(
      'Loi gui email den ' + recipientEmail + ':',
      error.message
    );

    await saveEmailLog({
      recipientEmail,
      emailType,
      subject: mailOptions?.subject,
      task,
      status: 'failed',
      errorMessage: error.message
    });

    return false;
  }
};

// =====================================================
// GUI EMAIL KHI GIAO VIEC HOAC CHIA SE CONG VIEC
// =====================================================
const sendInvitationEmail = async ({
  recipientEmail,
  task,
  invitationType,
  permission = 'viewer'
}) => {
  const isAssignment = invitationType === 'assignment';

  const subject = isAssignment
    ? 'Ban vua duoc giao mot cong viec moi'
    : 'Ban duoc moi chia se cong viec trong Task Manager';

  const permissionText =
    permission === 'editor'
      ? 'Ban co quyen xem va chinh sua cong viec.'
      : 'Ban co quyen xem cong viec.';

  const text = [
    'Xin chao!',
    '',
    isAssignment
      ? 'Ban vua duoc giao tham gia mot cong viec moi.'
      : 'Ban vua duoc moi chia se mot cong viec.',
    '',
    'Thong tin cong viec:',
    '- Ten cong viec: ' + (task?.title || 'Chua co ten'),
    '- Mo ta: ' + (task?.description || 'Khong co mo ta'),
    '- Muc do uu tien: ' + (task?.priority || 'Chua xac dinh'),
    '- Trang thai: ' + (task?.status || 'todo'),
    '',
    isAssignment ? '' : permissionText,
    '',
    'Vui long dang nhap ung dung Task Manager de xem chi tiet.',
    '',
    'Tran trong,',
    'Task Manager'
  ].join('\n');

  return sendAndLogEmail({
    recipientEmail,
    task,
    emailType: isAssignment ? 'assignment' : 'share',
    mailOptions: {
      subject,
      text
    }
  });
};

// =====================================================
// GUI EMAIL KHI GIAO CONG VIEC
// =====================================================
const sendAssignmentEmail = async (recipientEmail, task) => {
  return sendInvitationEmail({
    recipientEmail,
    task,
    invitationType: 'assignment'
  });
};

// =====================================================
// GUI EMAIL KHI CHIA SE CONG VIEC
// =====================================================
const sendShareInvitationEmail = async (
  recipientEmail,
  task,
  permission = 'viewer'
) => {
  return sendInvitationEmail({
    recipientEmail,
    task,
    invitationType: 'share',
    permission
  });
};

// =====================================================
// GUI EMAIL KHI CONG VIEC THAY DOI
// =====================================================
const sendTaskUpdateEmail = async (
  recipientEmail,
  task,
  changes
) => {
  if (!Array.isArray(changes) || changes.length === 0) {
    return false;
  }

  const changeContent = changes.map((change) => {
    return '<li><strong>' +
      change.label +
      ':</strong> ' +
      (change.oldValue ?? 'Chua co') +
      ' &rarr; ' +
      (change.newValue ?? 'Chua co') +
      '</li>';
  }).join('');

  const html = [
    '<h2>Thong bao cap nhat cong viec</h2>',
    '<p>Xin chao,</p>',
    '<p>Mot cong viec ma ban dang tham gia vua duoc cap nhat.</p>',
    '<p><strong>Ten cong viec:</strong> ' +
      (task?.title || 'Chua co ten') + '</p>',
    '<p><strong>Noi dung thay doi:</strong></p>',
    '<ul>' + changeContent + '</ul>',
    '<p><strong>Han hoan thanh moi:</strong> ' +
      (task?.dueDate
        ? new Date(task.dueDate).toLocaleDateString('vi-VN')
        : 'Chua co') +
      '</p>',
    '<p><strong>Trang thai:</strong> ' +
      (task?.status || 'Chua xac dinh') + '</p>',
    '<p><strong>Muc do uu tien:</strong> ' +
      (task?.priority || 'Chua xac dinh') + '</p>',
    '<p>Vui long dang nhap ung dung Task Manager de xem chi tiet.</p>',
    '<p>Tran trong,<br>Task Manager</p>'
  ].join('\n');

  return sendAndLogEmail({
    recipientEmail,
    task,
    emailType: 'update',
    mailOptions: {
      subject: 'Thong bao cap nhat cong viec: ' +
        (task?.title || 'Task Manager'),
      html
    }
  });
};

// =====================================================
// GUI EMAIL KHI CONG VIEC HOAN THANH
// =====================================================
const sendTaskCompletedEmail = async (recipientEmail, task) => {
  const text = [
    'Xin chao!',
    '',
    'Mot cong viec ma ban tham gia da duoc danh dau la HOAN THANH.',
    '',
    'Ten cong viec: ' + (task?.title || 'Khong co'),
    'Mo ta: ' + (task?.description || 'Khong co'),
    'Han hoan thanh: ' + (
      task?.dueDate
        ? new Date(task.dueDate).toLocaleDateString('vi-VN')
        : 'Chua co'
    ),
    '',
    'Hay dang nhap Task Manager de xem chi tiet.',
    '',
    'Tran trong,',
    'Task Manager'
  ].join('\n');

  return sendAndLogEmail({
    recipientEmail,
    task,
    emailType: 'completed',
    mailOptions: {
      subject: '[Task Manager] Cong viec da hoan thanh',
      text
    }
  });
};

// =====================================================
// GUI EMAIL NHAC VIEC TRUOC HAN 24 GIO
// =====================================================
const sendTaskReminderEmail = async (email, task) => {
  if (!task?.dueDate) {
    return sendAndLogEmail({
      recipientEmail: email,
      task,
      emailType: 'reminder',
      mailOptions: {
        subject: '[Task Manager] Nhac nho cong viec sap den han',
        text: 'Khong tim thay han hoan thanh cua cong viec.'
      }
    });
  }

  const dueDate = new Date(task.dueDate);

  const formattedDueDate = dueDate.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const text = [
    'Xin chao!',
    '',
    'He thong Task Manager thong bao cong viec cua ban sap den han hoan thanh.',
    '',
    'Ten cong viec: ' + (task.title || 'Chua co ten'),
    'Mo ta: ' + (task.description || 'Khong co mo ta'),
    'Han hoan thanh: ' + formattedDueDate,
    '',
    'Vui long kiem tra va hoan thanh cong viec dung han.',
    '',
    'Tran trong,',
    'Task Manager'
  ].join('\n');

  return sendAndLogEmail({
    recipientEmail: email,
    task,
    emailType: 'reminder',
    mailOptions: {
      subject: '[Task Manager] Nhac nho cong viec sap den han',
      text
    }
  });
};

// =====================================================
// XUAT CAC HAM
// =====================================================
module.exports = {
  sendAssignmentEmail,
  sendShareInvitationEmail,
  sendTaskUpdateEmail,
  sendTaskCompletedEmail,
  sendTaskReminderEmail
};