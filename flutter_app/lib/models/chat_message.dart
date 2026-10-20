import 'media_item.dart';

class ChatMessage {
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final List<MediaItem> recommendations;

  ChatMessage({
    required this.text,
    required this.isUser,
    DateTime? timestamp,
    this.recommendations = const [],
  }) : timestamp = timestamp ?? DateTime.now();
}
