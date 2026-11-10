
import 'package:flutter/material.dart';

import '../models/task_model.dart';
import '../services/task_service.dart';

class TaskFormScreen extends StatefulWidget {
  final Task? task;
  final String currentUserId;

  const TaskFormScreen({
    super.key,
    this.task,
    required this.currentUserId,
  });

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _formKey = GlobalKey<FormState>();

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  // C1: Danh sách email thành viên.
  final _assignedEmailsController = TextEditingController();

  // C2: Email người phụ trách chính.
  final _primaryEmailController = TextEditingController();

  final TaskService _taskService = TaskService();

  String _selectedPriority = 'medium';
  String _status = 'todo';

  DateTime? _startDate;
  DateTime? _dueDate;

  bool _isSaving = false;

  bool get _isEditing => widget.task != null;

  @override
  void initState() {
    super.initState();

    final task = widget.task;

    if (task != null) {
      _titleController.text = task.title;
      _descriptionController.text = task.description;

      _selectedPriority = [
        'low',
        'medium',
        'high',
      ].contains(task.priority)
          ? task.priority
          : 'medium';

      _status = [
        'todo',
        'in_progress',
        'completed',
      ].contains(task.status)
          ? task.status
          : 'todo';

      _startDate = task.startDate;
      _dueDate = task.dueDate;

      // Hiển thị lại email các thành viên đã được giao.
      final emails = task.assignedUsers
          .map((member) => member.email.trim())
          .where((email) => email.isNotEmpty)
          .toList();

      _assignedEmailsController.text = emails.join('\n');

      // Hiển thị email người phụ trách chính.
      _primaryEmailController.text = task.assignedToEmail;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _assignedEmailsController.dispose();
    _primaryEmailController.dispose();
    super.dispose();
  }

  // Tách email theo dấu phẩy, dấu chấm phẩy hoặc xuống dòng.
  List<String> _getAssignedEmails() {
    final rawText = _assignedEmailsController.text;

    final emails = rawText
        .split(RegExp(r'[,;\n]+'))
        .map((email) => email.trim().toLowerCase())
        .where((email) => email.isNotEmpty)
        .toSet()
        .toList();

    return emails;
  }

  bool _isValidEmail(String email) {
    return RegExp(
      r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$',
    ).hasMatch(email);
  }

  Future<void> _selectDate(bool isStartDate) async {
    final now = DateTime.now();

    final initialDate = isStartDate
        ? (_startDate ?? now)
        : (_dueDate ?? _startDate ?? now);

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      helpText: isStartDate
          ? 'Chọn ngày bắt đầu'
          : 'Chọn hạn hoàn thành',
      cancelText: 'Hủy',
      confirmText: 'Xác nhận',
    );

    if (pickedDate == null) return;

    setState(() {
      if (isStartDate) {
        _startDate = pickedDate;

        if (_dueDate != null &&
            DateUtils.dateOnly(_dueDate!)
                .isBefore(DateUtils.dateOnly(pickedDate))) {
          _dueDate = null;
        }
      } else {
        _dueDate = pickedDate;
      }
    });
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Chưa chọn ngày';

    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/'
        '${date.year}';
  }

  // Kiểm tra dữ liệu C1 và C2 trước khi lưu.
  String? _validateAssignment() {
    final emails = _getAssignedEmails();
    final primaryEmail =
    _primaryEmailController.text.trim().toLowerCase();

    for (final email in emails) {
      if (!_isValidEmail(email)) {
        return 'Email không hợp lệ: $email';
      }
    }

    if (emails.isEmpty && primaryEmail.isNotEmpty) {
      return 'Bạn cần nhập thành viên trước khi chọn người phụ trách chính';
    }

    if (emails.isNotEmpty && primaryEmail.isEmpty) {
      return 'Vui lòng nhập email người phụ trách chính';
    }

    if (primaryEmail.isNotEmpty && !_isValidEmail(primaryEmail)) {
      return 'Email người phụ trách chính không hợp lệ';
    }

    if (primaryEmail.isNotEmpty &&
        !emails.contains(primaryEmail)) {
      return 'Người phụ trách chính phải nằm trong danh sách thành viên C1';
    }

    return null;
  }

  Future<void> _saveTask() async {
    if (!_formKey.currentState!.validate()) return;

    final assignmentError = _validateAssignment();

    if (assignmentError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(assignmentError),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (_startDate != null &&
        _dueDate != null &&
        DateUtils.dateOnly(_dueDate!)
            .isBefore(DateUtils.dateOnly(_startDate!))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Hạn hoàn thành không được trước ngày bắt đầu!',
          ),
        ),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final data = {
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim(),
        'createdBy': widget.task?.createdBy ?? widget.currentUserId,

        // Không gửi ID từ ô nhập cũ nữa.
        // Việc giao thành viên được thực hiện qua API C1.
        'assignedTo': null,

        'status': _status,
        'startDate': _startDate?.toIso8601String(),
        'dueDate': _dueDate?.toIso8601String(),
        'priority': _selectedPriority,
      };

      late Task savedTask;

      if (_isEditing) {
        savedTask = await _taskService.updateTask(
          widget.task!.id,
          data,
        );
      } else {
        savedTask = await _taskService.createTask(data);
      }

      // C1: Giao công việc cho nhiều thành viên.
      final emails = _getAssignedEmails();
      final primaryEmail =
      _primaryEmailController.text.trim().toLowerCase();

      if (emails.isNotEmpty) {
        await _taskService.assignUsers(
          taskId: savedTask.id,
          emails: emails,
          primaryEmail: primaryEmail,
        );
      }

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isEditing
                ? 'Cập nhật công việc và phân công thành công!'
                : 'Thêm công việc và phân công thành công!',
          ),
          backgroundColor: Colors.green,
        ),
      );

      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Lỗi lưu công việc: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.blue),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ],
    );
  }

  Widget _buildAssignmentSection() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionTitle(
              'C1 - Giao công việc cho nhiều người',
              Icons.group_add,
            ),

            const SizedBox(height: 8),

            Text(
              'Nhập email các thành viên muốn giao công việc. '
                  'Mỗi email nằm trên một dòng hoặc cách nhau bằng dấu phẩy.',
              style: TextStyle(
                color: Colors.grey.shade700,
                fontSize: 13,
              ),
            ),

            const SizedBox(height: 12),

            TextFormField(
              controller: _assignedEmailsController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText:
                'Ví dụ:\n'
                    'thanhvien1@gmail.com\n'
                    'thanhvien2@gmail.com',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(bottom: 55),
                  child: Icon(Icons.people),
                ),
                alignLabelWithHint: true,
              ),
            ),

            const SizedBox(height: 20),

            _buildSectionTitle(
              'C2 - Chọn người phụ trách chính',
              Icons.person_pin,
            ),

            const SizedBox(height: 8),

            Text(
              'Người phụ trách chính phải là một thành viên '
                  'đã được nhập ở phần C1.',
              style: TextStyle(
                color: Colors.grey.shade700,
                fontSize: 13,
              ),
            ),

            const SizedBox(height: 12),

            TextFormField(
              controller: _primaryEmailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                hintText: 'Nhập email người phụ trách chính',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                prefixIcon: const Icon(
                  Icons.person,
                  color: Colors.deepPurple,
                ),
              ),
            ),

            const SizedBox(height: 10),

            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Lưu ý: Người tạo công việc cần chọn một '
                    'email trong danh sách C1 làm người phụ trách chính.',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.blue,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _isEditing ? 'Chỉnh sửa công việc' : 'Thêm công việc',
        ),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Tên công việc',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),

                    TextFormField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        hintText: 'Nhập tên công việc',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.task),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Vui lòng nhập tên công việc';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 20),

                    const Text(
                      'Mô tả',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),

                    TextFormField(
                      controller: _descriptionController,
                      maxLines: 4,
                      decoration: InputDecoration(
                        hintText: 'Nhập mô tả công việc',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        prefixIcon: const Icon(Icons.description),
                        alignLabelWithHint: true,
                      ),
                    ),

                    const SizedBox(height: 20),

                    const Text(
                      'Mức độ ưu tiên',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),

                    DropdownButtonFormField<String>(
                      initialValue: _selectedPriority,
                      decoration: InputDecoration(
                        labelText: 'Chọn mức độ ưu tiên',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        prefixIcon: const Icon(
                          Icons.flag,
                          color: Colors.deepPurple,
                        ),
                      ),
                      items: const [
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
                        if (value != null) {
                          setState(() {
                            _selectedPriority = value;
                          });
                        }
                      },
                    ),

                    const SizedBox(height: 20),

                    // Khu vực C1 và C2.
                    _buildAssignmentSection(),

                    const SizedBox(height: 20),

                    const Text(
                      'Trạng thái',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),

                    DropdownButtonFormField<String>(
                      initialValue: _status,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                      items: const [
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
                          child: Text('Hoàn thành'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() {
                            _status = value;
                          });
                        }
                      },
                    ),

                    const SizedBox(height: 20),

                    const Text(
                      'Ngày bắt đầu',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),

                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.calendar_today),
                      title: Text(_formatDate(_startDate)),
                      trailing: TextButton(
                        onPressed: () => _selectDate(true),
                        child: const Text('Chọn ngày'),
                      ),
                    ),

                    const Divider(),

                    const Text(
                      'Hạn hoàn thành',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),

                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.event),
                      title: Text(_formatDate(_dueDate)),
                      trailing: TextButton(
                        onPressed: () => _selectDate(false),
                        child: const Text('Chọn ngày'),
                      ),
                    ),

                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),

            // Nút lưu luôn hiển thị phía dưới.
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _isSaving ? null : _saveTask,
                    icon: _isSaving
                        ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                        : const Icon(Icons.save),
                    label: Text(
                      _isSaving ? 'Đang lưu...' : 'Lưu công việc',
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
