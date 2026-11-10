
import 'package:flutter/material.dart';

import 'auth_service.dart';
import 'login_screen.dart';
import 'profile_screen.dart';
import 'screens/task_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  // Dang xuat tai khoan
  Future<void> handleLogout(BuildContext context) async {
    await AuthService().logout();

    if (!context.mounted) return;

    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const LoginScreen(),
      ),
          (route) => false,
    );
  }

  // Mo man hinh quan ly cong viec
  Future<void> openTaskScreen(BuildContext context) async {
    try {
      await AuthService().getCurrentUserId();

      if (!context.mounted) return;

      Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => const TaskScreen(),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Khong the mo quan ly cong viec: $e'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Task Manager'),
        centerTitle: true,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.task_alt,
                size: 80,
                color: Colors.blue,
              ),
              const SizedBox(height: 16),

              const Text(
                'Chào mừng đến với Task Manager!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 30),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => openTaskScreen(context),
                  icon: const Icon(Icons.task_alt),
                  label: const Text('Quản lý công việc'),
                ),
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => const ProfileScreen(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.person),
                  label: const Text('Thông tin cá nhân'),
                ),
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => handleLogout(context),
                  icon: const Icon(Icons.logout),
                  label: const Text('Đăng xuất'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
