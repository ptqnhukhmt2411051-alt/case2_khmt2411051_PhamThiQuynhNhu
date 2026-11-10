
import 'package:flutter/material.dart';

import '../models/task_model.dart';
import '../services/task_service.dart';
import '../auth_service.dart';
class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  final TaskService _taskService = TaskService();

  List<Task> _tasks = [];
  String _currentUserId = '';

  bool _isLoading = true;
  String? _errorMessage;

  int get _totalTasks => _tasks.length;
  // Lấy ID từ String hoặc TaskMember
  String _getMemberId(dynamic value) {
    if (value == null) return '';

    if (value is String) {
      return value;
    }

    if (value is TaskMember) {
      return value.id;
    }

    return '';
  }

// Công việc được giao cho người dùng hiện tại
  int get _assignedCount {
    if (_currentUserId.isEmpty) return 0;

    return _tasks.where((task) {
      final primaryId = _getMemberId(task.assignedTo);

      final assignedIds = task.assignedUsers
          .map((member) => _getMemberId(member))
          .toList();

      return primaryId == _currentUserId ||
          assignedIds.contains(_currentUserId);
    }).length;
  }

// Công việc người dùng hiện tại phụ trách chính
  int get _responsibleCount {
    if (_currentUserId.isEmpty) return 0;

    return _tasks.where((task) {
      return _getMemberId(task.assignedTo) == _currentUserId;
    }).length;
  }

  int get _todoCount =>
      _tasks.where((task) => task.status == 'todo').length;

  int get _inProgressCount =>
      _tasks.where((task) => task.status == 'in_progress').length;

  int get _completedCount =>
      _tasks.where((task) => task.status == 'completed').length;

  double get _completionRate {
    if (_totalTasks == 0) return 0;
    return _completedCount / _totalTasks;
  }
  // Chuyển ngày về đầu ngày để so sánh theo ngày
  DateTime _dateOnly(DateTime date) {
    return DateTime(date.year, date.month, date.day);
  }

// Công việc sắp đến hạn trong 3 ngày tới
  List<Task> get _upcomingTasks {
    final today = _dateOnly(DateTime.now());
    final lastDay = today.add(const Duration(days: 3));

    return _tasks.where((task) {
      final dueDate = task.dueDate;

      if (dueDate == null || task.status == 'completed') {
        return false;
      }

      final date = _dateOnly(dueDate);

      return !date.isBefore(today) && !date.isAfter(lastDay);
    }).toList()
      ..sort((a, b) => a.dueDate!.compareTo(b.dueDate!));

  }


// Công việc đã quá hạn
  List<Task> get _overdueTasks {
    final today = _dateOnly(DateTime.now());

    return _tasks.where((task) {
      final dueDate = task.dueDate;

      if (dueDate == null || task.status == 'completed') {
        return false;
      }

      return _dateOnly(dueDate).isBefore(today);
    }).toList()
      ..sort((a, b) => a.dueDate!.compareTo(b.dueDate!));
  }

// Định dạng ngày/tháng/năm
  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/'
        '${date.year}';
  }

  @override
  void initState() {
    super.initState();
    _loadStatistics();
  }

  Future<void> _loadStatistics() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final userId = await AuthService().getCurrentUserId();
      final tasks = await _taskService.getTasks('all');

      if (!mounted) return;

      setState(() {
        _currentUserId = userId.toString();
        _tasks = tasks;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Widget _buildSummaryCard({
    required String title,
    required int count,
    required Color color,
    required IconData icon,
  }) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    count.toString(),
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressItem({
    required String title,
    required int count,
    required Color color,
  }) {
    final double percentage =
    _totalTasks == 0 ? 0 : count / _totalTasks;

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                '$count (${(percentage * 100).toStringAsFixed(1)}%)',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: percentage,
              minHeight: 12,
              backgroundColor: Colors.grey.shade200,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ],
      ),
    );
  }
    // Hiển thị một công việc trong danh sách hạn
    Widget _buildDeadlineTaskItem(
        Task task, {
          required Color color,
          required String label,
          required IconData icon,
        }) {
      return Card(
        margin: const EdgeInsets.only(bottom: 10),
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.12),
            child: Icon(icon, color: color),
          ),
          title: Text(
            task.title,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              'Hạn hoàn thành: ${_formatDate(task.dueDate!)}',
            ),
          ),
          trailing: Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ),
      );
    }

// Hiển thị danh sách công việc theo hạn
    Widget _buildDeadlineSection({
      required String title,
      required List<Task> tasks,
      required Color color,
      required IconData icon,
      required String label,
      required String emptyMessage,
    }) {
      return Card(
        elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: color),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: color.withValues(alpha: 0.12),
                    child: Text(
                      tasks.length.toString(),
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              if (tasks.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: Text(
                      emptyMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              else
                ...tasks.map(
                      (task) => _buildDeadlineTaskItem(
                    task,
                    color: color,
                    label: label,
                    icon: icon,
                  ),
                ),
            ],
          ),
        ),
      );
    }




  Widget _buildStatisticsContent() {
    return RefreshIndicator(
      onRefresh: _loadStatistics,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const Icon(
                    Icons.analytics_outlined,
                    size: 45,
                    color: Colors.blue,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'TỔNG SỐ CÔNG VIỆC',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _totalTasks.toString(),
                    style: const TextStyle(
                      fontSize: 38,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          const Text(
            'Thống kê theo trạng thái',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 10),

          _buildSummaryCard(
            title: 'Chưa thực hiện',
            count: _todoCount,
            color: Colors.orange,
            icon: Icons.pending_actions,
          ),


          _buildSummaryCard(
            title: 'Đang thực hiện',
            count: _inProgressCount,
            color: Colors.blue,
            icon: Icons.autorenew,
          ),

          _buildSummaryCard(
            title: 'Đã hoàn thành',
            count: _completedCount,
            color: Colors.green,
            icon: Icons.check_circle_outline,
          ),
          const SizedBox(height: 20),

          const Text(
            'Thống kê phân công công việc',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 12),

          _buildSummaryCard(
            title: 'Công việc được giao',
            count: _assignedCount,
            color: Colors.orange,
            icon: Icons.assignment_ind,
          ),

          const SizedBox(height: 12),

          _buildSummaryCard(
            title: 'Công việc đang phụ trách',
            count: _responsibleCount,
            color: Colors.blue,
            icon: Icons.person_pin,
          ),
          // Công việc sắp đến hạn
          _buildDeadlineSection(
            title: 'Công việc sắp đến hạn',
            tasks: _upcomingTasks,
            color: Colors.orange,
            icon: Icons.schedule,
            label: 'Sắp đến hạn',
            emptyMessage: 'Không có công việc sắp đến hạn',
          ),

          const SizedBox(height: 12),

// Công việc đã quá hạn
          _buildDeadlineSection(
            title: 'Công việc đã quá hạn',
            tasks: _overdueTasks,
            color: Colors.red,
            icon: Icons.warning_amber,
            label: 'Quá hạn',
            emptyMessage: 'Không có công việc quá hạn',
          ),

          const SizedBox(height: 16),

          const SizedBox(height: 16),

          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tỷ lệ công việc',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),

                  const SizedBox(height: 20),

                  _buildProgressItem(
                    title: 'Chưa thực hiện',
                    count: _todoCount,
                    color: Colors.orange,
                  ),

                  _buildProgressItem(
                    title: 'Đang thực hiện',
                    count: _inProgressCount,
                    color: Colors.blue,
                  ),

                  _buildProgressItem(
                    title: 'Đã hoàn thành',
                    count: _completedCount,
                    color: Colors.green,
                  ),

                  const Divider(),

                  const SizedBox(height: 10),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Tỷ lệ hoàn thành',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '${(_completionRate * 100).toStringAsFixed(1)}%',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          const Center(
            child: Text(
              'Kéo xuống để cập nhật thống kê',
              style: TextStyle(color: Colors.grey),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thống kê công việc'),
        centerTitle: true,
        actions: [
          IconButton(
            onPressed: _isLoading ? null : _loadStatistics,
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới dữ liệu',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Đang tải dữ liệu thống kê...'),
          ],
        ),
      )
          : _errorMessage != null
          ? Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                color: Colors.red,
                size: 55,
              ),
              const SizedBox(height: 16),
              const Text(
                'Không thể tải dữ liệu thống kê',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _loadStatistics,
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      )
          : _buildStatisticsContent(),
    );
  }
}
