# Amin's Media Tracker & Watchlist

An interactive, responsive single-page web application tracking 125 curated cinema releases, prestige TV series, and arthouse classics with instant search, category filters, progress tracking, and poster integration.

- **Live Site:** [https://aminniktash2010.github.io/media-tracker/](https://aminniktash2010.github.io/media-tracker/)
- **Repository:** [https://github.com/aminniktash2010/media-tracker](https://github.com/aminniktash2010/media-tracker)

---

## Features

- **125 Curated Titles:** Spanning 2024–2026 upcoming cinema, prestige drama (HBO, FX, Apple TV+), arthouse masterpieces, and auteur classics.
- **Fast Search & Filter:** Instant real-time filtering across titles, release years, and IMDb IDs, with filter tabs (All, New, Movies, TV, Arthouse, Watched, Unwatched).
- **Watched Progress Tracker:** Interactive completion bar with real-time percentage updates and localStorage continuity.
- **Direct IMDb Integration:** Instant link to each title's IMDb page directly from its card.
- **High-Fidelity Posters & Fallback:** OMDB poster artwork with automated stylized gradient fallbacks.
- **Full Data Backup & Portability:**
  - Export to CSV format for spreadsheets.
  - Download complete JSON backup.
  - Restore / import custom JSON watchlists.
- **Add & Edit Modal:** Quickly add new titles with client-side validation and edit existing items.
- **Mobile-First Responsive Design:** Modern dark mode design system built with Vanilla CSS (`styles.css`), CSS variables, glassmorphism, and micro-animations.
- **Zero-Dependency Architecture:** Pure ES6+ JavaScript (`app.js`, `data.js`) with zero npm build step required.

---

## File Structure

```text
├── index.html                   # Semantic HTML5 entry point with SEO metadata
├── styles.css                   # Modern Vanilla CSS design system
├── app.js                       # Modular ES6+ application state and UI logic
├── data.js                      # 125 curated titles data and quick prompts
├── deploy_media_tracker.sh      # Automated GitHub Pages deploy helper script
├── .github/workflows/pages.yml  # GitHub Actions automated Pages deployment
└── README.md                    # Project documentation
```

---

## Local Development

Because this application uses standard ES Modules with no build steps or dependencies, you can serve it with any local static HTTP server:

```bash
# Using Python 3
python3 -m http.server 8000

# Or using Node.js
npx serve .
```

Open `http://localhost:8000` in your web browser.

---

## Deployment to GitHub Pages

The repository is configured for automated deployment via GitHub Actions:

1. Push changes to the `main` branch.
2. The workflow defined in `.github/workflows/pages.yml` automatically builds and publishes the site to GitHub Pages.
3. Alternatively, run `./deploy_media_tracker.sh` to stage, commit, and deploy.
