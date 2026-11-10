
import 'package:flutter/material.dart';

import '../auth_service.dart';
import '../models/task_model.dart';
import '../services/task_service.dart';
import 'task_detail_screen.dart';
import 'task_form_screen.dart';

class TaskScreen extends StatefulWidget {
  const TaskScreen({super.key});

  @override
  State<TaskScreen> createState() => _TaskScreenState();
}

class _TaskScreenState extends State<TaskScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  final TaskService _taskService = TaskService();
  final AuthService _authService = AuthService();

  final List<String> _types = [
    'created',
    'assigned',
    'accepted',
    'shared',
  ];

  final List<String> _titles = [
    'Đã tạo',
    'Được giao',
    'Đã nhận',
    'Được chia sẻ',
  ];

  String _currentUserId = '';

  bool _isLoadingUser = true;
  bool _isLoadingTasks = false;

  String? _errorMessage;

  List<Task> _tasks = [];

  // Tiêu chí sắp xếp công việc
  String _sortBy = 'dueDate';

  // Tìm kiếm và lọc công việc
  final TextEditingController _searchController =
  TextEditingController();

  String _searchKeyword = '';
  String _selectedStatus = 'all';
  String _selectedPriority = 'all';
  String _selectedAssignee = 'all';

  @override
  void initState() {
    super.initState();

    _tabController = TabController(
      length: _types.length,
      vsync: this,
    );

    _initializeScreen();
  }

  // Khởi tạo màn hình
  Future<void> _initializeScreen() async {
    await _loadCurrentUser();
    await _loadTasks();
  }

  // Lấy ID người dùng đang đăng nhập
  Future<void> _loadCurrentUser() async {
    try {
      final userId = await _authService.getCurrentUserId();

      if (!mounted) return;

      setState(() {
        _currentUserId = userId;
        _isLoadingUser = false;
      });

      debugPrint('ID người dùng: $_currentUserId');
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _currentUserId = '';
        _isLoadingUser = false;
        _errorMessage = 'Không thể lấy thông tin tài khoản: $e';
      });

      debugPrint('Lỗi lấy ID người dùng: $e');
    }
  }

  // Tải danh sách công việc từ API
  Future<void> _loadTasks() async {
    if (!mounted) return;

    setState(() {
      _isLoadingTasks = true;
      _errorMessage = null;
    });

    try {
      final tasks = await _taskService.getTasks('all');

      if (!mounted) return;

      setState(() {
        _tasks = tasks;
        _isLoadingTasks = false;
      });

      debugPrint('Tổng số công việc: ${_tasks.length}');
      debugPrint('ID người dùng: $_currentUserId');
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isLoadingTasks = false;
        _errorMessage = 'Không thể tải công việc: $e';
      });

      debugPrint('Lỗi tải công việc: $e');
    }
  }

  // Lọc công việc theo từng danh sách
  List<Task> _getTasksByType(String type) {
    if (_currentUserId.isEmpty) return [];

    switch (type) {
    // Công việc do tài khoản hiện tại tạo
      case 'created':
        return _tasks.where((task) {
          return task.createdBy == _currentUserId;
        }).toList();

    // Công việc được giao cho tài khoản hiện tại
    // Bao gồm người phụ trách chính và thành viên được giao
      case 'assigned':
        return _tasks.where((task) {
          final isPrimaryAssignee =
              task.assignedTo == _currentUserId;

          final isAssignedMember = task.assignedUsers.any(
                (member) => member.id == _currentUserId,
          );

          return isPrimaryAssignee || isAssignedMember;
        }).toList();

    // Công việc tài khoản hiện tại đã chấp nhận
      case 'accepted':
        return _tasks.where((task) {
          return task.acceptedBy.contains(_currentUserId);
        }).toList();

    // Công việc được chia sẻ cho tài khoản hiện tại
      case 'shared':
        return _tasks.where((task) {
          return task.sharedWith.any(
                (member) => member.id == _currentUserId,
          );
        }).toList();

      default:
        return [];
    }
  }

// Tìm kiếm và lọc công việc
  List<Task> _getFilteredTasks(String type) {
    final tasks = _getTasksByType(type);

    return tasks.where((task) {
      final matchesName = task.title
          .toLowerCase()
          .contains(_searchKeyword.toLowerCase());

      final matchesStatus = _selectedStatus == 'all' ||
          task.status == _selectedStatus;

      final matchesPriority = _selectedPriority == 'all' ||
          task.priority == _selectedPriority;

      final matchesAssignee = _selectedAssignee == 'all' ||
          task.assignedTo == _selectedAssignee ||
          task.assignedUsers.any(
                (member) => member.id == _selectedAssignee,
          );
      return matchesName &&
          matchesStatus &&
          matchesPriority &&
          matchesAssignee;
    }).toList();
  }

  List<Task> _getSortedTasks(String type) {
    final tasks = _getFilteredTasks(type);

    switch (_sortBy) {
      case 'dueDate':
        tasks.sort((a, b) {
          // Công việc chưa có hạn hoàn thành xếp xuống cuối
          if (a.dueDate == null && b.dueDate == null) {
            return 0;
          }
          if (a.dueDate == null) return 1;
          if (b.dueDate == null) return -1;

          return a.dueDate!.compareTo(b.dueDate!);
        });
        break;

      case 'priority':
        const priorityOrder = {
          'high': 1,
          'medium': 2,
          'low': 3,
        };

        tasks.sort((a, b) {
          return (priorityOrder[a.priority] ?? 4)
              .compareTo(priorityOrder[b.priority] ?? 4);
        });
        break;

      case 'createdAt':
        tasks.sort((a, b) {
          // Công việc chưa có thời gian tạo xếp xuống cuối
          if (a.createdAt == null && b.createdAt == null) {
            return 0;
          }

          if (a.createdAt == null) return 1;
          if (b.createdAt == null) return -1;

          // Công việc mới tạo hiển thị trước
          return b.createdAt!.compareTo(a.createdAt!);
        });
        break;
    }

    return tasks;
  }


  // Mở màn hình thêm công việc
  Future<void> _openAddTaskScreen() async {
    if (_currentUserId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Không lấy được thông tin tài khoản. Vui lòng đăng nhập lại.',
          ),
        ),
      );
      return;
    }

    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            TaskFormScreen(
              currentUserId: _currentUserId,
            ),
      ),
    );

    if (!mounted) return;

    if (result == true) {
      await _loadTasks();
    }
  }
  // Thống kê tiến độ công việc
  Widget _buildProgressSummary() {
    final total = _tasks.length;

    final todoCount = _tasks
        .where((task) => task.status == 'todo')
        .length;

    final inProgressCount = _tasks
        .where((task) => task.status == 'in_progress')
        .length;

    final completedCount = _tasks
        .where((task) => task.status == 'completed')
        .length;

    final progress = total == 0
        ? 0.0
        : completedCount / total;

    Widget buildItem(
        String title,
        int count,
        Color color,
        IconData icon,
        ) {
      return Expanded(
        child: Column(
          children: [
            Icon(icon, color: color, size: 25),
            const SizedBox(height: 6),
            Text(
              '$count',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11),
            ),
          ],
        ),
      );
    }

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(
                  Icons.analytics_outlined,
                  color: Colors.blue,
                ),
                SizedBox(width: 8),
                Text(
                  'Tổng quan tiến độ công việc',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            Row(
              children: [
                buildItem(
                  'Chưa thực hiện',
                  todoCount,
                  Colors.blue,
                  Icons.pending_actions,
                ),
                buildItem(
                  'Đang thực hiện',
                  inProgressCount,
                  Colors.orange,
                  Icons.autorenew,
                ),
                buildItem(
                  'Hoàn thành',
                  completedCount,
                  Colors.green,
                  Icons.check_circle_outline,
                ),
              ],
            ),

            const SizedBox(height: 16),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Tỷ lệ hoàn thành',
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '${(progress * 100).toStringAsFixed(0)}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 8),

            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 9,
                backgroundColor: Colors.grey.shade300,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  Colors.green,
                ),
              ),
            ),

            const SizedBox(height: 8),

            Text(
              'Tổng cộng $total công việc',
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Mở màn hình chi tiết công việc
  Future<void> _openTaskDetail(Task task) async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            TaskDetailScreen(
              task: task,
              currentUserId: _currentUserId,
            ),
      ),
    );

    if (!mounted) return;

    if (result == true) {
      await _loadTasks();
    }
  }

  // Màu trạng thái
  Color _statusColor(String status) {
    switch (status) {
      case 'completed':
        return Colors.green;
      case 'in_progress':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }

  // Tên trạng thái
  String _statusText(String status) {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'in_progress':
        return 'Đang thực hiện';
      default:
        return 'Chưa thực hiện';
    }
  }

  // Màu độ ưu tiên
  Color _priorityColor(String priority) {
    switch (priority) {
      case 'high':
        return Colors.red;
      case 'low':
        return Colors.green;
      default:
        return Colors.orange;
    }
  }

  // Tên độ ưu tiên
  String _priorityText(String priority) {
    switch (priority) {
      case 'high':
        return 'Cao';
      case 'low':
        return 'Thấp';
      default:
        return 'Trung bình';
    }
  }

  // Định dạng ngày
  String _formatDate(DateTime? date) {
    if (date == null) return 'Chưa có';

    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');

    return '$day/$month/${date.year}';
  }

  // Giao diện thẻ công việc
  Widget _buildTaskCard(Task task) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 6,
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _openTaskDetail(task),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                task.title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),

              if (task.description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  task.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],

              const SizedBox(height: 10),

              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  Chip(
                    label: Text(_statusText(task.status)),
                    backgroundColor:
                    _statusColor(task.status).withValues(alpha: 0.12),
                  ),
                  Chip(
                    label: Text(
                      'Ưu tiên: ${_priorityText(task.priority)}',
                    ),
                    backgroundColor:
                    _priorityColor(task.priority).withValues(alpha: 0.12),
                  ),
                ],
              ),

              const SizedBox(height: 4),

              Row(
                children: [
                  const Icon(
                    Icons.calendar_today,
                    size: 16,
                  ),
                  const SizedBox(width: 6),
                  Text('Hạn: ${_formatDate(task.dueDate)}'),
                  const Spacer(),
                  const Icon(
                    Icons.arrow_forward_ios,
                    size: 14,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
// Hiển thị danh sách công việc theo từng tab
  Widget _buildTaskList(String type) {
    if (_isLoadingTasks) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_errorMessage!),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadTasks,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    final tasks = _getSortedTasks(type);

    return Column(
      children: [
        // Thống kê tiến độ
        _buildProgressSummary(),
        // Ô tìm kiếm
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Tìm kiếm theo tên công việc...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  _searchController.clear();
                  setState(() {
                    _searchKeyword = '';
                  });
                },
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onChanged: (value) {
              setState(() {
                _searchKeyword = value.trim();
              });
            },
          ),
        ),

        // Lọc theo trạng thái
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonFormField<String>(
            initialValue: _selectedStatus,
            decoration: const InputDecoration(
              labelText: 'Lọc theo trạng thái',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                value: 'all',
                child: Text('Tất cả trạng thái'),
              ),
              DropdownMenuItem(
                value: 'todo',
                child: Text('Chưa thực hiện'),
              ),
              DropdownMenuItem(
                value: 'in_progress',
                child: Text('Đang thực hiện'),
              ),
              DropdownMenuItem(
                value: 'completed',
                child: Text('Đã hoàn thành'),
              ),
            ],
            onChanged: (value) {
              setState(() {
                _selectedStatus = value ?? 'all';
              });
            },
          ),
        ),

        const SizedBox(height: 10),

        // Lọc theo mức độ ưu tiên
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonFormField<String>(
            initialValue: _selectedPriority,
            decoration: const InputDecoration(
              labelText: 'Lọc theo mức độ ưu tiên',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                value: 'all',
                child: Text('Tất cả mức ưu tiên'),
              ),
              DropdownMenuItem(
                value: 'low',
                child: Text('Thấp'),
              ),
              DropdownMenuItem(
                value: 'medium',
                child: Text('Trung bình'),
              ),
              DropdownMenuItem(
                value: 'high',
                child: Text('Cao'),
              ),
            ],
            onChanged: (value) {
              setState(() {
                _selectedPriority = value ?? 'all';
              });
            },
          ),
        ),

        const SizedBox(height: 10),

        // Lọc theo người phụ trách
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonFormField<String>(
            initialValue: _selectedAssignee,
            decoration: const InputDecoration(
              labelText: 'Lọc theo người phụ trách',
              border: OutlineInputBorder(),
            ),
            items: [
              const DropdownMenuItem(
                value: 'all',
                child: Text('Tất cả người phụ trách'),
              ),
              ..._tasks
                  .where((task) => task.assignedTo.isNotEmpty)
                  .map((task) => task.assignedTo)
                  .toSet()
                  .map(
                    (id) => DropdownMenuItem(
                  value: id,
                  child: Text(
                    id,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: (value) {
              setState(() {
                _selectedAssignee = value ?? 'all';
              });
            },
          ),
        ),

        const SizedBox(height: 10),

        // Sắp xếp công việc
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonFormField<String>(
            initialValue: _sortBy,
            decoration: const InputDecoration(
              labelText: 'Sắp xếp công việc',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                value: 'dueDate',
                child: Text('Theo hạn hoàn thành'),
              ),
              DropdownMenuItem(
                value: 'priority',
                child: Text('Theo mức độ ưu tiên'),
              ),
              DropdownMenuItem(
                value: 'createdAt',
                child: Text('Theo thời gian tạo'),
              ),
            ],
            onChanged: (value) {
              setState(() {
                _sortBy = value ?? 'dueDate';
              });
            },
          ),
        ),

        const SizedBox(height: 8),

        // Danh sách kết quả
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadTasks,
            child: tasks.isEmpty
                ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 60),
                const Icon(
                  Icons.search_off,
                  size: 55,
                  color: Colors.grey,
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    'Không tìm thấy công việc trong mục '
                        '${_titles[_types.indexOf(type)]}',
                  ),
                ),
              ],
            )
                : ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: tasks.length,
              itemBuilder: (context, index) {
                return _buildTaskCard(tasks[index]);
              },
            ),
          ),
        ),
      ],
    );
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quản lý công việc'),
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: _isLoadingTasks ? null : _loadTasks,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Thêm công việc',
            onPressed: _isLoadingUser ? null : _openAddTaskScreen,
            icon: const Icon(Icons.add),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: _titles.map((title) {
            return Tab(text: title);
          }).toList(),
        ),
      ),
      body: _isLoadingUser
          ? const Center(
        child: CircularProgressIndicator(),
      )
          : TabBarView(
        controller: _tabController,
        children: _types.map(_buildTaskList).toList(),
      ),
    );
  }




    @override
    void dispose() {
      _tabController.dispose();
      _searchController.dispose();
      super.dispose();
    }
}
