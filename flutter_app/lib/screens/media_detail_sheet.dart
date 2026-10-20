import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/media_item.dart';
import '../theme/app_theme.dart';

class MediaDetailSheet extends StatelessWidget {
  final MediaItem item;
  final VoidCallback onToggleWatched;
  final Function(String) onFilterDirector;
  final Function(String) onSyncDirector;

  const MediaDetailSheet({
    super.key,
    required this.item,
    required this.onToggleWatched,
    required this.onFilterDirector,
    required this.onSyncDirector,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: const BoxDecoration(
        color: AppTheme.bgDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: item.poster.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: item.poster,
                              width: 100,
                              height: 150,
                              fit: BoxFit.cover,
                            )
                          : Container(width: 100, height: 150, color: Colors.white10),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Text('${item.year} • ${item.type.toUpperCase()}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            children: [
                              if (item.rating != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.star, color: Colors.amber, size: 14),
                                      const SizedBox(width: 4),
                                      Text(item.rating!.toStringAsFixed(1), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                    ],
                                  ),
                                ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: item.watched ? AppTheme.accentEmerald.withOpacity(0.2) : Colors.white10,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  item.watched ? 'WATCHED ✓' : 'UNWATCHED',
                                  style: TextStyle(
                                    color: item.watched ? AppTheme.accentEmerald : Colors.white70,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Director Box
                if (item.director.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.movie_creation_outlined, size: 18, color: AppTheme.accentViolet),
                            const SizedBox(width: 8),
                            Text('Directed by: ${item.director}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () {
                                  Navigator.of(context).pop();
                                  onFilterDirector(item.director);
                                },
                                child: const Text('Filter by Director', style: TextStyle(fontSize: 12)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: FilledButton.tonal(
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppTheme.accentViolet.withOpacity(0.2),
                                  foregroundColor: AppTheme.accentViolet,
                                ),
                                onPressed: () {
                                  Navigator.of(context).pop();
                                  onSyncDirector(item.director);
                                },
                                child: const Text('Add All Works 🌐', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Synopsis
                if (item.overview.isNotEmpty) ...[
                  const Text('Overview', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text(item.overview, style: const TextStyle(color: Colors.white70, height: 1.4, fontSize: 13)),
                  const SizedBox(height: 20),
                ],

                // Action Buttons
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: item.watched ? Colors.white12 : AppTheme.accentEmerald,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: Icon(item.watched ? Icons.refresh : Icons.check_circle_outline, color: Colors.white),
                  label: Text(
                    item.watched ? 'Mark as Unwatched' : 'Mark as Watched',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    onToggleWatched();
                    Navigator.of(context).pop();
                  },
                ),
                const SizedBox(height: 10),
                if (item.imdbId.isNotEmpty)
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.open_in_browser, size: 18),
                    label: Text('Open on IMDb (${item.imdbId})'),
                    onPressed: () async {
                      final url = Uri.parse('https://www.imdb.com/title/${item.imdbId}/');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url, mode: LaunchMode.inAppWebView);
                      }
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
