
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/task_model.dart';

class TaskService {
  static const String baseUrl = 'http://10.0.2.2:3000';

  // Lấy JWT và tạo headers dùng chung.
  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    if (token == null || token.isEmpty) {
      throw Exception('Vui lòng đăng nhập lại');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  // Đọc dữ liệu JSON từ backend.
  dynamic _decodeResponse(http.Response response) {
    if (response.body.isEmpty) return {};

    try {
      return jsonDecode(response.body);
    } catch (_) {
      throw Exception(
        'Backend không trả về JSON hợp lệ. '
            'HTTP ${response.statusCode}. '
            'Nội dung: ${response.body}',
      );
    }
  }

  // Lấy danh sách công việc.
  Future<List<Task>> getTasks(String type) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/tasks'),
        headers: await _getHeaders(),
      );

      final decodedData = _decodeResponse(response);

      if (response.statusCode != 200) {
        throw Exception(
          decodedData is Map
              ? decodedData['message'] ?? 'Không thể tải công việc'
              : 'Không thể tải công việc',
        );
      }

      if (decodedData is! List) {
        throw Exception('Dữ liệu danh sách công việc không hợp lệ');
      }

      final tasks = decodedData
          .map<Task>(
            (json) =>
            Task.fromJson(
              Map<String, dynamic>.from(json),
            ),
      )
          .toList();

      switch (type) {
        case 'created':
          return tasks
              .where((task) => task.createdBy.isNotEmpty)
              .toList();

        case 'assigned':
          return tasks
              .where(
                (task) =>
            task.assignedTo.isNotEmpty ||
                task.assignedUsers.isNotEmpty,
          )
              .toList();

        case 'accepted':
          return tasks
              .where((task) => task.acceptedBy.isNotEmpty)
              .toList();

        case 'shared':
          return tasks
              .where((task) => task.sharedWith.isNotEmpty)
              .toList();

        default:
          return tasks;
      }
    } catch (e) {
      throw Exception('Lỗi tải danh sách công việc: $e');
    }
  }

  // Thêm công việc.
  Future<Task> createTask(Map<String, dynamic> data) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/tasks'),
        headers: await _getHeaders(),
        body: jsonEncode(data),
      );

      final responseData = _decodeResponse(response);

      if (response.statusCode == 201 ||
          response.statusCode == 200) {
        if (responseData is Map &&
            responseData['task'] is Map) {
          return Task.fromJson(
            Map<String, dynamic>.from(responseData['task']),
          );
        }

        throw Exception(
          'Backend đã thêm công việc nhưng không trả về dữ liệu task.',
        );
      }

      throw Exception(
        responseData is Map
            ? responseData['message'] ?? 'Không thể thêm công việc'
            : 'Không thể thêm công việc',
      );
    } catch (e) {
      throw Exception('Lỗi thêm công việc: $e');
    }
  }

  // Cập nhật công việc.
  Future<Task> updateTask(String taskId,
      Map<String, dynamic> data,) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/api/tasks/$taskId'),
        headers: await _getHeaders(),
        body: jsonEncode(data),
      );

      final responseData = _decodeResponse(response);

      if (response.statusCode == 200) {
        if (responseData is Map &&
            responseData['task'] is Map) {
          return Task.fromJson(
            Map<String, dynamic>.from(responseData['task']),
          );
        }

        throw Exception('Backend không trả về thông tin công việc');
      }

      throw Exception(
        responseData is Map
            ? responseData['message'] ?? 'Không thể cập nhật công việc'
            : 'Không thể cập nhật công việc',
      );
    } catch (e) {
      throw Exception('Lỗi cập nhật công việc: $e');
    }
  }

  // Cập nhật trạng thái công việc.
  Future<Task> updateTaskStatus(String taskId,
      String newStatus,) async {
    return updateTask(taskId, {
      'status': newStatus,
    });
  }

  // C1: Giao công việc cho nhiều người bằng email.
  Future<void> assignUsers({
    required String taskId,
    required List<String> emails,
    required String primaryEmail,
  }) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/api/tasks/$taskId/assign'),
        headers: await _getHeaders(),
        body: jsonEncode({
          'emails': emails,
          'primaryEmail': primaryEmail,
        }),
      );

      final data = _decodeResponse(response);

      if (response.statusCode != 200) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Không thể giao công việc'
              : 'Không thể giao công việc',
        );
      }
    } catch (e) {
      throw Exception('Lỗi giao công việc cho nhiều người: $e');
    }
  }

  // C2: Thay đổi người phụ trách chính.
  Future<void> updatePrimaryAssignee({
    required String taskId,
    required String primaryEmail,
  }) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/api/tasks/$taskId/primary-assignee'),
        headers: await _getHeaders(),
        body: jsonEncode({
          'primaryEmail': primaryEmail,
        }),
      );

      final data = _decodeResponse(response);

      if (response.statusCode != 200) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Không thể đổi người phụ trách chính'
              : 'Không thể đổi người phụ trách chính',
        );
      }
    } catch (e) {
      throw Exception('Lỗi đổi người phụ trách chính: $e');
    }
  }

  // C: Chia sẻ công việc cho nhiều người bằng email.
  // đồng thời cấp quyền viewer hoặc editor.
  Future<void> shareTask({
    required String taskId,
    required List<String> emails,
    required String permission,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/tasks/$taskId/share'),
        headers: await _getHeaders(),
        body: jsonEncode({
          'emails': emails,
          'permission': permission,
        }),
      );

      final data = _decodeResponse(response);

      if (response.statusCode != 200) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Không thể chia sẻ công việc'
              : 'Không thể chia sẻ công việc',
        );
      }
    } catch (e) {
      throw Exception('Lỗi chia sẻ công việc: $e');
    }
  }

  // Chấp nhận công việc được giao.
  Future<void> acceptTask(String taskId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/tasks/$taskId/accept'),
        headers: await _getHeaders(),
      );

      final data = _decodeResponse(response);

      if (response.statusCode != 200) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Không thể chấp nhận công việc'
              : 'Không thể chấp nhận công việc',
        );
      }
    } catch (e) {
      throw Exception('Lỗi chấp nhận công việc: $e');
    }
  }

  // Xóa công việc.
  Future<void> deleteTask(String taskId) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/api/tasks/$taskId'),
        headers: await _getHeaders(),
      );

      if (response.statusCode != 200) {
        final data = _decodeResponse(response);

        throw Exception(
          data is Map
              ? data['message'] ?? 'Không thể xóa công việc'
              : 'Không thể xóa công việc',
        );
      }
    } catch (e) {
      throw Exception('Lỗi xóa công việc: $e');
    }
  }

  // Thay đổi quyền viewer / editor
  Future<void> updateSharePermission({
    required String taskId,
    required String email,
    required String permission,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/tasks/$taskId/share-permission'),
      headers: await _getHeaders(),
      body: jsonEncode({
        'email': email,
        'permission': permission,
      }),
    );

    final data = _decodeResponse(response);

    if (response.statusCode != 200) {
      throw Exception(
        data is Map
            ? data['message'] ?? 'Không thể thay đổi quyền'
            : 'Không thể thay đổi quyền',
      );
    }
  }

  // Thu hồi quyền truy cập của người được chia sẻ
  Future<void> revokeShareAccess({
    required String taskId,
    required String email,
  }) async {
    try {
      final normalizedEmail = email.trim().toLowerCase();

      print('========== THU HOI QUYEN ==========');
      print('Task ID: $taskId');
      print('Email: $normalizedEmail');

      final headers = await _getHeaders();

      final url = Uri.parse(
        '$baseUrl/api/tasks/$taskId/share',
      );

      print('URL: $url');

      final response = await http.delete(
        url,
        headers: headers,
        body: jsonEncode({
          'email': normalizedEmail,
        }),
      );

      print('HTTP STATUS: ${response.statusCode}');
      print('HTTP BODY: ${response.body}');
      print('==================================');

      final data = _decodeResponse(response);

      if (response.statusCode != 200) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Không thể thu hồi quyền truy cập'
              : 'Không thể thu hồi quyền truy cập',
        );
      }
    } catch (e) {
      print('FLUTTER REVOKE ERROR: $e');
      rethrow;
    }
  }


}
