const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Vui lòng đăng nhập lại',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: 'Chưa cấu hình JWT_SECRET',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Lấy ID từ payload của JWT
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({
        message: 'Token không chứa ID người dùng',
      });
    }

    // Gán thông tin người dùng cho request
    req.userId = String(userId);
    req.user = {
      id: String(userId),
      _id: String(userId),
    };

    next();
  } catch (error) {
    console.error('LỖI AUTH:', error);

    return res.status(401).json({
      message: 'Token không hợp lệ hoặc đã hết hạn',
    });
  }
}

module.exports = authMiddleware;