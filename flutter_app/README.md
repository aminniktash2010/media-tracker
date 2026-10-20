# Amin's Media Tracker - Flutter Cross-Platform App (iOS & Android)

Premium, cinephile-grade Flutter application built for **iOS**, **Android**, and **Web**, designed with modern dark glassmorphic aesthetics.

## Features
- **Real AI Cinema Curator:** Powered by Google Cloud Run & Vertex AI Gemini 1.5. Live contextual chat, tailored film recommendations, and 1-click watchlist addition.
- **Dynamic Watchlist Dashboard:** Real-time stats, watched progress bar, and category filters (All, Movies, Prestige TV, Unwatched, Watched, Top Rated).
- **Director Filmography Importer:** 1-click full filmography lookup on TMDB with multi-select and auto-import.
- **Searchable Director Combobox:** Type any filmmaker's name; if not in library, offers instant TMDB internet search and filmography import.
- **Glassmorphic UI Design System:** Deep space dark theme (`#090A10`), purple glow accents, fluid micro-animations, and responsive cards.

## How to Run
```bash
cd flutter_app

# Fetch dependencies
flutter pub get

# Run on connected device (iOS simulator, Android emulator, or Chrome)
flutter run

# Build APK or Android App Bundle (for Google Play Console)
flutter build appbundle --release

# Build iOS Release
flutter build ipa --release
```
