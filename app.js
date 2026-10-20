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
  const CHAT_STORAGE_KEY = 'amin_chat_history_v1';

  const PLACEHOLDER_POSTER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='92' height='138' viewBox='0 0 92 138'%3E%3Crect width='92' height='138' fill='%2312121b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='24'%3E%F0%9F%8E%AC%3C/text%3E%3C/svg%3E";
  const PLACEHOLDER_AVATAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='40' fill='%23181824'/%3E%3Ctext x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' font-size='28'%3E%F0%9F%8E%AC%3C/text%3E%3C/svg%3E";

  class WatchlistApp {
    constructor() {
      this.titles = this.loadInitialData();
      this.chatHistory = this.loadChatHistory();
      this.activeFilter = 'all';
      this.activeDirector = '';
      this.searchQuery = '';
      this.sortBy = 'added';
      this.editingId = null;
      this.activeDetailItem = null;
      this.pendingDirectorCredits = [];
      this.pendingDirectorPerson = null;
      this.titleAutocompleteTimer = null;
      this.directorAutocompleteTimer = null;
      this.isAiThinking = false;
      this.toastTimer = null;

      this.cacheDOM();
      this.bindEvents();
      this.restoreChatMessages();
      this.render();
    }

    /**
     * Load data with backward-compatible migration from legacy versions.
     * Merges high-res posters, ratings, synopses, and directors into any existing saved items.
     */
    loadInitialData() {
      const defaultData = window.INITIAL_WATCHLIST || [];

      // Create lookup map for default enriched items
      const defaultMap = new Map();
      defaultData.forEach((d) => {
        if (d.id) defaultMap.set('id:' + String(d.id), d);
        if (d.imdbId) defaultMap.set(d.imdbId.toLowerCase(), d);
        if (d.title) defaultMap.set(d.title.toLowerCase(), d);
      });

      try {
        const savedV6 = localStorage.getItem(STORAGE_KEY_V6);
        if (savedV6) {
          const parsed = JSON.parse(savedV6);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge enriched canonical metadata (posters, ratings, synopses, directors) into saved items
            return parsed.map((item) => {
              const match = defaultMap.get('id:' + String(item.id)) ||
                            defaultMap.get((item.title || '').toLowerCase()) ||
                            defaultMap.get((item.imdbId || '').toLowerCase());
              if (match) {
                return {
                  ...match,
                  ...item,
                  imdbId: match.imdbId || item.imdbId,
                  year: match.year || item.year,
                  poster: match.poster || item.poster,
                  rating: match.rating || item.rating,
                  overview: match.overview || item.overview,
                  director: match.director || item.director || ''
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
        directorSelect: document.getElementById('director-select'),
        directorFilterCombobox: document.getElementById('director-filter-combobox'),
        directorFilterInput: document.getElementById('director-filter-input'),
        directorFilterClearBtn: document.getElementById('director-filter-clear-btn'),
        directorFilterDropdown: document.getElementById('director-filter-dropdown'),
        inlineDirectorChip: document.getElementById('inline-director-chip'),
        inlineDirectorChipName: document.getElementById('inline-director-chip-name'),
        btnToggleDirectors: document.getElementById('btn-toggle-directors'),
        directorsTriggerLabel: document.getElementById('directors-trigger-label'),
        activeDirectorBanner: document.getElementById('active-director-banner'),
        activeDirectorName: document.getElementById('active-director-name'),
        btnSyncDirectorBanner: document.getElementById('btn-sync-director-banner'),
        clearDirectorFilter: document.getElementById('clear-director-filter'),
        statTotal: document.getElementById('stat-total'),
        statWatched: document.getElementById('stat-watched'),
        statNew: document.getElementById('stat-new'),
        progressBarFill: document.getElementById('progress-bar-fill'),
        progressText: document.getElementById('progress-text'),
        catalogSummary: document.getElementById('catalog-summary'),
        addBtn: document.getElementById('add-btn'),
        addBtnMobile: document.getElementById('add-btn-mobile'),
        btnAddDirector: document.getElementById('btn-add-director'),
        btnJumpAi: document.getElementById('btn-jump-ai'),
        fabAiCurator: document.getElementById('fab-ai-curator'),
        
        // Add/Edit Modal
        modalBackdrop: document.getElementById('modal-backdrop'),
        modalDialog: document.getElementById('modal-dialog'),
        modalTitle: document.getElementById('modal-title'),
        modalForm: document.getElementById('modal-form'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
        // Add/Edit Modal Autocomplete
        inputTitle: document.getElementById('input-title'),
        titleAutocompleteDropdown: document.getElementById('title-autocomplete-dropdown'),
        titleSearchSpinner: document.getElementById('title-search-spinner'),
        inputYear: document.getElementById('input-year'),
        inputImdbId: document.getElementById('input-imdb'),
        inputDirector: document.getElementById('input-director'),
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
        detailDirectorBox: document.getElementById('detail-director-box'),
        detailDirectorName: document.getElementById('detail-director-name'),
        detailOverview: document.getElementById('detail-overview'),
        detailToggleWatched: document.getElementById('detail-toggle-watched'),
        detailFilterDirector: document.getElementById('detail-filter-director'),
        detailSyncDirector: document.getElementById('detail-sync-director'),
        detailEditBtn: document.getElementById('detail-edit-btn'),
        detailCopyImdb: document.getElementById('detail-copy-imdb'),
        detailVisitImdb: document.getElementById('detail-visit-imdb'),

        // In-App Director Filmography Import Modal
        directorModalBackdrop: document.getElementById('director-modal-backdrop'),
        directorModalCloseBtn: document.getElementById('director-modal-close-btn'),
        directorModalCancelBtn: document.getElementById('director-modal-cancel-btn'),
        directorSearchForm: document.getElementById('director-search-form'),
        directorSearchInput: document.getElementById('director-search-input'),
        directorSearchSpinner: document.getElementById('director-search-spinner'),
        directorAutocompleteDropdown: document.getElementById('director-autocomplete-dropdown'),
        btnSearchDirector: document.getElementById('btn-search-director'),
        directorLoadingState: document.getElementById('director-loading-state'),
        directorLoadingText: document.getElementById('director-loading-text'),
        directorPersonResults: document.getElementById('director-person-results'),
        directorPersonCards: document.getElementById('director-person-cards'),
        directorFilmographyView: document.getElementById('director-filmography-view'),
        directorProfileAvatar: document.getElementById('director-profile-avatar'),
        directorProfileName: document.getElementById('director-profile-name'),
        directorProfileStats: document.getElementById('director-profile-stats'),
        btnSelectAllCredits: document.getElementById('btn-select-all-credits'),
        btnDeselectAllCredits: document.getElementById('btn-deselect-all-credits'),
        filmographyChecklist: document.getElementById('filmography-checklist'),
        btnConfirmImportCredits: document.getElementById('btn-confirm-import-credits'),
        importBtnLabel: document.getElementById('import-btn-label'),

        // AI Cinema Curator Elements
        aiChatDrawer: document.getElementById('ai-chat-drawer'),
        btnCloseChatDrawer: document.getElementById('btn-close-chat-drawer'),
        btnToggleChat: document.getElementById('btn-toggle-chat'),
        toggleChatLabel: document.getElementById('toggle-chat-label'),
        aiQuickForm: document.getElementById('ai-quick-form'),
        aiQuickInput: document.getElementById('ai-quick-input'),
        aiChatHistory: document.getElementById('ai-chat-history'),
        chatTypingIndicator: document.getElementById('chat-typing-indicator'),
        aiChatForm: document.getElementById('ai-chat-form'),
        aiChatInput: document.getElementById('ai-chat-input'),
        btnChatSend: document.getElementById('btn-chat-send'),
        btnClearChat: document.getElementById('btn-clear-chat'),
        drawerPromptsContainer: document.getElementById('drawer-prompts-chips'),

        btnExportCsv: document.getElementById('btn-export-csv'),
        btnExportJson: document.getElementById('btn-export-json'),
        fileInputJson: document.getElementById('file-input-json'),
        btnImportJson: document.getElementById('btn-import-json'),
        promptsContainer: document.getElementById('prompts-chips'),
        toast: document.getElementById('toast')
      };
    }

    bindEvents() {
      // Unified Search & Director Filter with live update and smart dropdown
      this.dom.searchInput.addEventListener('input', (e) => {
        const rawVal = e.target.value;
        this.searchQuery = rawVal.trim().toLowerCase();
        this.dom.searchClearBtn.style.display = (this.searchQuery || this.activeDirector) ? 'grid' : 'none';
        this.render();
        if (this.searchQuery.length >= 1) {
          this.renderDirectorFilterDropdown(rawVal);
        } else {
          this.closeDirectorFilterDropdown();
        }
      });

      this.dom.searchClearBtn.addEventListener('click', () => {
        this.dom.searchInput.value = '';
        this.searchQuery = '';
        if (this.activeDirector) {
          this.setDirectorFilter('');
        }
        this.dom.searchClearBtn.style.display = 'none';
        this.closeDirectorFilterDropdown();
        this.dom.searchInput.focus();
        this.render();
      });

      if (this.dom.inlineDirectorChip) {
        this.dom.inlineDirectorChip.addEventListener('click', () => {
          this.setDirectorFilter('');
          this.closeDirectorFilterDropdown();
        });
      }

      if (this.dom.btnToggleDirectors) {
        this.dom.btnToggleDirectors.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = this.dom.directorFilterDropdown && this.dom.directorFilterDropdown.style.display === 'block';
          if (isOpen) {
            this.closeDirectorFilterDropdown();
          } else {
            this.renderDirectorFilterDropdown(this.dom.searchInput.value);
          }
        });
      }

      // Director select dropdown & search combobox
      if (this.dom.directorSelect) {
        this.dom.directorSelect.addEventListener('change', (e) => {
          this.setDirectorFilter(e.target.value);
        });
      }

      if (this.dom.directorFilterInput) {
        this.dom.directorFilterInput.addEventListener('input', (e) => {
          this.renderDirectorFilterDropdown(e.target.value);
        });
        this.dom.directorFilterInput.addEventListener('focus', (e) => {
          this.renderDirectorFilterDropdown(e.target.value);
        });
      }

      if (this.dom.directorFilterClearBtn) {
        this.dom.directorFilterClearBtn.addEventListener('click', () => {
          this.setDirectorFilter('');
          this.closeDirectorFilterDropdown();
        });
      }

      // Sync director banner button (Add all works from Internet)
      if (this.dom.btnSyncDirectorBanner) {
        this.dom.btnSyncDirectorBanner.addEventListener('click', () => {
          if (this.activeDirector) {
            this.openDirectorModal(this.activeDirector);
          }
        });
      }

      // Clear director banner button
      if (this.dom.clearDirectorFilter) {
        this.dom.clearDirectorFilter.addEventListener('click', () => {
          this.setDirectorFilter('');
        });
      }

      // Sort
      this.dom.sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });

      // Add Title Buttons
      this.dom.addBtn.addEventListener('click', () => this.openAddModal());
      if (this.dom.addBtnMobile) {
        this.dom.addBtnMobile.addEventListener('click', () => this.openAddModal());
      }

      // Add Director Button
      if (this.dom.btnAddDirector) {
        this.dom.btnAddDirector.addEventListener('click', () => this.openDirectorModal());
      }

      // Quick Jump / Open AI Curator Slide-Over Panel
      const openAiDrawer = () => {
        this.setChatDrawerOpen(true);
      };
      if (this.dom.btnJumpAi) this.dom.btnJumpAi.addEventListener('click', openAiDrawer);
      if (this.dom.fabAiCurator) this.dom.fabAiCurator.addEventListener('click', openAiDrawer);
      if (this.dom.btnToggleChat) {
        this.dom.btnToggleChat.addEventListener('click', () => {
          const isOpen = this.dom.aiChatDrawer && this.dom.aiChatDrawer.classList.contains('open');
          this.setChatDrawerOpen(!isOpen);
        });
      }
      if (this.dom.btnCloseChatDrawer) {
        this.dom.btnCloseChatDrawer.addEventListener('click', () => this.setChatDrawerOpen(false));
      }
      if (this.dom.aiChatDrawer) {
        this.dom.aiChatDrawer.addEventListener('click', (e) => {
          if (e.target === this.dom.aiChatDrawer) {
            this.setChatDrawerOpen(false);
          }
        });
      }
      if (this.dom.aiQuickForm) {
        this.dom.aiQuickForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const val = (this.dom.aiQuickInput ? this.dom.aiQuickInput.value : '').trim();
          if (this.dom.aiQuickInput) this.dom.aiQuickInput.value = '';
          this.setChatDrawerOpen(true);
          if (val) {
            this.sendChatMessage(val);
          }
        });
      }

      // Add/Edit Modal Events
      if (this.dom.modalCloseBtn) this.dom.modalCloseBtn.addEventListener('click', () => this.closeModal());
      if (this.dom.modalCancelBtn) this.dom.modalCancelBtn.addEventListener('click', () => this.closeModal());
      if (this.dom.modalBackdrop) {
        this.dom.modalBackdrop.addEventListener('click', (e) => {
          if (e.target === this.dom.modalBackdrop) this.closeModal();
        });
      }

      // Details Modal Events
      if (this.dom.detailCloseBtn) this.dom.detailCloseBtn.addEventListener('click', () => this.closeDetailModal());
      if (this.dom.detailsBackdrop) {
        this.dom.detailsBackdrop.addEventListener('click', (e) => {
          if (e.target === this.dom.detailsBackdrop) this.closeDetailModal();
        });
      }

      if (this.dom.detailToggleWatched) {
        this.dom.detailToggleWatched.addEventListener('click', () => {
          if (this.activeDetailItem) {
            this.toggleWatched(this.activeDetailItem.id);
            this.openDetailModal(this.titles.find((t) => t.id === this.activeDetailItem.id));
          }
        });
      }

      if (this.dom.detailFilterDirector) {
        this.dom.detailFilterDirector.addEventListener('click', () => {
          if (this.activeDetailItem && this.activeDetailItem.director) {
            const dir = this.activeDetailItem.director;
            this.closeDetailModal();
            this.setDirectorFilter(dir);
          }
        });
      }

      if (this.dom.detailSyncDirector) {
        this.dom.detailSyncDirector.addEventListener('click', () => {
          if (this.activeDetailItem && this.activeDetailItem.director) {
            const dir = this.activeDetailItem.director;
            this.closeDetailModal();
            this.openDirectorModal(dir);
          }
        });
      }

      if (this.dom.detailEditBtn) {
        this.dom.detailEditBtn.addEventListener('click', () => {
          if (this.activeDetailItem) {
            const id = this.activeDetailItem.id;
            this.closeDetailModal();
            this.openEditModal(id);
          }
        });
      }

      if (this.dom.detailCopyImdb) {
        this.dom.detailCopyImdb.addEventListener('click', () => {
          if (this.activeDetailItem) {
            this.copyPrompt(this.activeDetailItem.imdbId);
          }
        });
      }

      // Director Filmography Modal Events
      if (this.dom.directorModalCloseBtn) {
        this.dom.directorModalCloseBtn.addEventListener('click', () => this.closeDirectorModal());
      }
      if (this.dom.directorModalCancelBtn) {
        this.dom.directorModalCancelBtn.addEventListener('click', () => this.closeDirectorModal());
      }
      if (this.dom.directorModalBackdrop) {
        this.dom.directorModalBackdrop.addEventListener('click', (e) => {
          if (e.target === this.dom.directorModalBackdrop) this.closeDirectorModal();
        });
      }

      if (this.dom.directorSearchForm) {
        this.dom.directorSearchForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = this.dom.directorSearchInput.value.trim();
          this.searchDirector(query);
        });
      }

      if (this.dom.btnSelectAllCredits) {
        this.dom.btnSelectAllCredits.addEventListener('click', () => this.selectAllCredits(true));
      }
      if (this.dom.btnDeselectAllCredits) {
        this.dom.btnDeselectAllCredits.addEventListener('click', () => this.selectAllCredits(false));
      }
      if (this.dom.btnConfirmImportCredits) {
        this.dom.btnConfirmImportCredits.addEventListener('click', () => this.importSelectedCredits());
      }

      // Live Autocomplete for Title & Director
      if (this.dom.inputTitle) {
        this.dom.inputTitle.addEventListener('input', (e) => this.handleTitleAutocomplete(e.target.value));
        this.dom.inputTitle.addEventListener('focus', (e) => {
          if (e.target.value.trim().length >= 2) this.handleTitleAutocomplete(e.target.value);
        });
      }

      if (this.dom.directorSearchInput) {
        this.dom.directorSearchInput.addEventListener('input', (e) => this.handleDirectorAutocomplete(e.target.value));
        this.dom.directorSearchInput.addEventListener('focus', (e) => {
          if (e.target.value.trim().length >= 2) this.handleDirectorAutocomplete(e.target.value);
        });
      }

      // Close autocomplete dropdowns when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.director-filter-combobox')) {
          this.closeDirectorFilterDropdown();
        }
        if (!e.target.closest('.form-group-autocomplete') && !e.target.closest('.director-search-container')) {
          this.closeAllAutocompletes();
        }
      });

      // AI Cinema Curator Chat Form Events
      if (this.dom.aiChatForm) {
        this.dom.aiChatForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleChatSubmit();
        });
      }

      if (this.dom.btnClearChat) {
        this.dom.btnClearChat.addEventListener('click', () => this.clearChat());
      }

      // Universal Keyboard Navigation (Escape closes any open modal or chat drawer)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeDirectorFilterDropdown();
          this.closeAllAutocompletes();
          if (this.dom.directorModalBackdrop && this.dom.directorModalBackdrop.classList.contains('open')) {
            this.closeDirectorModal();
          } else if (this.dom.detailsBackdrop.classList.contains('open')) {
            this.closeDetailModal();
          } else if (this.dom.modalBackdrop.classList.contains('open')) {
            this.closeModal();
          } else if (this.dom.aiChatDrawer && this.dom.aiChatDrawer.classList.contains('open')) {
            this.setChatDrawerOpen(false);
          }
        }
      });

      if (this.dom.modalForm) {
        this.dom.modalForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleFormSubmit();
        });
      }

      // Export & Backup
      if (this.dom.btnExportCsv) this.dom.btnExportCsv.addEventListener('click', () => this.exportCsv());
      if (this.dom.btnExportJson) this.dom.btnExportJson.addEventListener('click', () => this.exportJson());
      if (this.dom.btnImportJson && this.dom.fileInputJson) {
        this.dom.btnImportJson.addEventListener('click', () => this.dom.fileInputJson.click());
      }
      if (this.dom.fileInputJson) {
        this.dom.fileInputJson.addEventListener('change', (e) => this.importJson(e));
      }

      // Prompts
      this.renderPrompts();
    }

    renderPrompts() {
      const prompts = window.QUICK_PROMPTS || [];
      const containers = [this.dom.promptsContainer, this.dom.drawerPromptsContainer].filter(Boolean);
      containers.forEach((container) => {
        container.innerHTML = '';
        prompts.forEach((prompt) => {
          const btn = document.createElement('button');
          btn.className = 'chip-btn';
          btn.type = 'button';
          btn.textContent = prompt;
          btn.addEventListener('click', () => {
            this.setChatDrawerOpen(true);
            this.sendChatMessage(prompt);
          });
          container.appendChild(btn);
        });
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
      if (this.dom.inputDirector) this.dom.inputDirector.value = this.activeDirector || '';
      this.dom.inputType.value = 'movie';
      if (this.dom.inputPoster) this.dom.inputPoster.value = '';
      this.closeAllAutocompletes();
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
      if (this.dom.inputDirector) this.dom.inputDirector.value = item.director || '';
      this.dom.inputType.value = item.type;
      if (this.dom.inputPoster) this.dom.inputPoster.value = item.poster || '';
      this.closeAllAutocompletes();
      this.dom.modalBackdrop.classList.add('open');
      setTimeout(() => this.dom.inputTitle.focus(), 100);
    }

    closeModal() {
      this.closeAllAutocompletes();
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

      // Director Box & Quick Filter Action
      if (this.dom.detailDirectorBox) {
        if (item.director) {
          this.dom.detailDirectorBox.style.display = 'flex';
          this.dom.detailDirectorName.textContent = item.director;
          if (this.dom.detailFilterDirector) {
            this.dom.detailFilterDirector.style.display = 'inline-flex';
            this.dom.detailFilterDirector.innerHTML = `<span>🎬</span> Filter by ${item.director}`;
          }
          if (this.dom.detailSyncDirector) {
            this.dom.detailSyncDirector.style.display = 'inline-flex';
            this.dom.detailSyncDirector.innerHTML = `<span>🌐</span> Add All Works by ${item.director}`;
          }
        } else {
          this.dom.detailDirectorBox.style.display = 'none';
          if (this.dom.detailFilterDirector) this.dom.detailFilterDirector.style.display = 'none';
          if (this.dom.detailSyncDirector) this.dom.detailSyncDirector.style.display = 'none';
        }
      }

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
      const director = this.dom.inputDirector ? this.dom.inputDirector.value.trim() : '';
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
            ? { ...item, title, year, imdbId, director, type, ...(customPoster ? { poster: customPoster } : {}) }
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
          director,
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

      // Director filter
      if (this.activeDirector) {
        list = list.filter((item) =>
          (item.director || '').toLowerCase().includes(this.activeDirector.toLowerCase())
        );
      }

      // Search query
      if (this.searchQuery) {
        list = list.filter(
          (item) =>
            item.title.toLowerCase().includes(this.searchQuery) ||
            item.year.toLowerCase().includes(this.searchQuery) ||
            (item.director && item.director.toLowerCase().includes(this.searchQuery)) ||
            item.imdbId.toLowerCase().includes(this.searchQuery)
        );
      }

      // Sorting
      if (this.sortBy === 'rating-desc') {
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title));
      } else if (this.sortBy === 'rating-asc') {
        list.sort((a, b) => (a.rating || 99) - (b.rating || 99) || a.title.localeCompare(b.title));
      } else if (this.sortBy === 'title-asc') {
        list.sort((a, b) => a.title.localeCompare(b.title));
      } else if (this.sortBy === 'director-asc') {
        list.sort((a, b) => (a.director || 'zzz').localeCompare(b.director || 'zzz') || a.title.localeCompare(b.title));
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

    getDirectorCounts() {
      const directorCounts = new Map();
      this.titles.forEach((item) => {
        if (item.director) {
          const parts = item.director.split(',').map((s) => s.trim()).filter(Boolean);
          parts.forEach((dir) => {
            directorCounts.set(dir, (directorCounts.get(dir) || 0) + 1);
          });
        }
      });
      return Array.from(directorCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    renderDirectorSelect() {
      const sortedDirectors = this.getDirectorCounts();
      const currentVal = this.activeDirector;

      if (this.dom.directorSelect) {
        this.dom.directorSelect.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = `🎬 All Directors (${sortedDirectors.length})`;
        this.dom.directorSelect.appendChild(defaultOpt);

        sortedDirectors.forEach(([dir, count]) => {
          const opt = document.createElement('option');
          opt.value = dir;
          opt.textContent = `${dir} (${count})`;
          if (dir.toLowerCase() === currentVal.toLowerCase()) {
            opt.selected = true;
          }
          this.dom.directorSelect.appendChild(opt);
        });

        this.dom.directorSelect.value = currentVal;
      }

      if (this.dom.directorFilterInput) {
        if (currentVal) {
          this.dom.directorFilterInput.value = currentVal;
        }
      }
      if (this.dom.directorFilterClearBtn) {
        this.dom.directorFilterClearBtn.style.display = currentVal ? 'grid' : 'none';
      }
      if (this.dom.inlineDirectorChip && this.dom.inlineDirectorChipName) {
        if (currentVal) {
          this.dom.inlineDirectorChip.style.display = 'inline-flex';
          this.dom.inlineDirectorChipName.textContent = currentVal;
        } else {
          this.dom.inlineDirectorChip.style.display = 'none';
          this.dom.inlineDirectorChipName.textContent = '';
        }
      }
      if (this.dom.directorsTriggerLabel) {
        this.dom.directorsTriggerLabel.textContent = currentVal
          ? `Director: ${currentVal}`
          : `Directors (${sortedDirectors.length})`;
      }
      if (this.dom.btnToggleDirectors) {
        this.dom.btnToggleDirectors.classList.toggle('active', Boolean(currentVal));
      }
      if (this.dom.searchClearBtn) {
        this.dom.searchClearBtn.style.display = (this.searchQuery || currentVal) ? 'grid' : 'none';
      }
    }

    renderDirectorFilterDropdown(query = '') {
      if (!this.dom.directorFilterDropdown) return;
      const q = (query || '').trim().toLowerCase();
      const allDirectors = this.getDirectorCounts();

      this.dom.directorFilterDropdown.innerHTML = '';

      // If query is empty, show "All Directors (Reset Filter)"
      if (!q) {
        const allItem = document.createElement('div');
        allItem.className = `director-dropdown-item ${!this.activeDirector ? 'active' : ''}`;
        allItem.innerHTML = `
          <div class="director-item-info">
            <span class="director-item-name">🎬 All Directors (Show Entire Library)</span>
          </div>
          <span class="director-item-count">${allDirectors.length} directors</span>
        `;
        allItem.addEventListener('click', () => {
          this.setDirectorFilter('');
          this.closeDirectorFilterDropdown();
        });
        this.dom.directorFilterDropdown.appendChild(allItem);
      }

      // 1. Filter matching directors in library
      const matched = q 
        ? allDirectors.filter(([dir]) => dir.toLowerCase().includes(q))
        : allDirectors;

      if (matched.length > 0) {
        const header = document.createElement('div');
        header.className = 'director-dropdown-header';
        header.textContent = q ? `🎬 Matching Directors in Library (${matched.length})` : '🎬 Filter by Director in Your Library';
        this.dom.directorFilterDropdown.appendChild(header);

        matched.slice(0, q ? 8 : 20).forEach(([dir, count]) => {
          const item = document.createElement('div');
          const isActive = this.activeDirector.toLowerCase() === dir.toLowerCase();
          item.className = `director-dropdown-item ${isActive ? 'active' : ''}`;
          
          item.innerHTML = `
            <div class="director-item-info">
              <span class="director-item-name">${this.escapeHtml(dir)}</span>
              <span class="director-item-count">${count} title${count === 1 ? '' : 's'}</span>
            </div>
            <button type="button" class="director-item-sync-btn" title="Search internet to update & add all works by ${this.escapeHtml(dir)}">
              <span>🌐</span> Add all works
            </button>
          `;

          // Clicking row filters by that director
          item.addEventListener('click', (e) => {
            if (e.target.closest('.director-item-sync-btn')) return;
            this.dom.searchInput.value = '';
            this.searchQuery = '';
            this.setDirectorFilter(dir);
            this.closeDirectorFilterDropdown();
          });

          // Clicking sync button opens filmography importer
          const syncBtn = item.querySelector('.director-item-sync-btn');
          if (syncBtn) {
            syncBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.closeDirectorFilterDropdown();
              this.openDirectorModal(dir);
            });
          }

          this.dom.directorFilterDropdown.appendChild(item);
        });
      }

      // 2. If user typed a search query, also show matching Titles in Watchlist for instant jump!
      if (q) {
        const matchingTitles = this.titles.filter((t) =>
          t.title.toLowerCase().includes(q) ||
          (t.year && t.year.toLowerCase().includes(q)) ||
          (t.imdbId && t.imdbId.toLowerCase().includes(q))
        ).slice(0, 4);

        if (matchingTitles.length > 0) {
          const titleHeader = document.createElement('div');
          titleHeader.className = 'director-dropdown-header';
          titleHeader.textContent = `🎞️ Matching Titles in Watchlist (Click for Details)`;
          this.dom.directorFilterDropdown.appendChild(titleHeader);

          matchingTitles.forEach((t) => {
            const row = document.createElement('div');
            row.className = 'omni-title-item';
            const posterSrc = t.poster || PLACEHOLDER_POSTER_SVG;
            row.innerHTML = `
              <div class="omni-title-left">
                <img class="omni-title-poster" src="${posterSrc}" alt="${this.escapeHtml(t.title)}">
                <div class="omni-title-meta">
                  <span class="omni-title-name">${this.escapeHtml(t.title)}</span>
                  <div class="omni-title-sub">
                    <span>${this.escapeHtml(t.year)}</span>
                    ${t.director ? `<span>•</span><span>dir. ${this.escapeHtml(t.director)}</span>` : ''}
                    ${t.rating ? `<span>•</span><span style="color:#fbbf24;">★ ${t.rating}</span>` : ''}
                  </div>
                </div>
              </div>
              <span class="badge badge-type" style="font-size:0.65rem;">Details →</span>
            `;
            const imgEl = row.querySelector('.omni-title-poster');
            if (imgEl) {
              imgEl.addEventListener('error', () => { imgEl.src = PLACEHOLDER_POSTER_SVG; });
            }
            row.addEventListener('click', () => {
              this.closeDirectorFilterDropdown();
              this.openDetailModal(t);
            });
            this.dom.directorFilterDropdown.appendChild(row);
          });
        }

        // 3. Internet discovery actions for Director filmography or adding a new Title
        const safeQ = this.escapeHtml(query.trim());
        const internetDirectorAction = document.createElement('div');
        internetDirectorAction.className = 'director-dropdown-internet-action';
        internetDirectorAction.innerHTML = `
          <div class="director-internet-text">
            <span class="director-internet-title">🌐 Search TMDB for Director "${safeQ}"</span>
            <span class="director-internet-sub">Fetch complete directed filmography & import works</span>
          </div>
          <span class="director-internet-badge">Import Filmography →</span>
        `;
        internetDirectorAction.addEventListener('click', () => {
          this.closeDirectorFilterDropdown();
          this.openDirectorModal(query.trim());
        });
        this.dom.directorFilterDropdown.appendChild(internetDirectorAction);

        const internetTitleAction = document.createElement('div');
        internetTitleAction.className = 'director-dropdown-internet-action';
        internetTitleAction.style.borderTop = '1px solid rgba(255,255,255,0.08)';
        internetTitleAction.innerHTML = `
          <div class="director-internet-text">
            <span class="director-internet-title">＋ Add Title "${safeQ}" to Watchlist</span>
            <span class="director-internet-sub">Auto-fill poster, IMDb ID & director from TMDB</span>
          </div>
          <span class="director-internet-badge">Add Title →</span>
        `;
        internetTitleAction.addEventListener('click', () => {
          const initialTitle = query.trim();
          this.closeDirectorFilterDropdown();
          this.openAddModal();
          if (this.dom.inputTitle) {
            this.dom.inputTitle.value = initialTitle;
            this.handleTitleAutocomplete(initialTitle);
          }
        });
        this.dom.directorFilterDropdown.appendChild(internetTitleAction);
      } else {
        // Empty query: Show "Import a New Director from Internet" at the bottom
        const addDirectorItem = document.createElement('div');
        addDirectorItem.className = 'director-dropdown-internet-action';
        addDirectorItem.innerHTML = `
          <div class="director-internet-text">
            <span class="director-internet-title">➕ Import New Director Filmography</span>
            <span class="director-internet-sub">Search internet by filmmaker name to add all their works</span>
          </div>
          <span class="director-internet-badge">Search Internet →</span>
        `;
        addDirectorItem.addEventListener('click', () => {
          this.closeDirectorFilterDropdown();
          this.openDirectorModal('');
        });
        this.dom.directorFilterDropdown.appendChild(addDirectorItem);
      }

      this.dom.directorFilterDropdown.style.display = 'block';
    }

    closeDirectorFilterDropdown() {
      if (this.dom.directorFilterDropdown) {
        this.dom.directorFilterDropdown.style.display = 'none';
      }
    }

    setDirectorFilter(directorName) {
      this.activeDirector = (directorName || '').trim();
      if (this.dom.directorSelect) {
        this.dom.directorSelect.value = this.activeDirector;
      }
      if (this.dom.directorFilterInput) {
        this.dom.directorFilterInput.value = this.activeDirector;
      }
      if (this.dom.directorFilterClearBtn) {
        this.dom.directorFilterClearBtn.style.display = this.activeDirector ? 'grid' : 'none';
      }

      if (this.activeDirector) {
        if (this.dom.activeDirectorBanner) {
          this.dom.activeDirectorBanner.style.display = 'flex';
          this.dom.activeDirectorName.textContent = this.activeDirector;
        }
        this.showToast(`Filtered by Director: ${this.activeDirector}`);
      } else {
        if (this.dom.activeDirectorBanner) {
          this.dom.activeDirectorBanner.style.display = 'none';
        }
      }

      this.render();
    }

    openDirectorModal(initialQuery = '') {
      const q = (initialQuery || '').trim();
      if (this.dom.directorSearchInput) {
        this.dom.directorSearchInput.value = q;
      }
      if (this.dom.directorLoadingState) this.dom.directorLoadingState.style.display = 'none';
      if (this.dom.directorPersonResults) this.dom.directorPersonResults.style.display = 'none';
      if (this.dom.directorFilmographyView) this.dom.directorFilmographyView.style.display = 'none';
      if (this.dom.directorModalBackdrop) this.dom.directorModalBackdrop.classList.add('open');

      if (q) {
        this.searchDirector(q);
      } else if (this.dom.directorSearchInput) {
        setTimeout(() => this.dom.directorSearchInput.focus(), 100);
      }
    }

    closeDirectorModal() {
      if (this.dom.directorModalBackdrop) {
        this.dom.directorModalBackdrop.classList.remove('open');
      }
      this.pendingDirectorCredits = [];
      this.pendingDirectorPerson = null;
    }

    async searchDirector(query) {
      if (!query) return;
      this.dom.directorLoadingState.style.display = 'flex';
      this.dom.directorLoadingText.textContent = `Searching TMDB for "${query}"…`;
      this.dom.directorPersonResults.style.display = 'none';
      this.dom.directorFilmographyView.style.display = 'none';

      try {
        const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        const res = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(query)}&api_key=${apiKey}`);
        if (!res.ok) throw new Error(`TMDB error (${res.status})`);
        const data = await res.json();
        const results = (data.results || []).filter((p) => 
          p.known_for_department === 'Directing' || 
          (p.known_for && p.known_for.length > 0)
        );

        this.dom.directorLoadingState.style.display = 'none';

        if (results.length === 0) {
          this.showToast(`No directors found matching "${query}"`);
          return;
        }

        if (results.length === 1) {
          // Exactly one match, load filmography directly
          this.loadDirectorFilmography(results[0]);
        } else {
          // Multiple candidates, show selection cards
          this.renderDirectorCandidates(results);
        }
      } catch (err) {
        console.error('Failed to search director:', err);
        this.dom.directorLoadingState.style.display = 'none';
        this.showToast(`Director search failed: ${err.message}`);
      }
    }

    renderDirectorCandidates(candidates) {
      this.dom.directorPersonCards.innerHTML = '';
      candidates.slice(0, 8).forEach((person) => {
        const card = document.createElement('div');
        card.className = 'director-person-card';
        const avatarUrl = person.profile_path 
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}` 
          : PLACEHOLDER_AVATAR_SVG;
        
        const knownTitles = (person.known_for || [])
          .map((k) => k.title || k.name)
          .filter(Boolean)
          .slice(0, 2)
          .join(', ');

        card.innerHTML = `
          <img class="director-person-avatar" src="${avatarUrl}" alt="${person.name}">
          <div class="director-person-info">
            <span class="director-person-name">${person.name}</span>
            <span class="director-person-dept">${person.known_for_department || 'Directing'} ${knownTitles ? '• ' + knownTitles : ''}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.loadDirectorFilmography(person);
        });

        this.dom.directorPersonCards.appendChild(card);
      });

      this.dom.directorPersonResults.style.display = 'block';
    }

    async loadDirectorFilmography(person) {
      this.pendingDirectorPerson = person;
      this.dom.directorPersonResults.style.display = 'none';
      this.dom.directorLoadingState.style.display = 'flex';
      this.dom.directorLoadingText.textContent = `Loading complete filmography for ${person.name}…`;

      try {
        const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        const res = await fetch(`https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${apiKey}`);
        if (!res.ok) throw new Error(`TMDB error (${res.status})`);
        const data = await res.json();

        // Filter crew where job is Director or department is Directing
        const crew = (data.crew || []).filter((c) => c.job === 'Director' || c.department === 'Directing');
        
        // Deduplicate by item id
        const seen = new Set();
        const credits = [];
        crew.forEach((c) => {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            credits.push(c);
          }
        });

        // Sort by vote_count descending
        credits.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

        this.dom.directorLoadingState.style.display = 'none';

        if (credits.length === 0) {
          this.showToast(`No directed titles found for ${person.name}`);
          return;
        }

        this.renderFilmographyChecklist(person, credits);
      } catch (err) {
        console.error('Failed to load filmography:', err);
        this.dom.directorLoadingState.style.display = 'none';
        this.showToast(`Failed to load filmography: ${err.message}`);
      }
    }

    renderFilmographyChecklist(person, credits) {
      this.pendingDirectorCredits = credits;

      // Profile Header
      const avatarUrl = person.profile_path 
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}` 
        : PLACEHOLDER_AVATAR_SVG;
      this.dom.directorProfileAvatar.src = avatarUrl;
      this.dom.directorProfileName.textContent = person.name;
      this.dom.directorProfileStats.textContent = `${credits.length} directed titles available to import`;

      // Existing titles lookup for quick deduplication badge
      const existingLookup = new Set();
      this.titles.forEach((t) => {
        existingLookup.add(t.title.toLowerCase());
        if (t.imdbId) existingLookup.add(t.imdbId.toLowerCase());
      });

      this.dom.filmographyChecklist.innerHTML = '';

      credits.forEach((credit, idx) => {
        const title = credit.title || credit.name || 'Untitled';
        const year = (credit.release_date || credit.first_air_date || '').slice(0, 4) || '—';
        const posterUrl = credit.poster_path 
          ? `https://image.tmdb.org/t/p/w185${credit.poster_path}` 
          : PLACEHOLDER_POSTER_SVG;
        const rating = credit.vote_average ? (Math.round(credit.vote_average * 10) / 10).toFixed(1) : null;
        const isTv = credit.media_type === 'tv';
        const isAlreadyAdded = existingLookup.has(title.toLowerCase());

        const row = document.createElement('label');
        row.className = `filmography-item ${isAlreadyAdded ? 'already-added' : ''}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'filmography-checkbox';
        cb.dataset.index = idx;
        cb.checked = !isAlreadyAdded;

        cb.addEventListener('change', () => this.updateImportButtonCount());

        const posterImg = document.createElement('img');
        posterImg.className = 'filmography-poster';
        posterImg.src = posterUrl;
        posterImg.alt = title;

        const info = document.createElement('div');
        info.className = 'filmography-info';

        const titleRow = document.createElement('div');
        titleRow.className = 'filmography-title-row';

        const titleEl = document.createElement('span');
        titleEl.className = 'filmography-title';
        titleEl.textContent = title;
        titleRow.appendChild(titleEl);

        if (isAlreadyAdded) {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.style.cssText = 'background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.65rem; padding: 0.1rem 0.4rem;';
          badge.textContent = 'In Watchlist ✓';
          titleRow.appendChild(badge);
        }

        const metaRow = document.createElement('div');
        metaRow.className = 'filmography-meta';
        metaRow.innerHTML = `
          <span>${year}</span>
          <span>•</span>
          <span class="badge badge-type" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">${isTv ? 'TV' : 'MOVIE'}</span>
          ${rating ? `<span>•</span> <span style="color: #fbbf24;">★ ${rating}</span>` : ''}
          ${credit.vote_count ? `<span style="color: var(--text-muted);">(${credit.vote_count.toLocaleString()} votes)</span>` : ''}
        `;

        info.appendChild(titleRow);
        info.appendChild(metaRow);

        row.appendChild(cb);
        row.appendChild(posterImg);
        row.appendChild(info);

        this.dom.filmographyChecklist.appendChild(row);
      });

      this.updateImportButtonCount();
      this.dom.directorFilmographyView.style.display = 'block';
    }

    updateImportButtonCount() {
      const checked = this.dom.filmographyChecklist.querySelectorAll('.filmography-checkbox:checked');
      const count = checked.length;
      this.dom.importBtnLabel.textContent = `Import ${count} Title${count === 1 ? '' : 's'} to Watchlist`;
      this.dom.btnConfirmImportCredits.disabled = count === 0;
    }

    selectAllCredits(select = true) {
      const cbs = this.dom.filmographyChecklist.querySelectorAll('.filmography-checkbox');
      cbs.forEach((cb) => { cb.checked = select; });
      this.updateImportButtonCount();
    }

    importSelectedCredits() {
      if (!this.pendingDirectorCredits || !this.pendingDirectorPerson) return;
      const checkedBoxes = Array.from(this.dom.filmographyChecklist.querySelectorAll('.filmography-checkbox:checked'));
      if (checkedBoxes.length === 0) {
        this.showToast('No titles selected for import');
        return;
      }

      const directorName = this.pendingDirectorPerson.name;
      const newItems = [];
      const now = Date.now();

      checkedBoxes.forEach((cb, idx) => {
        const credit = this.pendingDirectorCredits[parseInt(cb.dataset.index, 10)];
        if (!credit) return;

        const title = credit.title || credit.name || 'Untitled';
        const year = (credit.release_date || credit.first_air_date || '').slice(0, 4) || 'Unknown';
        const rating = credit.vote_average ? Math.round(credit.vote_average * 10) / 10 : undefined;
        const poster = credit.poster_path ? `https://image.tmdb.org/t/p/w500${credit.poster_path}` : '';
        const mediaType = credit.media_type === 'tv' ? 'tv' : 'movie';

        newItems.push({
          id: `tmdb_${credit.id}`,
          imdbId: `tmdb_${credit.id}`,
          title,
          year,
          type: mediaType,
          poster,
          rating,
          overview: credit.overview || '',
          director: directorName,
          watched: false,
          isNew: true,
          addedAt: now + idx * 10
        });
      });

      // Filter out duplicates that might already be in this.titles
      const existingIds = new Set(this.titles.map((t) => (t.id || '').toLowerCase()));
      const existingTitles = new Set(this.titles.map((t) => (t.title || '').toLowerCase()));
      
      const toAdd = newItems.filter((item) => 
        !existingIds.has(item.id.toLowerCase()) && 
        !existingTitles.has(item.title.toLowerCase())
      );

      if (toAdd.length === 0) {
        this.showToast('All selected titles are already in your watchlist');
        this.closeDirectorModal();
        this.setDirectorFilter(directorName);
        return;
      }

      // Add to front of watchlist
      this.titles = [...toAdd, ...this.titles];
      this.saveData();
      this.closeDirectorModal();
      
      // Automatically activate filter for this director
      this.setDirectorFilter(directorName);
      this.showToast(`Imported ${toAdd.length} titles by ${directorName}! 🎬`);
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
      this.renderDirectorSelect();

      if (this.activeDirector) {
        if (this.dom.activeDirectorBanner) {
          this.dom.activeDirectorBanner.style.display = 'flex';
          this.dom.activeDirectorName.textContent = this.activeDirector;
        }
      } else {
        if (this.dom.activeDirectorBanner) {
          this.dom.activeDirectorBanner.style.display = 'none';
        }
      }

      const filtered = this.getFilteredTitles();
      this.dom.mediaGrid.innerHTML = '';

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
          <div class="empty-icon">🎬</div>
          <h3 class="empty-title">No matching titles found</h3>
          <p class="empty-desc">Try clearing your search query, switching filter tabs, or resetting director filter.</p>
          <button class="btn btn-ghost" id="reset-filter-btn">Reset All Filters</button>
        `;
        empty.querySelector('#reset-filter-btn').addEventListener('click', () => {
          this.activeFilter = 'all';
          this.activeDirector = '';
          this.searchQuery = '';
          this.dom.searchInput.value = '';
          this.dom.searchClearBtn.style.display = 'none';
          if (this.dom.directorSelect) this.dom.directorSelect.value = '';
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

        // Director Badge Link
        if (item.director) {
          const dirBtn = document.createElement('button');
          dirBtn.className = 'card-director';
          dirBtn.type = 'button';
          dirBtn.title = `Filter by ${item.director}`;
          dirBtn.innerHTML = `<span>🎬</span> <span>${item.director}</span>`;
          dirBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setDirectorFilter(item.director);
          });
          details.appendChild(dirBtn);
        }

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
      const headers = ['title', 'director', 'year', 'imdbId', 'type', 'watched', 'isNew'];
      const rows = this.titles.map((t) => [
        `"${t.title.replace(/"/g, '""')}"`,
        `"${(t.director || '').replace(/"/g, '""')}"`,
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

    /* ==========================================================================
       Smart Autocomplete & Fuzzy Suggestion Engine
       ========================================================================== */

    closeAllAutocompletes() {
      if (this.dom.titleAutocompleteDropdown) {
        this.dom.titleAutocompleteDropdown.style.display = 'none';
        this.dom.titleAutocompleteDropdown.innerHTML = '';
      }
      if (this.dom.directorAutocompleteDropdown) {
        this.dom.directorAutocompleteDropdown.style.display = 'none';
        this.dom.directorAutocompleteDropdown.innerHTML = '';
      }
      if (this.dom.titleSearchSpinner) this.dom.titleSearchSpinner.style.display = 'none';
      if (this.dom.directorSearchSpinner) this.dom.directorSearchSpinner.style.display = 'none';
    }

    handleTitleAutocomplete(rawQuery) {
      const query = (rawQuery || '').trim();
      if (this.titleAutocompleteTimer) clearTimeout(this.titleAutocompleteTimer);

      if (query.length < 2) {
        this.closeAllAutocompletes();
        return;
      }

      if (this.dom.titleSearchSpinner) this.dom.titleSearchSpinner.style.display = 'block';

      this.titleAutocompleteTimer = setTimeout(async () => {
        try {
          const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
          const res = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}`);
          if (!res.ok) throw new Error('Network error');
          const data = await res.json();
          
          if (this.dom.titleSearchSpinner) this.dom.titleSearchSpinner.style.display = 'none';

          const results = (data.results || [])
            .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && (item.title || item.name))
            .slice(0, 6);

          this.renderTitleAutocomplete(results, query);
        } catch (e) {
          if (this.dom.titleSearchSpinner) this.dom.titleSearchSpinner.style.display = 'none';
          console.warn('Title autocomplete error:', e);
        }
      }, 250);
    }

    renderTitleAutocomplete(results, originalQuery) {
      const dropdown = this.dom.titleAutocompleteDropdown;
      if (!dropdown) return;

      dropdown.innerHTML = '';

      if (results.length === 0) {
        dropdown.innerHTML = `
          <div class="autocomplete-empty">
            No exact matches for "${originalQuery}". You can enter custom details below.
          </div>
        `;
        dropdown.style.display = 'block';
        return;
      }

      const header = document.createElement('div');
      header.className = 'autocomplete-header';
      header.textContent = 'Suggestions (Click to Auto-fill Details)';
      dropdown.appendChild(header);

      results.forEach((item) => {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').slice(0, 4) || '—';
        const isTv = item.media_type === 'tv';
        const rating = item.vote_average ? (Math.round(item.vote_average * 10) / 10).toFixed(1) : null;
        const posterUrl = item.poster_path 
          ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
          : PLACEHOLDER_POSTER_SVG;

        const row = document.createElement('div');
        row.className = 'autocomplete-item';

        row.innerHTML = `
          <img class="autocomplete-poster" src="${posterUrl}" alt="${title}">
          <div class="autocomplete-info">
            <div class="autocomplete-title-row">
              <span class="autocomplete-title">${title}</span>
              <span class="badge badge-type" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">${isTv ? 'TV' : 'MOVIE'}</span>
            </div>
            <div class="autocomplete-meta">
              <span>${year}</span>
              ${rating ? `<span>•</span> <span style="color: #fbbf24;">★ ${rating}</span>` : ''}
              ${item.overview ? `<span>•</span> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${item.overview}</span>` : ''}
            </div>
          </div>
        `;

        row.addEventListener('click', () => {
          this.selectTitleSuggestion(item);
        });

        dropdown.appendChild(row);
      });

      dropdown.style.display = 'block';
    }

    async selectTitleSuggestion(item) {
      const title = item.title || item.name;
      const year = (item.release_date || item.first_air_date || '').slice(0, 4) || String(new Date().getFullYear());
      const isTv = item.media_type === 'tv';
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';

      this.dom.inputTitle.value = title;
      this.dom.inputYear.value = year;
      this.dom.inputType.value = isTv ? 'tv' : 'movie';
      if (this.dom.inputPoster) this.dom.inputPoster.value = poster;

      this.closeAllAutocompletes();

      // Fetch external IDs and credits to auto-fill IMDb ID and Director
      if (this.dom.titleSearchSpinner) this.dom.titleSearchSpinner.style.display = 'block';

      try {
        const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        const typeEndpoint = isTv ? 'tv' : 'movie';
        const res = await fetch(`https://api.themoviedb.org/3/${typeEndpoint}/${item.id}?api_key=${apiKey}&append_to_response=external_ids,credits`);
        if (res.ok) {
          const details = await res.json();
          const imdbId = details.external_ids?.imdb_id;
          if (imdbId) {
            this.dom.inputImdbId.value = imdbId;
          }

          let directorName = '';
          if (!isTv) {
            const directingCrew = (details.credits?.crew || []).filter((c) => c.job === 'Director');
            if (directingCrew.length > 0) {
              directorName = directingCrew.map((c) => c.name).slice(0, 2).join(', ');
            }
          } else {
            const creators = (details.created_by || []).map((c) => c.name);
            const directingCrew = (details.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name);
            directorName = creators.slice(0, 2).join(', ') || directingCrew.slice(0, 2).join(', ');
          }

          if (directorName && this.dom.inputDirector) {
            this.dom.inputDirector.value = directorName;
          }

          this.showToast(`Auto-filled details for "${title}"! ✨`);
        }
      } catch (err) {
        console.warn('Could not fetch extra details for suggestion:', err);
      } finally {
        if (this.dom.titleSearchSpinner) this.dom.titleSearchSpinner.style.display = 'none';
      }
    }

    handleDirectorAutocomplete(rawQuery) {
      const query = (rawQuery || '').trim();
      if (this.directorAutocompleteTimer) clearTimeout(this.directorAutocompleteTimer);

      if (query.length < 2) {
        if (this.dom.directorAutocompleteDropdown) this.dom.directorAutocompleteDropdown.style.display = 'none';
        if (this.dom.directorSearchSpinner) this.dom.directorSearchSpinner.style.display = 'none';
        return;
      }

      if (this.dom.directorSearchSpinner) this.dom.directorSearchSpinner.style.display = 'block';

      this.directorAutocompleteTimer = setTimeout(async () => {
        try {
          const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
          const res = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(query)}&api_key=${apiKey}`);
          if (!res.ok) throw new Error('Network error');
          const data = await res.json();

          if (this.dom.directorSearchSpinner) this.dom.directorSearchSpinner.style.display = 'none';

          const results = (data.results || []).slice(0, 5);
          this.renderDirectorAutocomplete(results, query);
        } catch (e) {
          if (this.dom.directorSearchSpinner) this.dom.directorSearchSpinner.style.display = 'none';
          console.warn('Director autocomplete error:', e);
        }
      }, 250);
    }

    renderDirectorAutocomplete(results, query) {
      const dropdown = this.dom.directorAutocompleteDropdown;
      if (!dropdown) return;

      dropdown.innerHTML = '';

      if (results.length === 0) {
        dropdown.innerHTML = `
          <div class="autocomplete-empty">
            No director matches found for "${query}".
          </div>
        `;
        dropdown.style.display = 'block';
        return;
      }

      const header = document.createElement('div');
      header.className = 'autocomplete-header';
      header.textContent = 'Directors & Filmmakers';
      dropdown.appendChild(header);

      results.forEach((person) => {
        const avatarUrl = person.profile_path
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
          : PLACEHOLDER_AVATAR_SVG;
        
        const knownTitles = (person.known_for || [])
          .map((k) => k.title || k.name)
          .filter(Boolean)
          .slice(0, 2)
          .join(', ');

        const row = document.createElement('div');
        row.className = 'autocomplete-item';

        row.innerHTML = `
          <img class="autocomplete-avatar" src="${avatarUrl}" alt="${person.name}">
          <div class="autocomplete-info">
            <div class="autocomplete-title-row">
              <span class="autocomplete-title">${person.name}</span>
              <span class="badge badge-type" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">${person.known_for_department || 'Directing'}</span>
            </div>
            <div class="autocomplete-meta">
              <span>Known for: ${knownTitles || 'Cinema & Television'}</span>
            </div>
          </div>
        `;

        row.addEventListener('click', () => {
          this.selectDirectorSuggestion(person);
        });

        dropdown.appendChild(row);
      });

      dropdown.style.display = 'block';
    }

    selectDirectorSuggestion(person) {
      this.dom.directorSearchInput.value = person.name;
      this.closeAllAutocompletes();
      this.loadDirectorFilmography(person);
    }

    /* ==========================================================================
       AI Cinema Curator Engine & Interactive Chat
       ========================================================================== */

    loadChatHistory() {
      try {
        const saved = localStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed.slice(-16);
        }
      } catch (e) {
        console.warn('Could not load chat history:', e);
      }
      return [];
    }

    saveChatHistory() {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(this.chatHistory.slice(-16)));
      } catch (e) {
        console.warn('Could not save chat history:', e);
      }
    }

    setChatDrawerOpen(open) {
      if (!this.dom.aiChatDrawer) return;
      this.dom.aiChatDrawer.classList.toggle('open', Boolean(open));
      if (open) {
        this.scrollChatToBottom();
        setTimeout(() => {
          if (this.dom.aiChatInput) this.dom.aiChatInput.focus();
        }, 200);
      }
    }

    restoreChatMessages() {
      if (!this.chatHistory || this.chatHistory.length === 0) return;
      this.chatHistory.forEach((entry) => {
        this.appendChatMessage(entry.role, entry.content, entry.recommendations || [], false);
      });
    }

    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    handleChatSubmit() {
      const input = this.dom.aiChatInput;
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.sendChatMessage(text);
    }

    clearChat() {
      if (!this.dom.aiChatHistory) return;
      this.chatHistory = [];
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch (e) {
        // ignore
      }
      this.dom.aiChatHistory.innerHTML = `
        <div class="chat-message assistant-message">
          <div class="chat-avatar">✨</div>
          <div class="chat-bubble-wrap">
            <div class="chat-sender-label">AI Cinema Curator</div>
            <div class="chat-bubble">
              <p>Chat cleared. I'm ready for your next movie or TV inquiry!</p>
            </div>
          </div>
        </div>
      `;
      this.showToast('Chat history cleared');
    }

    async sendChatMessage(userText) {
      if (this.isAiThinking) return;
      this.isAiThinking = true;

      // Open slide-over conversation drawer when chatting
      this.setChatDrawerOpen(true);

      // Append user bubble
      this.appendChatMessage('user', userText, [], true);

      // Show typing indicator
      if (this.dom.chatTypingIndicator) {
        this.dom.chatTypingIndicator.style.display = 'flex';
        this.scrollChatToBottom();
      }

      // Process query with intelligent curator engine
      try {
        const responseData = await this.processAiCuratorQuery(userText);
        
        // Brief natural delay for realistic curator feeling
        await new Promise((resolve) => setTimeout(resolve, 450));

        if (this.dom.chatTypingIndicator) {
          this.dom.chatTypingIndicator.style.display = 'none';
        }

        this.appendChatMessage('assistant', responseData.text, responseData.recommendations, true);
      } catch (err) {
        console.error('AI Curator error:', err);
        if (this.dom.chatTypingIndicator) {
          this.dom.chatTypingIndicator.style.display = 'none';
        }
        this.appendChatMessage('assistant', "I'm having a brief issue accessing the film database, but you can explore our 125 curated titles directly using the category filters and director dropdown above!", [], false);
      } finally {
        this.isAiThinking = false;
        this.scrollChatToBottom();
      }
    }

    appendChatMessage(role, content, recommendations = [], persist = true) {
      const container = this.dom.aiChatHistory;
      if (!container) return;

      if (persist) {
        this.chatHistory.push({ role, content, recommendations });
        this.saveChatHistory();
      }

      const messageEl = document.createElement('div');
      messageEl.className = `chat-message ${role === 'user' ? 'user-message' : 'assistant-message'}`;

      const avatar = document.createElement('div');
      avatar.className = 'chat-avatar';
      avatar.textContent = role === 'user' ? '👤' : '✨';
      messageEl.appendChild(avatar);

      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'chat-bubble-wrap';

      const senderLabel = document.createElement('div');
      senderLabel.className = 'chat-sender-label';
      senderLabel.textContent = role === 'user' ? 'You' : 'AI Cinema Curator';
      bubbleWrap.appendChild(senderLabel);

      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';

      // Safely escape HTML first, then convert line breaks and bold/italic markdown
      const formattedText = this.escapeHtml(content)
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

      bubble.innerHTML = `<p>${formattedText}</p>`;

      // Render recommendations cards if available
      if (recommendations && recommendations.length > 0) {
        const recsGrid = document.createElement('div');
        recsGrid.className = 'chat-recommendations';

        recommendations.forEach((rec) => {
          const card = document.createElement('div');
          card.className = 'chat-rec-card';

          const existingMatch = this.titles.find(
            (t) => (t.id === rec.id) || (t.title.toLowerCase() === (rec.title || '').toLowerCase())
          );
          const posterUrl = rec.poster || (existingMatch && existingMatch.poster) || PLACEHOLDER_POSTER_SVG;
          const isInWatchlist = Boolean(existingMatch);
          const safeTitle = this.escapeHtml(rec.title);
          const safeDirector = this.escapeHtml(rec.director || (existingMatch && existingMatch.director) || '');
          const overviewText = this.escapeHtml(rec.overview || (existingMatch && existingMatch.overview) || '');

          card.innerHTML = `
            <img class="chat-rec-poster" src="${posterUrl}" alt="${safeTitle}">
            <div class="chat-rec-info">
              <div class="chat-rec-title" title="${safeTitle}">${safeTitle}</div>
              <div class="chat-rec-meta">
                <span>${this.escapeHtml(rec.year || '—')}</span>
                <span>&bull;</span>
                <span>${safeDirector ? 'dir. ' + safeDirector : (rec.type === 'tv' ? 'TV Series' : 'Movie')}</span>
                ${rec.rating ? `<span>&bull;</span> <span style="color: #fbbf24;">★ ${rec.rating}</span>` : ''}
              </div>
              ${overviewText ? `<div class="chat-rec-overview">${overviewText}</div>` : ''}
            </div>
          `;

          const posterEl = card.querySelector('.chat-rec-poster');
          if (posterEl) {
            posterEl.addEventListener('error', () => {
              posterEl.src = PLACEHOLDER_POSTER_SVG;
            });
          }

          const infoBox = card.querySelector('.chat-rec-info');
          const actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = `chat-rec-btn ${isInWatchlist ? 'added' : ''}`;
          actionBtn.innerHTML = isInWatchlist ? 'In Watchlist • Details' : '<span>＋</span> Add to Watchlist';

          actionBtn.addEventListener('click', () => {
            const match = this.titles.find(
              (t) => (t.id === rec.id) || (t.title.toLowerCase() === (rec.title || '').toLowerCase())
            );
            if (match) {
              this.openDetailModal(match);
            } else {
              this.addRecommendationToWatchlist(rec, actionBtn);
            }
          });

          infoBox.appendChild(actionBtn);
          recsGrid.appendChild(card);
        });

        bubble.appendChild(recsGrid);
      }

      bubbleWrap.appendChild(bubble);
      messageEl.appendChild(bubbleWrap);
      container.appendChild(messageEl);
      this.scrollChatToBottom();
    }

    scrollChatToBottom() {
      if (this.dom.aiChatHistory) {
        this.dom.aiChatHistory.scrollTop = this.dom.aiChatHistory.scrollHeight;
      }
    }

    addRecommendationToWatchlist(rec, btnElement) {
      const exists = this.titles.find(
        (t) => (t.id === rec.id) || (t.title.toLowerCase() === (rec.title || '').toLowerCase())
      );

      if (exists) {
        btnElement.className = 'chat-rec-btn added';
        btnElement.textContent = 'In Watchlist • Details';
        this.openDetailModal(exists);
        return;
      }

      const newItem = {
        id: rec.id || ('user_' + Date.now()),
        imdbId: rec.imdbId || ('tt_rec_' + Date.now().toString().slice(-6)),
        title: rec.title,
        year: rec.year || String(new Date().getFullYear()),
        director: rec.director || '',
        type: rec.type || 'movie',
        poster: rec.poster || '',
        rating: rec.rating || undefined,
        overview: rec.overview || '',
        isNew: true,
        watched: false,
        addedAt: Date.now()
      };

      this.titles = [newItem, ...this.titles];
      this.saveData();
      this.render();

      btnElement.className = 'chat-rec-btn added';
      btnElement.textContent = 'Added ✓ • View Details';
      this.showToast(`Added "${rec.title}" to your watchlist! 🎬`);
    }

    async processAiCuratorQuery(rawQuery) {
      // 0. Primary: Call Google Cloud Run Vertex AI Gemini endpoint
      try {
        const cloudRunApi = window.MEDIA_TRACKER_API_URL || 'https://media-tracker-ai-202076903469.us-central1.run.app';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(`${cloudRunApi}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: rawQuery,
            history: this.chatHistory.slice(-6).map((m) => ({
              role: m.role,
              content: m.content
            })),
            watchlist: this.titles.slice(0, 60).map((t) => ({
              title: t.title,
              year: t.year,
              director: t.director,
              type: t.type,
              rating: t.rating,
              watched: t.watched
            }))
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          // Use Cloud Run response when powered by live Vertex AI or smart query-aware backend
          if (data && data.text && data.source !== 'local-curator-fallback' && data.source !== 'local-heuristic') {
            return {
              text: data.text,
              recommendations: data.recommendations || []
            };
          }
        }
      } catch (err) {
        console.info('Cloud Run Vertex AI endpoint unreachable, using client curation engine:', err);
      }

      const q = rawQuery.toLowerCase();
      const unwatched = this.titles.filter((t) => !t.watched);

      // 1. Check for Director specific queries (both library directors and famous auteurs)
      const famousDirectors = [
        'nolan', 'villeneuve', 'lynch', 'wong kar-wai', 'wong kar wai',
        'park chan-wook', 'park chan wook', 'tarantino', 'scorsese',
        'kubrick', 'miyazaki', 'fincher', 'lanthimos', 'guadagnino',
        'coen', 'bong joon-ho', 'bong joon ho', 'waititi', 'garland',
        'kiarostami', 'sautet', 'bresson', 'bunuel', 'buñuel', 'sciamma',
        'linklater', 'chazelle', 'almodovar', 'wes anderson', 'paul thomas anderson'
      ];

      const libraryDirectors = this.getDirectorCounts().map(([dir]) => dir.toLowerCase());
      const matchedDirectorKey =
        libraryDirectors.find((d) => d.length > 3 && q.includes(d)) ||
        famousDirectors.find((d) => q.includes(d));

      if (matchedDirectorKey) {
        const matchingCatalog = this.titles.filter((t) =>
          (t.director || '').toLowerCase().includes(matchedDirectorKey)
        );

        if (matchingCatalog.length > 0) {
          const dirName = matchingCatalog[0].director;
          return {
            text: `From your curated collection, here are standout works directed by **${dirName}**. Click any card to view full details or filter your library by this filmmaker:`,
            recommendations: matchingCatalog.slice(0, 4)
          };
        } else {
          // Query TMDB for this director's filmography
          try {
            const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
            const sRes = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(matchedDirectorKey)}&api_key=${apiKey}`);
            const sData = await sRes.json();
            const person = sData.results?.[0];
            if (person) {
              const cRes = await fetch(`https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${apiKey}`);
              const cData = await cRes.json();
              const directed = (cData.crew || [])
                .filter((c) => c.job === 'Director')
                .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
                .slice(0, 4)
                .map((c) => ({
                  id: 'tmdb_' + c.id,
                  imdbId: 'tmdb_' + c.id,
                  title: c.title || c.name,
                  year: (c.release_date || c.first_air_date || '').slice(0, 4),
                  director: person.name,
                  type: c.media_type === 'tv' ? 'tv' : 'movie',
                  poster: c.poster_path ? `https://image.tmdb.org/t/p/w500${c.poster_path}` : '',
                  rating: c.vote_average ? Math.round(c.vote_average * 10) / 10 : null,
                  overview: c.overview || ''
                }));

              return {
                text: `Here are acclaimed works by **${person.name}** discovered from TMDB. Tap **Add to Watchlist** on any title to track it immediately:`,
                recommendations: directed
              };
            }
          } catch (e) {
            console.warn('TMDB director lookup error in chat:', e);
          }
        }
      }

      // 2. Festival Winners / 2024-2026 Releases
      if (q.includes('festival') || q.includes('2024') || q.includes('2025') || q.includes('2026') || q.includes('winner') || q.includes('cannes') || q.includes('oscar')) {
        const recentAcclaimed = this.titles
          .filter((t) => ['2023', '2024', '2025', '2026'].includes(String(t.year)))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0));
        return {
          text: `Here are **acclaimed 2024–2026 festival standouts & modern prestige releases** from your collection, ranked by critical reception:`,
          recommendations: recentAcclaimed.slice(0, 4)
        };
      }

      // 3. Surprise Me / Deep Cuts / Auteur Cinema
      if (q.includes('surprise') || q.includes('deep cut') || q.includes('auteur') || q.includes('hidden gem') || q.includes('classic')) {
        const deepCuts = this.titles.filter((t) =>
          t.type === 'community' || (parseInt(t.year, 10) > 0 && parseInt(t.year, 10) <= 2005)
        );
        const shuffled = [...(deepCuts.length >= 3 ? deepCuts : this.titles)]
          .sort(() => 0.5 - Math.random())
          .slice(0, 4);
        return {
          text: `Here are **4 hand-picked auteur deep cuts & world cinema gems** from your archive—spanning poetic realism, psychological intrigue, and unforgettable visual storytelling:`,
          recommendations: shuffled
        };
      }

      // 4. Unwatched / What to watch tonight / Next
      if (q.includes('what to watch') || q.includes('tonight') || q.includes('next') || q.includes('unwatched') || q.includes('recommend')) {
        const pool = unwatched.length > 0 ? unwatched : this.titles;
        const sorted = [...pool].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const pick = sorted.slice(0, 4);

        return {
          text: `Based on your active backlog of **${unwatched.length} unwatched titles**, here are **${pick.length} highest-rated priorities** for tonight:`,
          recommendations: pick
        };
      }

      // 5. Sci-fi / Atmospheric / Mind-bending / Severance
      if (q.includes('sci-fi') || q.includes('space') || q.includes('slow burn') || q.includes('atmospheric') || q.includes('mind-bending') || q.includes('severance') || q.includes('thriller')) {
        const sciFiMatches = this.titles.filter((t) => {
          const txt = `${t.title} ${t.overview} ${t.director}`.toLowerCase();
          return txt.includes('space') || txt.includes('sci-fi') || txt.includes('future') || txt.includes('artificial') || txt.includes('dune') || txt.includes('interstellar') || txt.includes('severance') || txt.includes('dark matter') || txt.includes('machina') || txt.includes('mulholland');
        });

        const pool = sciFiMatches.length > 0 ? sciFiMatches : this.titles;
        return {
          text: `For fans of **atmospheric, slow-burn, and mind-bending speculative storytelling**, these selections deliver unforgettable tension and world-building:`,
          recommendations: pool.slice(0, 4)
        };
      }

      // 6. Arthouse / A24 / Criterion / Romance
      if (q.includes('arthouse') || q.includes('a24') || q.includes('romance') || q.includes('eternal sunshine') || q.includes('lobster') || q.includes('criterion') || q.includes('love')) {
        const arthouse = this.titles.filter((t) => t.type === 'community' || (t.overview && (t.overview.toLowerCase().includes('love') || t.overview.toLowerCase().includes('relationship'))) || ['The Lobster', 'Past Lives', 'Eternal Sunshine', 'In the Mood for Love', 'Portrait of a Lady on Fire', 'Her'].includes(t.title));
        const pool = arthouse.length > 0 ? arthouse : this.titles.slice(0, 4);
        return {
          text: `Here are **poetic, introspective arthouse & A24-style gems** that celebrate mood, striking aesthetics, and deep emotional resonance:`,
          recommendations: pool.slice(0, 4)
        };
      }

      // 7. TV Series / HBO / FX
      if (q.includes('tv') || q.includes('show') || q.includes('series') || q.includes('hbo') || q.includes('fx')) {
        const tvList = this.titles
          .filter((t) => t.type === 'tv')
          .sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const pool = tvList.length > 0 ? tvList : this.titles;
        return {
          text: `Here are **prestige television masterpieces** from HBO, FX, and Apple TV+ featuring world-class writing and auteur direction:`,
          recommendations: pool.slice(0, 4)
        };
      }

      // 8. Fallback / General search via TMDB discovery
      try {
        const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(rawQuery)}&api_key=${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.results || [])
            .filter((i) => (i.media_type === 'movie' || i.media_type === 'tv') && i.poster_path)
            .slice(0, 4)
            .map((i) => ({
              id: 'tmdb_' + i.id,
              imdbId: 'tmdb_' + i.id,
              title: i.title || i.name,
              year: (i.release_date || i.first_air_date || '').slice(0, 4),
              director: '',
              type: i.media_type === 'tv' ? 'tv' : 'movie',
              poster: `https://image.tmdb.org/t/p/w500${i.poster_path}`,
              rating: i.vote_average ? Math.round(i.vote_average * 10) / 10 : null,
              overview: i.overview || ''
            }));

          if (items.length > 0) {
            return {
              text: `I searched global cinema records matching **"${rawQuery}"**. Here are the top matches you can add directly to your watchlist:`,
              recommendations: items
            };
          }
        }
      } catch (e) {
        console.warn('General TMDB chat search failed:', e);
      }

      // Default curated recommendations
      return {
        text: `Here are **4 top-rated highlights** from your watchlist that deserve your attention tonight:`,
        recommendations: [...this.titles].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4)
      };
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.watchlistApp = new WatchlistApp();
    });
  } else {
    window.watchlistApp = new WatchlistApp();
  }
})();
