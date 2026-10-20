import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/media_item.dart';
import '../services/tmdb_service.dart';
import '../theme/app_theme.dart';

class DirectorImportSheet extends StatefulWidget {
  final String initialDirectorName;
  final Function(List<MediaItem>) onImport;

  const DirectorImportSheet({
    super.key,
    this.initialDirectorName = '',
    required this.onImport,
  });

  @override
  State<DirectorImportSheet> createState() => _DirectorImportSheetState();
}

class _DirectorImportSheetState extends State<DirectorImportSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  bool _isLoading = false;
  List<MediaItem> _credits = [];
  final Set<int> _selectedIndices = {};
  String _currentDirector = '';

  @override
  void initState() {
    super.initState();
    if (widget.initialDirectorName.isNotEmpty) {
      _searchCtrl.text = widget.initialDirectorName;
      _searchAndLoadDirector(widget.initialDirectorName);
    }
  }

  Future<void> _searchAndLoadDirector(String query) async {
    final q = query.trim();
    if (q.isEmpty) return;

    setState(() {
      _isLoading = true;
      _credits = [];
      _selectedIndices.clear();
      _currentDirector = q;
    });

    final directors = await TmdbService.searchDirectors(q);
    if (directors.isNotEmpty) {
      final person = directors.first;
      final personId = person['id'] as int? ?? 0;
      final personName = person['name']?.toString() ?? q;

      final items = await TmdbService.fetchDirectorFilmography(personId, personName);
      setState(() {
        _credits = items;
        _currentDirector = personName;
        _isLoading = false;
        // Select all by default
        for (int i = 0; i < items.length; i++) {
          _selectedIndices.add(i);
        }
      });
    } else {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No director found matching "$q" on TMDB')),
      );
    }
  }

  void _selectAll(bool select) {
    setState(() {
      _selectedIndices.clear();
      if (select) {
        for (int i = 0; i < _credits.length; i++) {
          _selectedIndices.add(i);
        }
      }
    });
  }

  void _confirmImport() {
    final toImport = <MediaItem>[];
    for (final idx in _selectedIndices) {
      if (idx >= 0 && idx < _credits.length) {
        toImport.add(_credits[idx]);
      }
    }
    if (toImport.isEmpty) return;
    widget.onImport(toImport);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: const BoxDecoration(
        color: AppTheme.bgDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.movie_filter_outlined, color: AppTheme.accentViolet),
                const SizedBox(width: 8),
                const Text('Import Director Filmography', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // Search Line
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchCtrl,
              onSubmitted: _searchAndLoadDirector,
              decoration: InputDecoration(
                hintText: 'Search director (e.g. Denis Villeneuve, Christopher Nolan)…',
                suffixIcon: IconButton(
                  icon: const Icon(Icons.search, color: AppTheme.accentViolet),
                  onPressed: () => _searchAndLoadDirector(_searchCtrl.text),
                ),
              ),
            ),
          ),

          if (_isLoading)
            const Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: AppTheme.accentViolet),
                    SizedBox(height: 12),
                    Text('Searching TMDB & loading filmography…', style: TextStyle(color: Colors.white70)),
                  ],
                ),
              ),
            )
          else if (_credits.isNotEmpty) ...[
            // Select All / Deselect Toolbar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Row(
                children: [
                  Text('$_currentDirector (${_credits.length} works)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const Spacer(),
                  TextButton(
                    onPressed: () => _selectAll(true),
                    child: const Text('Select All', style: TextStyle(fontSize: 12)),
                  ),
                  TextButton(
                    onPressed: () => _selectAll(false),
                    child: const Text('Deselect All', style: TextStyle(fontSize: 12, color: Colors.white54)),
                  ),
                ],
              ),
            ),
            // Filmography Checklist
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _credits.length,
                itemBuilder: (context, index) {
                  final item = _credits[index];
                  final isChecked = _selectedIndices.contains(index);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: CheckboxListTile(
                      value: isChecked,
                      activeColor: AppTheme.accentViolet,
                      onChanged: (val) {
                        setState(() {
                          if (val == true) {
                            _selectedIndices.add(index);
                          } else {
                            _selectedIndices.remove(index);
                          }
                        });
                      },
                      secondary: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: item.poster.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: item.poster,
                                width: 36,
                                height: 52,
                                fit: BoxFit.cover,
                              )
                            : Container(width: 36, height: 52, color: Colors.white12),
                      ),
                      title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      subtitle: Text('${item.year} • ${item.type.toUpperCase()}${item.rating != null ? " • ★ ${item.rating}" : ""}', style: const TextStyle(fontSize: 11, color: Colors.white60)),
                    ),
                  );
                },
              ),
            ),
            // Import Button Footer
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accentViolet,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                    onPressed: _selectedIndices.isNotEmpty ? _confirmImport : null,
                    child: Text('Import ${_selectedIndices.length} Titles to Watchlist', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ),
              ),
            ),
          ] else
            const Expanded(
              child: Center(
                child: Text('Search any filmmaker to automatically fetch & import their works', style: TextStyle(color: Colors.white38)),
              ),
            ),
        ],
      ),
    );
  }
}
