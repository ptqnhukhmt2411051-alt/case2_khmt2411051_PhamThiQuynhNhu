
// PHẢI nạp .env trước khi import các file khác
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Import routes sau khi đã nạp .env
const taskRoutes = require('./routes/task');
const authRoutes = require('./routes/auth');

app.use(cors());
app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Task Manager API is running!',
  });
});

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
