import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/notification_model.dart';

class NotificationService {
  static const String baseUrl = 'http://10.0.2.2:3000';

  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    if (token == null || token.isEmpty) {
      throw Exception('Bạn chưa đăng nhập');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  dynamic _decodeResponse(http.Response response) {
    final body = response.body.isEmpty
        ? null
        : jsonDecode(response.body);

    if (response.statusCode < 200 ||
        response.statusCode >= 300) {
      final message = body is Map
          ? body['message'] ?? 'Có lỗi xảy ra'
          : 'Có lỗi xảy ra';

      throw Exception(message.toString());
    }

    return body;
  }

  // Lấy danh sách thông báo
  Future<List<NotificationModel>> getNotifications() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/notifications'),
      headers: await _getHeaders(),
    );

    final data = _decodeResponse(response);

    if (data is! List) {
      throw Exception('Dữ liệu thông báo không hợp lệ');
    }

    return data
        .map(
          (item) => NotificationModel.fromJson(
        Map<String, dynamic>.from(item),
      ),
    )
        .toList();
  }

  // Đếm thông báo chưa đọc
  Future<int> getUnreadCount() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/notifications/unread-count'),
      headers: await _getHeaders(),
    );

    final data = _decodeResponse(response);

    return data is Map
        ? (data['count'] as num?)?.toInt() ?? 0
        : 0;
  }

  // Đánh dấu một thông báo đã đọc
  Future<void> markAsRead(String notificationId) async {
    final response = await http.patch(
      Uri.parse(
        '$baseUrl/api/notifications/$notificationId/read',
      ),
      headers: await _getHeaders(),
    );

    _decodeResponse(response);
  }

  // Đánh dấu tất cả thông báo đã đọc
  Future<void> markAllAsRead() async {
    final response = await http.patch(
      Uri.parse('$baseUrl/api/notifications/read-all'),
      headers: await _getHeaders(),
    );

    _decodeResponse(response);
  }
}