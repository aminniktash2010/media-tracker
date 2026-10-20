import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/media_item.dart';
import '../theme/app_theme.dart';
import '../services/tmdb_service.dart';
import 'media_detail_sheet.dart';
import 'director_import_sheet.dart';
import 'ai_curator_sheet.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<MediaItem> _titles = [];
  String _activeCategory = 'all';
  String _activeDirector = '';
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadWatchlist();
  }

  Future<void> _loadWatchlist() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('amin_watchlist_v6');
    if (saved != null) {
      try {
        final List list = jsonDecode(saved);
        setState(() {
          _titles = list.map((item) => MediaItem.fromJson(item)).toList();
        });
        return;
      } catch (_) {}
    }

    // Default sample list if freshly installed
    setState(() {
      _titles = [
        MediaItem(
          id: 'tt0816692',
          imdbId: 'tt0816692',
          title: 'Interstellar',
          year: '2014',
          director: 'Christopher Nolan',
          rating: 8.7,
          poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
          overview: 'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot is tasked to pilot a spacecraft along with a team of researchers.',
          watched: true,
        ),
        MediaItem(
          id: 'tt11286314',
          imdbId: 'tt11286314',
          title: 'Severance',
          year: '2022',
          director: 'Ben Stiller',
          type: 'tv',
          rating: 8.7,
          poster: 'https://image.tmdb.org/t/p/w500/p1h4iCjL6qR68565o10N66m0e4S.jpg',
          overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.',
          watched: false,
        ),
        MediaItem(
          id: 'tt15239678',
          imdbId: 'tt15239678',
          title: 'Dune: Part Two',
          year: '2024',
          director: 'Denis Villeneuve',
          rating: 8.5,
          poster: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
          overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
          watched: true,
        ),
      ];
    });
  }

  Future<void> _saveWatchlist() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = jsonEncode(_titles.map((t) => t.toJson()).toList());
    await prefs.setString('amin_watchlist_v6', jsonStr);
  }

  void _toggleWatched(String id) {
    setState(() {
      final index = _titles.indexWhere((t) => t.id == id);
      if (index != -1) {
        _titles[index].watched = !_titles[index].watched;
      }
    });
    _saveWatchlist();
  }

  void _addTitle(MediaItem item) {
    setState(() {
      _titles.insert(0, item);
    });
    _saveWatchlist();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Added "${item.title}" to watchlist!')),
    );
  }

  void _openDirectorModal(String directorName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DirectorImportSheet(
        initialDirectorName: directorName,
        onImport: (newItems) {
          setState(() {
            _titles.insertAll(0, newItems);
            _activeDirector = directorName;
          });
          _saveWatchlist();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Imported ${newItems.length} titles by $directorName!')),
          );
        },
      ),
    );
  }

  List<MediaItem> get _filteredTitles {
    return _titles.where((item) {
      if (_activeCategory == 'movies' && item.type != 'movie') return false;
      if (_activeCategory == 'tv' && item.type != 'tv') return false;
      if (_activeCategory == 'unwatched' && item.watched) return false;
      if (_activeCategory == 'watched' && !item.watched) return false;
      if (_activeCategory == 'top' && (item.rating ?? 0) < 8.0) return false;

      if (_activeDirector.isNotEmpty) {
        if (!item.director.toLowerCase().contains(_activeDirector.toLowerCase())) {
          return false;
        }
      }

      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchTitle = item.title.toLowerCase().contains(q);
        final matchDir = item.director.toLowerCase().contains(q);
        final matchYear = item.year.contains(q);
        if (!matchTitle && !matchDir && !matchYear) return false;
      }

      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final total = _titles.length;
    final watchedCount = _titles.where((t) => t.watched).length;
    final percent = total > 0 ? (watchedCount / total * 100).toInt() : 0;
    final filtered = _filteredTitles;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // App Header & Stats Dashboard
          SliverAppBar(
            pinned: true,
            expandedHeight: 180,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                padding: const EdgeInsets.fromLTRB(20, 60, 20, 16),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF131424), Color(0xFF090A10)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: AppTheme.accentViolet,
                          child: const Text('A', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("Amin's Watchlist", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            Text('$total Titles • Curated Cinema', style: const TextStyle(fontSize: 12, color: Colors.white60)),
                          ],
                        ),
                        const Spacer(),
                        IconButton(
                          icon: const Icon(Icons.auto_awesome, color: AppTheme.accentViolet),
                          onPressed: () {
                            showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.transparent,
                              builder: (_) => AiCuratorSheet(
                                watchlist: _titles,
                                onAddTitle: _addTitle,
                              ),
                            );
                          },
                          tooltip: 'AI Cinema Curator',
                        ),
                      ],
                    ),
                    const Spacer(),
                    // Progress Bar
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: LinearProgressIndicator(
                              value: total > 0 ? watchedCount / total : 0,
                              minHeight: 6,
                              backgroundColor: Colors.white12,
                              color: AppTheme.accentEmerald,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text('$percent% Watched ($watchedCount/$total)', style: const TextStyle(fontSize: 12, color: Colors.white70)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Search & Filter Toolbar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Column(
                children: [
                  TextField(
                    controller: _searchCtrl,
                    onChanged: (val) => setState(() => _searchQuery = val.trim()),
                    decoration: InputDecoration(
                      hintText: 'Search title, director, year…',
                      prefixIcon: const Icon(Icons.search, size: 20, color: Colors.white38),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(height: 10),
                  // Filter Category Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('All', 'all'),
                        _buildFilterChip('Movies', 'movies'),
                        _buildFilterChip('Prestige TV', 'tv'),
                        _buildFilterChip('Unwatched', 'unwatched'),
                        _buildFilterChip('Watched', 'watched'),
                        _buildFilterChip('Top Rated', 'top'),
                      ],
                    ),
                  ),
                  // Active Director Banner
                  if (_activeDirector.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.accentViolet.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.Border.all(color: AppTheme.accentViolet.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.movie_creation_outlined, size: 16, color: AppTheme.accentViolet),
                          const SizedBox(width: 6),
                          Text('Director: $_activeDirector', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () => setState(() => _activeDirector = ''),
                            child: const Icon(Icons.close, size: 16, color: Colors.white60),
                          ),
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () => _openDirectorModal(_activeDirector),
                            child: const Text('Add All Works 🌐', style: TextStyle(fontSize: 12, color: AppTheme.accentViolet, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Media Grid
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.62,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final item = filtered[index];
                  return _buildMediaCard(item);
                },
                childCount: filtered.length,
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.accentViolet,
        icon: const Icon(Icons.add),
        label: const Text('Add Title / Director'),
        onPressed: () => _openDirectorModal(''),
      ),
    );
  }

  Widget _buildFilterChip(String label, String key) {
    final isSelected = _activeCategory == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => setState(() => _activeCategory = key),
        backgroundColor: AppTheme.bgCard,
        selectedColor: AppTheme.accentViolet.withOpacity(0.3),
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : Colors.white70,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildMediaCard(MediaItem item) {
    return GestureDetector(
      onTap: () {
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => MediaDetailSheet(
            item: item,
            onToggleWatched: () => _toggleWatched(item.id),
            onFilterDirector: (dir) => setState(() => _activeDirector = dir),
            onSyncDirector: (dir) => _openDirectorModal(dir),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.bgCard,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderSubtle),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  item.poster.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: item.poster,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(color: Colors.white10),
                          errorWidget: (_, __) => Container(
                            color: const Color(0xFF1F2036),
                            child: Center(
                              child: Text(
                                item.title.isNotEmpty ? item.title[0] : '?',
                                style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                        )
                      : Container(color: const Color(0xFF1F2036)),
                  // Rating Badge
                  if (item.rating != null)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.75),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.star, color: Colors.amber, size: 12),
                            const SizedBox(width: 4),
                            Text(item.rating!.toStringAsFixed(1), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  // Watched Toggle Button
                  Positioned(
                    top: 6,
                    right: 6,
                    child: IconButton(
                      icon: Icon(
                        item.watched ? Icons.check_circle : Icons.radio_button_unchecked,
                        color: item.watched ? AppTheme.accentEmerald : Colors.white70,
                      ),
                      onPressed: () => _toggleWatched(item.id),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${item.year} • ${item.director.isNotEmpty ? item.director : "Cinema"}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: Colors.white54),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
