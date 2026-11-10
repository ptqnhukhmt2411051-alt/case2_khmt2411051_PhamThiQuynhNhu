import 'package:flutter/material.dart';
import '../services/task_service.dart';

class TaskHistoryScreen extends StatefulWidget {
  const TaskHistoryScreen({super.key});

  @override
  State<TaskHistoryScreen> createState() =>
      _TaskHistoryScreenState();
}

class _TaskHistoryScreenState extends State<TaskHistoryScreen> {
  final TaskService _taskService = TaskService();

  late Future<List<dynamic>> _historyFuture;

  @override
  void initState() {
    super.initState();
    _historyFuture = _taskService.getTaskHistory();
  }

  void _reloadHistory() {
    setState(() {
      _historyFuture = _taskService.getTaskHistory();
    });
  }

  String _formatDate(dynamic value) {
    if (value == null) return 'Không rõ thời gian';

    final date = DateTime.tryParse(value.toString())?.toLocal();

    if (date == null) return 'Không rõ thời gian';

    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/'
        '${date.year} '
        '${date.hour.toString().padLeft(2, '0')}:'
        '${date.minute.toString().padLeft(2, '0')}';
  }

  String _userName(dynamic user) {
    if (user is Map) {
      return user['name']?.toString() ?? 'Người dùng';
    }
    return 'Người dùng';
  }

  String _priorityText(dynamic priority) {
    switch (priority?.toString()) {
      case 'high':
        return 'Cao';
      case 'low':
        return 'Thấp';
      default:
        return 'Trung bình';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lịch sử công việc'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: _reloadHistory,
            icon: const Icon(Icons.refresh),
            tooltip: 'Tải lại',
          ),
        ],
      ),
      body: FutureBuilder<List<dynamic>>(
        future: _historyFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Không thể tải lịch sử:\n${snapshot.error}',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          final histories = snapshot.data ?? [];

          if (histories.isEmpty) {
            return const Center(
              child: Text('Chưa có công việc hoàn thành'),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => _reloadHistory(),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: histories.length,
              itemBuilder: (context, index) {
                final item = Map<String, dynamic>.from(
                  histories[index] as Map,
                );

                final assignedUsers =
                item['assignedUsers'] is List
                    ? item['assignedUsers'] as List
                    : [];

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.task_alt,
                              color: Colors.green,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                item['title']?.toString() ??
                                    'Công việc không tên',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          item['description']?.toString().isNotEmpty == true
                              ? item['description'].toString()
                              : 'Không có mô tả',
                        ),
                        const Divider(height: 24),
                        Text(
                          'Người hoàn thành: '
                              '${_userName(item['completedBy'])}',
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Người tạo: ${_userName(item['createdBy'])}',
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Người được giao: '
                              '${assignedUsers.map(_userName).join(', ')}',
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Ưu tiên: ${_priorityText(item['priority'])}',
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Thời gian hoàn thành: '
                              '${_formatDate(item['completedAt'])}',
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}