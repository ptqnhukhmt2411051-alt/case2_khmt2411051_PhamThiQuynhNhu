
const authMiddleware = require('../middleware/authMiddleware');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// API dang ky tai khoan
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Vui long nhap day du thong tin',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Mat khau phai co it nhat 6 ky tu',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email da duoc dang ky',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    res.status(201).json({
      message: 'Dang ky tai khoan thanh cong',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email da duoc dang ky',
      });
    }

    console.error('Loi dang ky:', error.message);
    res.status(500).json({
      message: 'Loi may chu khi dang ky',
    });
  }
});

// API dang nhap
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Vui long nhap email va mat khau',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        message: 'Email hoac mat khau khong dung',
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: 'Email hoac mat khau khong dung',
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: 'Chua cau hinh JWT_SECRET',
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: 'Dang nhap thanh cong',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Loi dang nhap:', error.message);

    return res.status(500).json({
      message: 'Loi may chu khi dang nhap',
    });
  }
});
/* API xem thông tin cá nhân */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'Không tìm thấy tài khoản',
      });
    }

    return res.status(200).json({
      message: 'Lấy thông tin cá nhân thành công',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin cá nhân:', error.message);

    return res.status(500).json({
      message: 'Lỗi máy chủ khi lấy thông tin cá nhân',
    });
  }
});

/* API cập nhật thông tin cá nhân */
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email || !name.trim() || !email.trim()) {
      return res.status(400).json({
        message: 'Vui lòng nhập đầy đủ họ tên và email',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.userId },
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email đã được tài khoản khác sử dụng',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        name: name.trim(),
        email: normalizedEmail,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'Không tìm thấy tài khoản',
      });
    }

    return res.status(200).json({
      message: 'Cập nhật thông tin cá nhân thành công',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email đã được tài khoản khác sử dụng',
      });
    }

    console.error('Lỗi cập nhật thông tin:', error.message);

    return res.status(500).json({
      message: 'Lỗi máy chủ khi cập nhật thông tin',
    });
  }
});
/* API doi mat khau */
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Vui long nhap day du mat khau',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'Mat khau moi phai co it nhat 6 ky tu',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: 'Mat khau moi phai khac mat khau hien tai',
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: 'Khong tim thay tai khoan',
      });
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(400).json({
        message: 'Mat khau hien tai khong chinh xac',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      message: 'Doi mat khau thanh cong',
    });
  } catch (error) {
    console.error('Loi doi mat khau:', error.message);

    return res.status(500).json({
      message: 'Loi may chu khi doi mat khau',
    });
  }
});
module.exports = router;
