class MediaItem {
  final String id;
  final String imdbId;
  final String title;
  final String year;
  final String director;
  final String type; // 'movie', 'tv', 'community'
  final String poster;
  final double? rating;
  final String overview;
  bool watched;
  bool isNew;
  final int addedAt;

  MediaItem({
    required this.id,
    required this.imdbId,
    required this.title,
    required this.year,
    required this.director,
    this.type = 'movie',
    this.poster = '',
    this.rating,
    this.overview = '',
    this.watched = false,
    this.isNew = false,
    int? addedAt,
  }) : addedAt = addedAt ?? DateTime.now().millisecondsSinceEpoch;

  factory MediaItem.fromJson(Map<String, dynamic> json) {
    return MediaItem(
      id: json['id']?.toString() ?? '',
      imdbId: json['imdbId']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled',
      year: json['year']?.toString() ?? '',
      director: json['director']?.toString() ?? '',
      type: json['type']?.toString() ?? 'movie',
      poster: json['poster']?.toString() ?? '',
      rating: json['rating'] != null ? (json['rating'] as num).toDouble() : null,
      overview: json['overview']?.toString() ?? '',
      watched: json['watched'] == true,
      isNew: json['isNew'] == true,
      addedAt: json['addedAt'] != null ? (json['addedAt'] as num).toInt() : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'imdbId': imdbId,
      'title': title,
      'year': year,
      'director': director,
      'type': type,
      'poster': poster,
      'rating': rating,
      'overview': overview,
      'watched': watched,
      'isNew': isNew,
      'addedAt': addedAt,
    };
  }

  MediaItem copyWith({
    String? id,
    String? imdbId,
    String? title,
    String? year,
    String? director,
    String? type,
    String? poster,
    double? rating,
    String? overview,
    bool? watched,
    bool? isNew,
    int? addedAt,
  }) {
    return MediaItem(
      id: id ?? this.id,
      imdbId: imdbId ?? this.imdbId,
      title: title ?? this.title,
      year: year ?? this.year,
      director: director ?? this.director,
      type: type ?? this.type,
      poster: poster ?? this.poster,
      rating: rating ?? this.rating,
      overview: overview ?? this.overview,
      watched: watched ?? this.watched,
      isNew: isNew ?? this.isNew,
      addedAt: addedAt ?? this.addedAt,
    );
  }
}
