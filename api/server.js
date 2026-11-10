require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const {
  startTaskReminderScheduler
} = require('./services/taskReminder');

const taskRoutes = require('./routes/task');
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notification');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);


app.get('/', (req, res) => {
  res.json({
    message: 'Task Manager API is running!',
  });
});
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Ket noi MongoDB thanh cong!');

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`Backend dang chay tai port ${PORT}`);

      startTaskReminderScheduler();
    });
  } catch (error) {
    console.error('Loi khoi dong backend:', error.message);
    process.exit(1);
  }
}

startServer();