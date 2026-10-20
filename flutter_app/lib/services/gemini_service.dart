import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/media_item.dart';
import '../models/chat_message.dart';

class GeminiService {
  // Can be configured to the Cloud Run service URL or mapped custom domain
  // Cloud Run primary endpoint and custom domain endpoint
  static String cloudRunBaseUrl = 'https://media-tracker-ai-202076903469.us-central1.run.app';
  static String customDomainUrl = 'https://tracker.niktash.ca';

  static Future<ChatMessage> sendMessage({
    required String message,
    required List<MediaItem> watchlist,
  }) async {
    try {
      final url = Uri.parse('$cloudRunBaseUrl/api/chat');
      final payload = {
        'message': message,
        'watchlist': watchlist.take(40).map((t) => {
          'title': t.title,
          'year': t.year,
          'director': t.director,
          'type': t.type,
          'rating': t.rating,
          'watched': t.watched,
        }).toList(),
      };

      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 25));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final text = data['text']?.toString() ?? '';
        final recsList = (data['recommendations'] as List? ?? []).map((r) {
          return MediaItem(
            id: r['id']?.toString() ?? 'rec_${DateTime.now().millisecondsSinceEpoch}',
            imdbId: r['imdbId']?.toString() ?? '',
            title: r['title']?.toString() ?? 'Untitled',
            year: r['year']?.toString() ?? '',
            director: r['director']?.toString() ?? '',
            type: r['type']?.toString() ?? 'movie',
            overview: r['overview']?.toString() ?? '',
            poster: r['poster']?.toString() ?? '',
            isNew: true,
          );
        }).toList();

        return ChatMessage(
          text: text,
          isUser: false,
          recommendations: recsList,
        );
      }
    } catch (e) {
      // Fallback response when Cloud Run backend is offline or starting up
    }

    // High quality offline fallback
    final unwatched = watchlist.where((t) => !t.watched).toList();
    final pick = unwatched.take(3).toList();
    return ChatMessage(
      text: "Hello! As your Cinema Curator, here are top prioritized highlights from your watchlist to enjoy tonight. You can tap on any title for details:",
      isUser: false,
      recommendations: pick,
    );
  }
}
