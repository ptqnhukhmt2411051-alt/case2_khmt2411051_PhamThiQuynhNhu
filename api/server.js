const taskRoutes = require('./routes/task');
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/tasks', taskRoutes);
app.get('/', (req, res) => {
  res.json({
    message: 'Task Manager API is running!',
  });
});

// Ket noi API dang ky va dang nhap
app.use('/api/auth', require('./routes/auth'));

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
