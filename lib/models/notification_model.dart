class NotificationModel {
  final String id;
  final String title;
  final String message;
  final String type;
  final bool isRead;
  final String senderName;
  final String senderEmail;
  final String taskId;
  final String taskTitle;
  final DateTime? createdAt;

  const NotificationModel({
    required this.id,
    this.title = '',
    this.message = '',
    this.type = '',
    this.isRead = false,
    this.senderName = '',
    this.senderEmail = '',
    this.taskId = '',
    this.taskTitle = '',
    this.createdAt,
  });

  // Tao ban sao NotificationModel khi can thay doi du lieu
  NotificationModel copyWith({
    String? id,
    String? title,
    String? message,
    String? type,
    bool? isRead,
    String? senderName,
    String? senderEmail,
    String? taskId,
    String? taskTitle,
    DateTime? createdAt,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      title: title ?? this.title,
      message: message ?? this.message,
      type: type ?? this.type,
      isRead: isRead ?? this.isRead,
      senderName: senderName ?? this.senderName,
      senderEmail: senderEmail ?? this.senderEmail,
      taskId: taskId ?? this.taskId,
      taskTitle: taskTitle ?? this.taskTitle,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory NotificationModel.fromJson(
      Map<String, dynamic> json,
      ) {
    final sender = json['sender'];
    final task = json['task'];

    String getId(dynamic value) {
      if (value == null) return '';

      if (value is Map) {
        return (value['_id'] ?? value['id'] ?? '').toString();
      }

      return value.toString();
    }

    DateTime? getDate(dynamic value) {
      if (value == null) return null;

      return DateTime.tryParse(value.toString());
    }

    return NotificationModel(
      id: getId(json['_id'] ?? json['id']),
      title: (json['title'] ?? '').toString(),
      message: (json['message'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      isRead: json['isRead'] == true,
      senderName: sender is Map
          ? (sender['name'] ?? '').toString()
          : '',
      senderEmail: sender is Map
          ? (sender['email'] ?? '').toString()
          : '',
      taskId: getId(task),
      taskTitle: task is Map
          ? (task['title'] ?? '').toString()
          : '',
      createdAt: getDate(json['createdAt']),
    );
  }
}