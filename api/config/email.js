
const nodemailer = require('nodemailer');

// =====================================================
// CAU HINH GMAIL SMTP
// =====================================================
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

// =====================================================
// HAM GUI EMAIL DUNG CHUNG
// =====================================================
const sendInvitationEmail = async ({
  recipientEmail,
  task,
  invitationType,
  permission = 'viewer',
}) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      throw new Error('Thieu cau hinh email trong file .env');
    }

    if (!recipientEmail) {
      throw new Error('Email nguoi nhan khong hop le');
    }

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
      '- Ten cong viec: ' + (task.title || 'Chua co ten'),
      '- Mo ta: ' + (task.description || 'Khong co mo ta'),
      '- Muc do uu tien: ' + (task.priority || 'Chua xac dinh'),
      '- Trang thai: ' + (task.status || 'todo'),
      '',
      isAssignment ? '' : permissionText,
      '',
      'Vui long dang nhap ung dung Task Manager de xem chi tiet.',
      '',
      'Tran trong,',
      'Task Manager',
    ].join('\n');

    const info = await transporter.sendMail({
      from: '"Task Manager" <' + process.env.EMAIL_USER + '>',
      to: recipientEmail,
      subject: subject,
      text: text,
    });

    console.log(
      'Da gui email den ' + recipientEmail +
      '. Message ID: ' + info.messageId
    );

    return true;
  } catch (error) {
    console.error(
      'Loi gui email den ' + recipientEmail + ':',
      error.message
    );
    return false;
  }
};

// =====================================================
// GUI EMAIL KHI GIAO CONG VIEC
// =====================================================
const sendAssignmentEmail = async (recipientEmail, task) => {
  return sendInvitationEmail({
    recipientEmail: recipientEmail,
    task: task,
    invitationType: 'assignment',
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
    recipientEmail: recipientEmail,
    task: task,
    invitationType: 'share',
    permission: permission,
  });
};

// =====================================================
// GUI EMAIL KHI THONG TIN CONG VIEC THAY DOI
// =====================================================
const sendTaskUpdateEmail = async (
  recipientEmail,
  task,
  changes
) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      throw new Error('Thieu cau hinh email trong file .env');
    }

    if (!recipientEmail) {
      throw new Error('Email nguoi nhan khong hop le');
    }

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
        (task.title || 'Chua co ten') + '</p>',
      '<p><strong>Noi dung thay doi:</strong></p>',
      '<ul>' + changeContent + '</ul>',
      '<p><strong>Han hoan thanh moi:</strong> ' +
        (task.dueDate
          ? new Date(task.dueDate).toLocaleDateString('vi-VN')
          : 'Chua co') +
        '</p>',
      '<p><strong>Trang thai:</strong> ' +
        (task.status || 'Chua xac dinh') + '</p>',
      '<p><strong>Muc do uu tien:</strong> ' +
        (task.priority || 'Chua xac dinh') + '</p>',
      '<p>Vui long dang nhap ung dung Task Manager de xem chi tiet.</p>',
      '<p>Tran trong,<br>Task Manager</p>',
    ].join('\n');

    const info = await transporter.sendMail({
      from: '"Task Manager" <' + process.env.EMAIL_USER + '>',
      to: recipientEmail,
      subject: 'Thong bao cap nhat cong viec: ' +
        (task.title || 'Task Manager'),
      html: html,
    });

    console.log(
      'Da gui email cap nhat den ' + recipientEmail +
      '. Message ID: ' + info.messageId
    );

    return true;
  } catch (error) {
    console.error(
      'Loi gui email cap nhat den ' + recipientEmail + ':',
      error.message
    );
    return false;
  }
};

// =====================================================
// XUAT CAC HAM DE task.js SU DUNG
// =====================================================
module.exports = {
  sendAssignmentEmail,
  sendShareInvitationEmail,
  sendTaskUpdateEmail,
};
