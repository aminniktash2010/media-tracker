import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/media_item.dart';

class TmdbService {
  static const String apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
  static const String baseUrl = 'https://api.themoviedb.org/3';

  /// Autocomplete search for titles (movies & tv) with fuzzy tolerance
  static Future<List<Map<String, dynamic>>> searchTitles(String query) async {
    if (query.trim().length < 2) return [];
    try {
      final url = Uri.parse('$baseUrl/search/multi?api_key=$apiKey&query=${Uri.encodeComponent(query)}&include_adult=false');
      final res = await http.get(url).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final results = (data['results'] as List? ?? [])
            .where((item) => item['media_type'] == 'movie' || item['media_type'] == 'tv')
            .toList();
        return List<Map<String, dynamic>>.from(results);
      }
    } catch (_) {}
    return [];
  }

  /// Search director by name
  static Future<List<Map<String, dynamic>>> searchDirectors(String query) async {
    if (query.trim().isEmpty) return [];
    try {
      final url = Uri.parse('$baseUrl/search/person?api_key=$apiKey&query=${Uri.encodeComponent(query)}');
      final res = await http.get(url).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final results = (data['results'] as List? ?? [])
            .where((p) => p['known_for_department'] == 'Directing' || (p['known_for'] as List? ?? []).isNotEmpty)
            .toList();
        return List<Map<String, dynamic>>.from(results);
      }
    } catch (_) {}
    return [];
  }

  /// Fetch full directed filmography for a person
  static Future<List<MediaItem>> fetchDirectorFilmography(int personId, String personName) async {
    try {
      final url = Uri.parse('$baseUrl/person/$personId/combined_credits?api_key=$apiKey');
      final res = await http.get(url).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final crew = (data['crew'] as List? ?? [])
            .where((c) => c['job'] == 'Director' || c['department'] == 'Directing')
            .toList();

        final seen = <int>{};
        final items = <MediaItem>[];

        for (final c in crew) {
          final id = c['id'] as int? ?? 0;
          if (id != 0 && !seen.contains(id)) {
            seen.add(id);
            final title = c['title'] ?? c['name'] ?? 'Untitled';
            final date = (c['release_date'] ?? c['first_air_date'] ?? '').toString();
            final year = date.length >= 4 ? date.substring(0, 4) : '—';
            final posterPath = c['poster_path']?.toString();
            final poster = posterPath != null ? 'https://image.tmdb.org/t/p/w500$posterPath' : '';
            final rating = c['vote_average'] != null ? (c['vote_average'] as num).toDouble() : null;

            items.add(MediaItem(
              id: 'tmdb_$id',
              imdbId: 'tmdb_$id',
              title: title.toString(),
              year: year,
              director: personName,
              type: c['media_type'] == 'tv' ? 'tv' : 'movie',
              poster: poster,
              rating: rating != null ? double.parse(rating.toStringAsFixed(1)) : null,
              overview: c['overview']?.toString() ?? '',
              isNew: true,
            ));
          }
        }

        // Sort by vote count descending
        return items;
      }
    } catch (_) {}
    return [];
  }
}
