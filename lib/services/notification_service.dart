
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class NotificationService {
  static const String baseUrl = 'http://10.0.2.2:3000';

  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    if (token == null || token.isEmpty) {
      throw Exception('Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  // Lấy danh sách thông báo của tài khoản hiện tại.
  Future<List<dynamic>> getNotifications() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/notifications'),
      headers: await _getHeaders(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);

      if (decoded is List) {
        return decoded;
      }

      throw Exception('Dữ liệu thông báo từ máy chủ không hợp lệ.');
    }

    throw Exception(
      'Không thể tải thông báo. Mã lỗi: ${response.statusCode}. '
          '${response.body}',
    );
  }

  // Lấy số lượng thông báo chưa đọc.
  Future<int> getUnreadCount() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/notifications/unread-count'),
      headers: await _getHeaders(),
    );

    if (response.statusCode != 200) {
      throw Exception(
        'Không thể lấy số thông báo chưa đọc: ${response.statusCode}',
      );
    }

    final decoded = jsonDecode(response.body);

    if (decoded is Map) {
      final count = decoded['count'] ?? decoded['unreadCount'] ?? 0;
      return int.tryParse(count.toString()) ?? 0;
    }

    return 0;
  }

  // Đánh dấu một thông báo đã đọc.
  Future<void> markAsRead(String notificationId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/api/notifications/$notificationId/read'),
      headers: await _getHeaders(),
    );

    if (response.statusCode != 200) {
      throw Exception(
        'Không thể đánh dấu thông báo đã đọc: ${response.statusCode}',
      );
    }
  }

  // Đánh dấu tất cả thông báo đã đọc.
  Future<void> markAllAsRead() async {
    final response = await http.patch(
      Uri.parse('$baseUrl/api/notifications/read-all'),
      headers: await _getHeaders(),
    );

    if (response.statusCode != 200) {
      throw Exception(
        'Không thể đánh dấu tất cả thông báo đã đọc: '
            '${response.statusCode}',
      );
    }
  }
}
