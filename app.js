/**
 * Amin's Media Tracker & Watchlist - Modern Application Logic
 * Clean Vanilla ES6+ architecture with LocalStorage continuity, instant search,
 * category filters, statistics dashboard, in-app modal details, and data backup/restore.
 *
 * BEST PRACTICES IMPLEMENTED FOR POSTERS:
 * 1. High-fidelity direct CDN URLs (TMDB w500) for all 125 curated titles.
 * 2. Automatic multi-tier fallback: Direct CDN -> OMDB fallback -> Typographic gradient card.
 * 3. Lazy-loading for performance and low data usage.
 * 4. User-provided custom poster support in Add/Edit modal.
 * 5. Star ratings and plot synopses integrated in the In-App Details Modal.
 */

(function () {
  'use strict';

  const STORAGE_KEY_V6 = 'amin_watchlist_clean_v6';
  const STORAGE_KEY_V5 = 'amin_watchlist_clean_v5';

  class WatchlistApp {
    constructor() {
      this.titles = this.loadInitialData();
      this.activeFilter = 'all';
      this.searchQuery = '';
      this.sortBy = 'added';
      this.editingId = null;
      this.activeDetailItem = null;
      this.toastTimer = null;

      this.cacheDOM();
      this.bindEvents();
      this.render();
    }

    /**
     * Load data with backward-compatible migration from legacy versions.
     * Merges high-res posters, ratings, and synopses into any existing saved items.
     */
    loadInitialData() {
      const defaultData = window.INITIAL_WATCHLIST || [];

      // Create lookup map for default enriched items
      const defaultMap = new Map();
      defaultData.forEach((d) => {
        if (d.imdbId) defaultMap.set(d.imdbId.toLowerCase(), d);
        if (d.title) defaultMap.set(d.title.toLowerCase(), d);
      });

      try {
        const savedV6 = localStorage.getItem(STORAGE_KEY_V6);
        if (savedV6) {
          const parsed = JSON.parse(savedV6);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge enriched metadata (posters, ratings, synopses) into saved items
            return parsed.map((item) => {
              const match = defaultMap.get((item.imdbId || '').toLowerCase()) ||
                            defaultMap.get((item.title || '').toLowerCase());
              if (match) {
                return {
                  ...match,
                  ...item,
                  poster: item.poster || match.poster,
                  rating: item.rating || match.rating,
                  overview: item.overview || match.overview
                };
              }
              return item;
            });
          }
        }

        // Check legacy v5 storage to preserve user's watched statuses
        const savedV5 = localStorage.getItem(STORAGE_KEY_V5);
        const watchedSet = new Set();
        if (savedV5) {
          const parsedV5 = JSON.parse(savedV5);
          if (Array.isArray(parsedV5)) {
            parsedV5.forEach((item) => {
              if (item.watched) {
                watchedSet.add(item.imdbId || item.title);
              }
            });
          }
        }

        const now = Date.now();
        return defaultData.map((item, index) => ({
          ...item,
          watched: watchedSet.has(item.imdbId) || watchedSet.has(item.title) || false,
          addedAt: now - index * 60000
        }));
      } catch (e) {
        console.warn('Error reading from localStorage, using default catalog:', e);
        return defaultData.map((item, index) => ({
          ...item,
          watched: false,
          addedAt: Date.now() - index * 60000
        }));
      }
    }

    saveData() {
      try {
        localStorage.setItem(STORAGE_KEY_V6, JSON.stringify(this.titles));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }

    cacheDOM() {
      this.dom = {
        mediaGrid: document.getElementById('media-grid'),
        filterContainer: document.getElementById('filter-bar'),
        searchInput: document.getElementById('search-input'),
        searchClearBtn: document.getElementById('search-clear-btn'),
        sortSelect: document.getElementById('sort-select'),
        statTotal: document.getElementById('stat-total'),
        statWatched: document.getElementById('stat-watched'),
        statNew: document.getElementById('stat-new'),
        progressBarFill: document.getElementById('progress-bar-fill'),
        progressText: document.getElementById('progress-text'),
        catalogSummary: document.getElementById('catalog-summary'),
        addBtn: document.getElementById('add-btn'),
        addBtnMobile: document.getElementById('add-btn-mobile'),
        
        // Add/Edit Modal
        modalBackdrop: document.getElementById('modal-backdrop'),
        modalDialog: document.getElementById('modal-dialog'),
        modalTitle: document.getElementById('modal-title'),
        modalForm: document.getElementById('modal-form'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
        inputTitle: document.getElementById('input-title'),
        inputYear: document.getElementById('input-year'),
        inputImdbId: document.getElementById('input-imdb'),
        inputType: document.getElementById('input-type'),
        inputPoster: document.getElementById('input-poster'),

        // In-App Media Details Modal (strictly inside WSL)
        detailsBackdrop: document.getElementById('details-backdrop'),
        detailCloseBtn: document.getElementById('detail-close-btn'),
        detailPosterImg: document.getElementById('detail-poster-img'),
        detailPosterFallback: document.getElementById('detail-poster-fallback'),
        detailBadges: document.getElementById('detail-badges'),
        detailHeading: document.getElementById('detail-heading'),
        detailMetaRow: document.getElementById('detail-meta-row'),
        detailOverview: document.getElementById('detail-overview'),
        detailToggleWatched: document.getElementById('detail-toggle-watched'),
        detailEditBtn: document.getElementById('detail-edit-btn'),
        detailCopyImdb: document.getElementById('detail-copy-imdb'),
        detailVisitImdb: document.getElementById('detail-visit-imdb'),

        btnExportCsv: document.getElementById('btn-export-csv'),
        btnExportJson: document.getElementById('btn-export-json'),
        fileInputJson: document.getElementById('file-input-json'),
        btnImportJson: document.getElementById('btn-import-json'),
        promptsContainer: document.getElementById('prompts-chips'),
        toast: document.getElementById('toast')
      };
    }

    bindEvents() {
      // Search with live update and clear button
      this.dom.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.dom.searchClearBtn.style.display = this.searchQuery ? 'grid' : 'none';
        this.render();
      });

      this.dom.searchClearBtn.addEventListener('click', () => {
        this.dom.searchInput.value = '';
        this.searchQuery = '';
        this.dom.searchClearBtn.style.display = 'none';
        this.dom.searchInput.focus();
        this.render();
      });

      // Sort
      this.dom.sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });

      // Add Buttons
      this.dom.addBtn.addEventListener('click', () => this.openAddModal());
      if (this.dom.addBtnMobile) {
        this.dom.addBtnMobile.addEventListener('click', () => this.openAddModal());
      }

      // Add/Edit Modal Events
      this.dom.modalCloseBtn.addEventListener('click', () => this.closeModal());
      this.dom.modalCancelBtn.addEventListener('click', () => this.closeModal());
      this.dom.modalBackdrop.addEventListener('click', (e) => {
        if (e.target === this.dom.modalBackdrop) this.closeModal();
      });

      // Details Modal Events
      this.dom.detailCloseBtn.addEventListener('click', () => this.closeDetailModal());
      this.dom.detailsBackdrop.addEventListener('click', (e) => {
        if (e.target === this.dom.detailsBackdrop) this.closeDetailModal();
      });

      this.dom.detailToggleWatched.addEventListener('click', () => {
        if (this.activeDetailItem) {
          this.toggleWatched(this.activeDetailItem.id);
          this.openDetailModal(this.titles.find((t) => t.id === this.activeDetailItem.id));
        }
      });

      this.dom.detailEditBtn.addEventListener('click', () => {
        if (this.activeDetailItem) {
          const id = this.activeDetailItem.id;
          this.closeDetailModal();
          this.openEditModal(id);
        }
      });

      this.dom.detailCopyImdb.addEventListener('click', () => {
        if (this.activeDetailItem) {
          this.copyPrompt(this.activeDetailItem.imdbId);
        }
      });

      // Universal Keyboard Navigation (Escape closes any open modal)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.dom.detailsBackdrop.classList.contains('open')) {
            this.closeDetailModal();
          } else if (this.dom.modalBackdrop.classList.contains('open')) {
            this.closeModal();
          }
        }
      });

      this.dom.modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });

      // Export & Backup
      this.dom.btnExportCsv.addEventListener('click', () => this.exportCsv());
      this.dom.btnExportJson.addEventListener('click', () => this.exportJson());
      this.dom.btnImportJson.addEventListener('click', () => this.dom.fileInputJson.click());
      this.dom.fileInputJson.addEventListener('change', (e) => this.importJson(e));

      // Prompts
      this.renderPrompts();
    }

    renderPrompts() {
      const prompts = window.QUICK_PROMPTS || [];
      this.dom.promptsContainer.innerHTML = '';
      prompts.forEach((prompt) => {
        const btn = document.createElement('button');
        btn.className = 'chip-btn';
        btn.textContent = prompt;
        btn.addEventListener('click', () => this.copyPrompt(prompt));
        this.dom.promptsContainer.appendChild(btn);
      });
    }

    async copyPrompt(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.showToast(`Copied "${text}" to clipboard`);
      } catch {
        this.showToast('Copied to clipboard');
      }
    }

    showToast(message) {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.dom.toast.textContent = message;
      this.dom.toast.classList.add('visible');
      this.toastTimer = setTimeout(() => {
        this.dom.toast.classList.remove('visible');
      }, 2500);
    }

    openAddModal() {
      this.editingId = null;
      this.dom.modalTitle.textContent = 'Add Title to Watchlist';
      this.dom.inputTitle.value = '';
      this.dom.inputYear.value = new Date().getFullYear().toString();
      this.dom.inputImdbId.value = '';
      this.dom.inputType.value = 'movie';
      if (this.dom.inputPoster) this.dom.inputPoster.value = '';
      this.dom.modalBackdrop.classList.add('open');
      setTimeout(() => this.dom.inputTitle.focus(), 100);
    }

    openEditModal(id) {
      const item = this.titles.find((t) => t.id === id);
      if (!item) return;

      this.editingId = id;
      this.dom.modalTitle.textContent = 'Edit Watchlist Item';
      this.dom.inputTitle.value = item.title;
      this.dom.inputYear.value = item.year;
      this.dom.inputImdbId.value = item.imdbId;
      this.dom.inputType.value = item.type;
      if (this.dom.inputPoster) this.dom.inputPoster.value = item.poster || '';
      this.dom.modalBackdrop.classList.add('open');
      setTimeout(() => this.dom.inputTitle.focus(), 100);
    }

    closeModal() {
      this.dom.modalBackdrop.classList.remove('open');
      this.editingId = null;
    }

    openDetailModal(item) {
      if (!item) return;
      this.activeDetailItem = item;

      // Dismiss NEW badge on view
      if (item.isNew) {
        this.dismissNewBadge(item.id);
      }

      this.dom.detailHeading.textContent = item.title;

      // Primary Poster with Resilient Fallback
      const posterUrl = item.poster || `https://img.omdbapi.com/?i=${item.imdbId}&apikey=thewdb`;
      this.dom.detailPosterImg.src = posterUrl;
      this.dom.detailPosterImg.style.display = 'block';
      this.dom.detailPosterFallback.style.display = 'none';

      this.dom.detailPosterImg.onerror = () => {
        // Fallback to OMDB if TMDB failed
        if (this.dom.detailPosterImg.src !== `https://img.omdbapi.com/?i=${item.imdbId}&apikey=thewdb`) {
          this.dom.detailPosterImg.src = `https://img.omdbapi.com/?i=${item.imdbId}&apikey=thewdb`;
        } else {
          this.dom.detailPosterImg.style.display = 'none';
          this.dom.detailPosterFallback.style.display = 'flex';
          this.dom.detailPosterFallback.style.background = this.getGradient(item.imdbId + item.title);
          this.dom.detailPosterFallback.innerHTML = `
            <span class="fallback-initials">${this.getInitials(item.title)}</span>
            <span class="fallback-title">${item.title}</span>
          `;
        }
      };

      // Badges (Rating, Type, Watched)
      const ratingBadge = item.rating ? `<span class="badge badge-rating">★ ${item.rating}</span>` : '';
      this.dom.detailBadges.innerHTML = `
        <span class="badge badge-type">${item.type === 'community' ? 'Arthouse' : item.type.toUpperCase()}</span>
        ${ratingBadge}
        ${item.watched ? '<span class="badge" style="background: var(--accent-emerald); color: #000;">WATCHED ✓</span>' : '<span class="badge" style="background: rgba(255,255,255,0.1); color: #fff;">UNWATCHED</span>'}
      `;

      // Meta Row
      this.dom.detailMetaRow.innerHTML = `
        <span>Release: <strong>${item.year}</strong></span>
        <span>&bull;</span>
        <span>IMDb: <strong>${item.imdbId}</strong></span>
      `;

      // Synopsis / Overview
      if (this.dom.detailOverview) {
        if (item.overview) {
          this.dom.detailOverview.textContent = item.overview;
          this.dom.detailOverview.style.display = 'block';
        } else {
          this.dom.detailOverview.style.display = 'none';
        }
      }

      // Watched Button Label
      this.dom.detailToggleWatched.textContent = item.watched ? 'Mark as Unwatched' : 'Mark as Watched ✓';

      // Visit IMDb link strictly using target="_self" (no external Windows popup)
      this.dom.detailVisitImdb.href = `https://www.imdb.com/title/${item.imdbId}/`;
      this.dom.detailVisitImdb.target = '_self';

      this.dom.detailsBackdrop.classList.add('open');
    }

    closeDetailModal() {
      this.dom.detailsBackdrop.classList.remove('open');
      this.activeDetailItem = null;
    }

    handleFormSubmit() {
      const title = this.dom.inputTitle.value.trim();
      const year = this.dom.inputYear.value.trim() || String(new Date().getFullYear());
      let imdbId = this.dom.inputImdbId.value.trim();
      const type = this.dom.inputType.value;
      const customPoster = this.dom.inputPoster ? this.dom.inputPoster.value.trim() : '';

      if (!title) {
        this.showToast('Title is required');
        return;
      }

      if (!imdbId) {
        this.showToast('IMDb ID is required (e.g. tt1234567)');
        return;
      }

      if (!imdbId.startsWith('tt')) {
        imdbId = 'tt' + imdbId;
      }

      if (this.editingId) {
        this.titles = this.titles.map((item) =>
          item.id === this.editingId
            ? { ...item, title, year, imdbId, type, ...(customPoster ? { poster: customPoster } : {}) }
            : item
        );
        this.showToast(`Updated "${title}"`);
      } else {
        const exists = this.titles.some(
          (t) => t.imdbId.toLowerCase() === imdbId.toLowerCase() || t.title.toLowerCase() === title.toLowerCase()
        );
        if (exists) {
          this.showToast('Item already in watchlist');
          return;
        }

        const newItem = {
          id: 'user_' + Date.now(),
          imdbId,
          title,
          year,
          type,
          poster: customPoster || `https://img.omdbapi.com/?i=${imdbId}&apikey=thewdb`,
          isNew: true,
          watched: false,
          addedAt: Date.now()
        };
        this.titles = [newItem, ...this.titles];
        this.showToast(`Added "${title}" to watchlist`);
      }

      this.saveData();
      this.closeModal();
      this.render();
    }

    toggleWatched(id, event) {
      if (event) event.stopPropagation();
      this.titles = this.titles.map((item) => {
        if (item.id === id) {
          const nextState = !item.watched;
          this.showToast(nextState ? `Marked "${item.title}" as Watched ✓` : `Marked "${item.title}" as Unwatched`);
          return { ...item, watched: nextState };
        }
        return item;
      });
      this.saveData();
      this.render();
    }

    deleteTitle(id, event) {
      if (event) event.stopPropagation();
      const target = this.titles.find((t) => t.id === id);
      if (!target) return;

      if (confirm(`Remove "${target.title}" from your watchlist?`)) {
        this.titles = this.titles.filter((t) => t.id !== id);
        this.saveData();
        this.showToast(`Removed "${target.title}"`);
        if (this.activeDetailItem && this.activeDetailItem.id === id) {
          this.closeDetailModal();
        }
        this.render();
      }
    }

    dismissNewBadge(id) {
      this.titles = this.titles.map((item) => {
        if (item.id === id && item.isNew) {
          return { ...item, isNew: false };
        }
        return item;
      });
      this.saveData();
      this.renderFilters();
    }

    getFilteredTitles() {
      let list = [...this.titles];

      // Filter tab
      if (this.activeFilter === 'new') {
        list = list.filter((item) => item.isNew);
      } else if (this.activeFilter === 'unwatched') {
        list = list.filter((item) => !item.watched);
      } else if (this.activeFilter === 'watched') {
        list = list.filter((item) => item.watched);
      } else if (this.activeFilter !== 'all') {
        list = list.filter((item) => item.type === this.activeFilter);
      }

      // Search query
      if (this.searchQuery) {
        list = list.filter(
          (item) =>
            item.title.toLowerCase().includes(this.searchQuery) ||
            item.year.toLowerCase().includes(this.searchQuery) ||
            item.imdbId.toLowerCase().includes(this.searchQuery)
        );
      }

      // Sorting
      if (this.sortBy === 'title-asc') {
        list.sort((a, b) => a.title.localeCompare(b.title));
      } else if (this.sortBy === 'year-desc') {
        list.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
      } else if (this.sortBy === 'year-asc') {
        list.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
      } else {
        // Default: addedAt descending
        list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      }

      return list;
    }

    updateStats() {
      const total = this.titles.length;
      const watched = this.titles.filter((t) => t.watched).length;
      const newItems = this.titles.filter((t) => t.isNew).length;
      const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

      this.dom.statTotal.textContent = total;
      this.dom.statWatched.textContent = watched;
      this.dom.statNew.textContent = newItems;
      this.dom.progressBarFill.style.width = `${percent}%`;
      this.dom.progressText.textContent = `${percent}% Completed`;
      this.dom.catalogSummary.textContent = `${total} titles • ${newItems} new`;
    }

    renderFilters() {
      const total = this.titles.length;
      const newCount = this.titles.filter((t) => t.isNew).length;
      const moviesCount = this.titles.filter((t) => t.type === 'movie').length;
      const tvCount = this.titles.filter((t) => t.type === 'tv').length;
      const communityCount = this.titles.filter((t) => t.type === 'community').length;
      const unwatchedCount = this.titles.filter((t) => !t.watched).length;
      const watchedCount = this.titles.filter((t) => t.watched).length;

      const filters = [
        { key: 'all', label: 'All', count: total },
        { key: 'new', label: 'New', count: newCount, pulse: true },
        { key: 'movie', label: 'Movies', count: moviesCount },
        { key: 'tv', label: 'TV Series', count: tvCount },
        { key: 'community', label: 'Arthouse & Community', count: communityCount },
        { key: 'unwatched', label: 'Unwatched', count: unwatchedCount },
        { key: 'watched', label: 'Watched', count: watchedCount }
      ];

      this.dom.filterContainer.innerHTML = '';
      filters.forEach((tab) => {
        const btn = document.createElement('button');
        btn.className = `filter-pill ${this.activeFilter === tab.key ? 'active' : ''}`;

        const label = document.createElement('span');
        label.textContent = tab.label;
        btn.appendChild(label);

        const count = document.createElement('span');
        count.className = 'filter-count';
        count.textContent = tab.count;
        btn.appendChild(count);

        if (tab.pulse && tab.count > 0) {
          const dot = document.createElement('span');
          dot.className = 'pulse-dot';
          btn.appendChild(dot);
        }

        btn.addEventListener('click', () => {
          this.activeFilter = tab.key;
          this.render();
        });

        this.dom.filterContainer.appendChild(btn);
      });
    }

    getInitials(title) {
      return title
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
    }

    getGradient(str) {
      const hues = [210, 240, 265, 290, 320, 160, 25, 45];
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash + str.charCodeAt(i) * 11) % hues.length;
      }
      const h = hues[hash];
      return `linear-gradient(135deg, hsl(${h} 65% 15%), hsl(${(h + 40) % 360} 60% 8%))`;
    }

    render() {
      this.updateStats();
      this.renderFilters();

      const filtered = this.getFilteredTitles();
      this.dom.mediaGrid.innerHTML = '';

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
          <div class="empty-icon">🎬</div>
          <h3 class="empty-title">No matching titles found</h3>
          <p class="empty-desc">Try clearing your search query or switching filter tabs.</p>
          <button class="btn btn-ghost" id="reset-filter-btn">Reset All Filters</button>
        `;
        empty.querySelector('#reset-filter-btn').addEventListener('click', () => {
          this.activeFilter = 'all';
          this.searchQuery = '';
          this.dom.searchInput.value = '';
          this.dom.searchClearBtn.style.display = 'none';
          this.render();
        });
        this.dom.mediaGrid.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();

      filtered.forEach((item) => {
        const card = document.createElement('article');
        card.className = `media-card ${item.watched ? 'is-watched' : ''}`;
        card.tabIndex = 0;

        const posterBox = document.createElement('div');
        posterBox.className = 'poster-box';

        // Primary Poster with Multi-Tier Fallback
        const img = document.createElement('img');
        img.className = 'poster-img';
        img.alt = item.title;
        img.loading = 'lazy';
        
        const primaryPoster = item.poster || `https://img.omdbapi.com/?i=${item.imdbId}&apikey=thewdb`;
        img.src = primaryPoster;

        // Fallback styling
        const fallback = document.createElement('div');
        fallback.className = 'poster-fallback';
        fallback.style.background = this.getGradient(item.imdbId + item.title);
        fallback.style.display = 'none';
        fallback.innerHTML = `
          <span class="fallback-initials">${this.getInitials(item.title)}</span>
          <span class="fallback-title">${item.title}</span>
        `;

        img.addEventListener('error', () => {
          if (img.src !== `https://img.omdbapi.com/?i=${item.imdbId}&apikey=thewdb`) {
            // Try OMDB before final typographic fallback
            img.src = `https://img.omdbapi.com/?i=${item.imdbId}&apikey=thewdb`;
          } else {
            img.style.display = 'none';
            fallback.style.display = 'flex';
          }
        });

        posterBox.appendChild(img);
        posterBox.appendChild(fallback);

        // Card Badges (NEW, TYPE, RATING)
        const badges = document.createElement('div');
        badges.className = 'card-badges';

        const tagGroup = document.createElement('div');
        tagGroup.className = 'badge-tag-group';

        if (item.isNew) {
          const newBadge = document.createElement('span');
          newBadge.className = 'badge badge-new';
          newBadge.textContent = 'NEW';
          tagGroup.appendChild(newBadge);
        }

        const typeBadge = document.createElement('span');
        typeBadge.className = 'badge badge-type';
        typeBadge.textContent = item.type === 'community' ? 'Arthouse' : item.type.toUpperCase();
        tagGroup.appendChild(typeBadge);

        if (item.rating) {
          const ratingBadge = document.createElement('span');
          ratingBadge.className = 'badge badge-rating';
          ratingBadge.textContent = `★ ${item.rating}`;
          tagGroup.appendChild(ratingBadge);
        }

        badges.appendChild(tagGroup);

        // Watched toggle button
        const watchedBtn = document.createElement('button');
        watchedBtn.className = `watched-toggle-btn ${item.watched ? 'active' : ''}`;
        watchedBtn.title = item.watched ? 'Mark unwatched' : 'Mark watched';
        watchedBtn.innerHTML = item.watched ? '✓' : '◐';
        watchedBtn.addEventListener('click', (e) => this.toggleWatched(item.id, e));
        badges.appendChild(watchedBtn);

        posterBox.appendChild(badges);

        // Hover quick actions (All strictly in-app without target="_blank")
        const actions = document.createElement('div');
        actions.className = 'card-overlay-actions';

        const detailBtn = document.createElement('button');
        detailBtn.className = 'action-btn action-btn-edit';
        detailBtn.textContent = 'Details';
        detailBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDetailModal(item);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn action-btn-imdb';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditModal(item.id);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn action-btn-del';
        delBtn.title = 'Remove item';
        delBtn.innerHTML = '✕';
        delBtn.addEventListener('click', (e) => this.deleteTitle(item.id, e));

        actions.appendChild(detailBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        posterBox.appendChild(actions);

        if (item.watched) {
          const curtain = document.createElement('div');
          curtain.className = 'watched-curtain';
          posterBox.appendChild(curtain);
        }

        card.appendChild(posterBox);

        // Card Details
        const details = document.createElement('div');
        details.className = 'card-details';

        const titleEl = document.createElement('h4');
        titleEl.className = 'card-title';
        titleEl.textContent = item.title;
        details.appendChild(titleEl);

        const meta = document.createElement('div');
        meta.className = 'card-meta';

        const yearEl = document.createElement('span');
        yearEl.textContent = item.year;
        meta.appendChild(yearEl);

        const div = document.createElement('span');
        div.className = 'meta-divider';
        meta.appendChild(div);

        // In-app details trigger button instead of target="_blank"
        const imdbBtnTag = document.createElement('button');
        imdbBtnTag.className = 'card-imdb-link';
        imdbBtnTag.textContent = item.imdbId;
        imdbBtnTag.title = 'View details inside app';
        imdbBtnTag.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDetailModal(item);
        });
        meta.appendChild(imdbBtnTag);

        if (item.watched) {
          const watchedLabel = document.createElement('span');
          watchedLabel.className = 'card-watched-badge';
          watchedLabel.textContent = 'Watched';
          meta.appendChild(watchedLabel);
        }

        details.appendChild(meta);
        card.appendChild(details);

        // Card click: open in-app details modal
        card.addEventListener('click', () => {
          this.openDetailModal(item);
        });

        fragment.appendChild(card);
      });

      this.dom.mediaGrid.appendChild(fragment);
    }

    exportCsv() {
      const headers = ['title', 'year', 'imdbId', 'type', 'watched', 'isNew'];
      const rows = this.titles.map((t) => [
        `"${t.title.replace(/"/g, '""')}"`,
        t.year,
        t.imdbId,
        t.type,
        t.watched,
        t.isNew
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amin_watchlist_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      this.showToast('Watchlist exported as CSV');
    }

    exportJson() {
      const dataStr = JSON.stringify(this.titles, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amin_watchlist_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.showToast('Full JSON backup downloaded');
    }

    importJson(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            throw new Error('JSON is not an array of items.');
          }

          const validItems = imported.filter((item) => item.title && item.imdbId);
          if (validItems.length === 0) {
            throw new Error('No valid titles with title and imdbId found.');
          }

          if (confirm(`Import ${validItems.length} titles? This will replace your current watchlist.`)) {
            this.titles = validItems;
            this.saveData();
            this.render();
            this.showToast(`Imported ${validItems.length} titles successfully`);
          }
        } catch (err) {
          alert('Invalid JSON file format: ' + err.message);
        } finally {
          this.dom.fileInputJson.value = '';
        }
      };
      reader.readAsText(file);
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new WatchlistApp());
  } else {
    new WatchlistApp();
  }
})();
