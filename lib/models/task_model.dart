class TaskMember {
  final String id;
  final String name;
  final String email;

  const TaskMember({
    required this.id,
    this.name = '',
    this.email = '',
  });

  factory TaskMember.fromJson(dynamic value) {
    if (value is Map) {
      return TaskMember(
        id: (value['_id'] ?? value['id'] ?? '').toString(),
        name: (value['name'] ?? '').toString(),
        email: (value['email'] ?? '').toString(),
      );
    }

    return TaskMember(
      id: value?.toString() ?? '',
    );
  }
}

class Task {
  final String id;
  final String title;
  final String description;
  final String createdBy;
  final String assignedTo;
  final String assignedToName;
  final String assignedToEmail;
  final List<TaskMember> assignedUsers;
  final List<String> acceptedBy;
  final List<TaskMember> sharedWith;
  final String status;
  final String priority;
  final DateTime? startDate;
  final DateTime? dueDate;
  final DateTime? createdAt;

  Task({
    required this.id,
    required this.title,
    required this.description,
    required this.createdBy,
    required this.assignedTo,
    this.assignedToName = '',
    this.assignedToEmail = '',
    this.assignedUsers = const [],
    this.acceptedBy = const [],
    this.sharedWith = const [],
    required this.status,
    required this.priority,
    this.startDate,
    this.dueDate,
    this.createdAt,
  });

  static String _getId(dynamic value) {
    if (value == null) return '';

    if (value is Map) {
      return (value['_id'] ?? value['id'] ?? '').toString();
    }

    return value.toString();
  }

  static List<String> _getIdList(dynamic value) {
    if (value is! List) return [];

    return value
        .map((item) => _getId(item))
        .where((id) => id.isNotEmpty)
        .toList();
  }

  static List<TaskMember> _getMembers(dynamic value) {
    if (value is! List) return [];

    return value
        .map((item) => TaskMember.fromJson(item))
        .where((member) => member.id.isNotEmpty)
        .toList();
  }

  static DateTime? _getDate(dynamic value) {
    if (value == null || value.toString().isEmpty) return null;
    return DateTime.tryParse(value.toString());
  }

  factory Task.fromJson(Map<String, dynamic> json) {
    final assignedToData = json['assignedTo'];

    return Task(
      id: _getId(json['_id'] ?? json['id']),
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      createdBy: _getId(json['createdBy']),
      assignedTo: _getId(assignedToData),
      assignedToName: assignedToData is Map
          ? (assignedToData['name'] ?? '').toString()
          : '',
      assignedToEmail: assignedToData is Map
          ? (assignedToData['email'] ?? '').toString()
          : '',
      assignedUsers: _getMembers(json['assignedUsers']),
      acceptedBy: _getIdList(json['acceptedBy']),
      sharedWith: _getMembers(json['sharedWith']),
      status: json['status']?.toString() ?? 'todo',
      priority: json['priority']?.toString() ?? 'medium',
      startDate: _getDate(json['startDate']),
      dueDate: _getDate(json['dueDate']),
      createdAt: _getDate(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'description': description,
      'createdBy': createdBy,
      'assignedTo': assignedTo,
      'assignedUsers': assignedUsers.map((member) => member.id).toList(),
      'acceptedBy': acceptedBy,
      'sharedWith': sharedWith.map((member) => member.id).toList(),
      'status': status,
      'priority': priority,
      'startDate': startDate?.toIso8601String(),
      'dueDate': dueDate?.toIso8601String(),
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  String get startDateText {
    if (startDate == null) return 'Chưa thiết lập';

    return '${startDate!.day.toString().padLeft(2, '0')}/'
        '${startDate!.month.toString().padLeft(2, '0')}/'
        '${startDate!.year}';
  }

  String get dueDateText {
    if (dueDate == null) return 'Chưa thiết lập';

    return '${dueDate!.day.toString().padLeft(2, '0')}/'
        '${dueDate!.month.toString().padLeft(2, '0')}/'
        '${dueDate!.year}';
  }

  String get statusText {
    switch (status) {
      case 'todo':
        return 'Chưa thực hiện';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Đã hoàn thành';
      default:
        return 'Chưa thực hiện';
    }
  }
}