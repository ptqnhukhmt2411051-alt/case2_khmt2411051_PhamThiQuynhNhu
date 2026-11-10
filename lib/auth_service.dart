
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Android Emulator truy cap backend tren may tinh.
const String baseUrl = 'http://10.0.2.2:3000';

class AuthService {
  // Dang ky tai khoan
  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': name,
        'email': email,
        'password': password,
      }),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 201) {
      return data;
    }

    throw Exception(data['message'] ?? 'Dang ky that bai');
  }

  // Dang nhap va luu token
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200) {
      final token = data['token'];

      if (token is String && token.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', token);
      }

      return data;
    }

    throw Exception(data['message'] ?? 'Dang nhap that bai');
  }

  // Dang xuat
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
  }

  // Lay token hien tai
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  // Lay thong tin nguoi dung
  Future<Map<String, dynamic>> getProfile() async {
    final token = await getToken();

    if (token == null || token.isEmpty) {
      throw Exception('Vui long dang nhap lai');
    }

    final response = await http.get(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200) {
      return data;
    }

    throw Exception(
      data['message'] ?? 'Khong the lay thong tin ca nhan',
    );
  }

  // Lay ID nguoi dung hien tai
  Future<String> getCurrentUserId() async {
    final profile = await getProfile();

    final dynamic userData = profile['user'] ?? profile;

    if (userData is! Map) {
      throw Exception('Du lieu nguoi dung khong hop le');
    }

    final id = userData['_id'] ?? userData['id'];

    if (id == null || id.toString().isEmpty) {
      throw Exception('Khong tim thay ID nguoi dung');
    }

    return id.toString();
  }

  // Cap nhat thong tin ca nhan
  Future<Map<String, dynamic>> updateProfile({
    required String name,
    required String email,
  }) async {
    final token = await getToken();

    if (token == null || token.isEmpty) {
      throw Exception('Vui long dang nhap lai');
    }

    final response = await http.put(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'name': name,
        'email': email,
      }),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200) {
      return data;
    }

    throw Exception(
      data['message'] ?? 'Cap nhat thong tin that bai',
    );
  }

  // Doi mat khau
  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final token = await getToken();

    if (token == null || token.isEmpty) {
      throw Exception('Vui long dang nhap lai');
    }

    final response = await http.put(
      Uri.parse('$baseUrl/api/auth/change-password'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      }),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200) {
      return data;
    }

    throw Exception(
      data['message'] ?? 'Doi mat khau that bai',
    );
  }
}
