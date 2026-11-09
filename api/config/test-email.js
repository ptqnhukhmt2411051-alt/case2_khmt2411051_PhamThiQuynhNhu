
require('dotenv').config();

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

async function testEmail() {
  try {
    await transporter.verify();
    console.log('Ket noi Gmail thanh cong!');

    const result = await transporter.sendMail({
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'Test email Task Manager',
      text: 'Day la email kiem tra chuc nang gui email.',
    });

    console.log('Gui email thanh cong!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('Gui email that bai:', error.message);
  }
}

testEmail();
