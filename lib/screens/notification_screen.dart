import 'package:flutter/material.dart';

import '../models/notification_model.dart';
import '../services/notification_service.dart';

class NotificationScreen extends StatefulWidget {
  final Future<void> Function(String taskId) onOpenTask;

  const NotificationScreen({
    super.key,
    required this.onOpenTask,
  });

  @override
  State<NotificationScreen> createState() =>
      _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  final NotificationService _notificationService =
  NotificationService();

  List<NotificationModel> _notifications = [];
  bool _isLoading = true;
  bool _isMarkingAll = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  // Tai danh sach thong bao
  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final notifications =
      await _notificationService.getNotifications();

      if (!mounted) return;

      setState(() {
        _notifications = notifications;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  // Danh dau mot thong bao da doc
  Future<void> _markAsRead(
      NotificationModel notification,
      ) async {
    if (notification.isRead) return;

    try {
      await _notificationService.markAsRead(notification.id);

      if (!mounted) return;

      setState(() {
        final index = _notifications.indexWhere(
              (item) => item.id == notification.id,
        );

        if (index != -1) {
          _notifications[index] =
              _notifications[index].copyWith(isRead: true);
        }
      });
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể đánh dấu đã đọc: $e'),
        ),
      );
    }
  }

  // Danh dau tat ca thong bao da doc
  Future<void> _markAllAsRead() async {
    if (_notifications.every((item) => item.isRead)) return;

    setState(() {
      _isMarkingAll = true;
    });

    try {
      await _notificationService.markAllAsRead();

      if (!mounted) return;

      setState(() {
        _notifications = _notifications
            .map((item) => item.copyWith(isRead: true))
            .toList();

        _isMarkingAll = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isMarkingAll = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể đánh dấu tất cả: $e'),
        ),
      );
    }
  }

  // Mo cong viec lien quan den thong bao
  Future<void> _openNotification(
      NotificationModel notification,
      ) async {
    await _markAsRead(notification);

    if (!mounted) return;

    final taskId = notification.taskId;

    if (taskId.isNotEmpty) {
      await widget.onOpenTask(taskId);
    }
  }

  // Lay bieu tuong theo loai thong bao
  IconData _getIcon(String type) {
    switch (type) {
      case 'assigned':
        return Icons.assignment_ind_outlined;
      case 'shared':
        return Icons.share_outlined;
      case 'completed':
        return Icons.check_circle_outline;
      case 'updated':
        return Icons.edit_outlined;
      default:
        return Icons.notifications_outlined;
    }
  }

  // Dinh dang thoi gian
  String _formatDate(DateTime? date) {
    if (date == null) {
      return 'Không rõ thời gian';
    }

    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inMinutes < 1) {
      return 'Vừa xong';
    }

    if (difference.inHours < 1) {
      return '${difference.inMinutes} phút trước';
    }

    if (difference.inDays < 1) {
      return '${difference.inHours} giờ trước';
    }

    if (difference.inDays < 7) {
      return '${difference.inDays} ngày trước';
    }

    return '${date.day}/${date.month}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount =
        _notifications.where((item) => !item.isRead).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông báo'),
        actions: [
          TextButton(
            onPressed: unreadCount == 0 || _isMarkingAll
                ? null
                : _markAllAsRead,
            child: _isMarkingAll
                ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
              ),
            )
                : const Text('Đọc tất cả'),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
        child: CircularProgressIndicator(),
      )
          : _error != null
          ? Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadNotifications,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      )
          : _notifications.isEmpty
          ? const Center(
        child: Text('Bạn chưa có thông báo nào'),
      )
          : RefreshIndicator(
        onRefresh: _loadNotifications,
        child: ListView.separated(
          physics:
          const AlwaysScrollableScrollPhysics(),
          itemCount: _notifications.length,
          separatorBuilder: (context, index) =>
          const Divider(height: 1),
          itemBuilder: (context, index) {
            final notification =
            _notifications[index];

            return ListTile(
              leading: CircleAvatar(
                backgroundColor: notification.isRead
                    ? Colors.grey.withValues(alpha: 0.12)
                    : Colors.blue.withValues(alpha: 0.12),
                child: Icon(
                  _getIcon(notification.type),
                  color: notification.isRead
                      ? Colors.grey
                      : Colors.blue,
                ),
              ),
              title: Text(
                notification.title,
                style: TextStyle(
                  fontWeight: notification.isRead
                      ? FontWeight.normal
                      : FontWeight.bold,
                ),
              ),
              subtitle: Column(
                crossAxisAlignment:
                CrossAxisAlignment.start,
                children: [
                  Text(notification.message),
                  const SizedBox(height: 4),
                  Text(
                    _formatDate(notification.createdAt),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
              trailing: notification.isRead
                  ? null
                  : const Icon(
                Icons.circle,
                size: 10,
                color: Colors.blue,
              ),
              onTap: () =>
                  _openNotification(notification),
            );
          },
        ),
      ),
    );
  }
}