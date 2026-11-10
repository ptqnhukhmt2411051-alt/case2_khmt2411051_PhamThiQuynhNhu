
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Import các routes
const taskRoutes = require('./routes/task');
const activityRoutes = require('./routes/activity');
const notificationRoutes = require('./routes/notification');

// Middleware
app.use(cors());
app.use(express.json());

// API công việc
app.use('/api/tasks', taskRoutes);

// API lịch sử hoạt động
app.use('/api/tasks', activityRoutes);

// API thông báo
app.use('/api/notifications', notificationRoutes);

// API đăng ký và đăng nhập
app.use('/api/auth', require('./routes/auth'));

// Kiểm tra Backend
app.get('/', (req, res) => {
  res.json({
    message: 'Task Manager API is running!',
  });
});

// Kết nối MongoDB và khởi động server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Ket noi MongoDB thanh cong!');

    const port = process.env.PORT || 3000;

    app.listen(port, '0.0.0.0', () => {
      console.log(`Backend dang chay tai port ${port}`);
    });
  } catch (error) {
    console.error('Loi khoi dong backend:', error.message);
    process.exit(1);
  }
}

startServer();
