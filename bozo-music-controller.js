(() => {
  'use strict';

  const STORAGE_KEY = 'bozoMusicPlayerCollapsed';
  let activeProvider = null;
  let collapsed = false;

  function getPlayers() {
    return [
      document.getElementById('spotify-mini-player'),
      document.getElementById('youtube-mini-player')
    ].filter(Boolean);
  }

  function currentPlayer() {
    return activeProvider === 'spotify'
      ? document.getElementById('spotify-mini-player')
      : activeProvider === 'youtube'
        ? document.getElementById('youtube-mini-player')
        : null;
  }

  function syncDocumentState() {
    document.documentElement.dataset.musicProvider = activeProvider || '';
    document.documentElement.dataset.musicCollapsed = collapsed ? 'true' : 'false';
    document.documentElement.dataset.musicActive = activeProvider ? 'true' : 'false';
  }

  function setCollapsed(next, options = {}) {
    collapsed = Boolean(next);
    syncDocumentState();

    getPlayers().forEach((player) => {
      player.classList.toggle('is-collapsed', collapsed);
      const button = player.querySelector('.music-player-collapse');
      if (button) {
        button.textContent = collapsed ? '⌃' : '⌄';
        button.setAttribute('aria-label', collapsed ? 'Restore music player' : 'Minimize music player');
        button.title = collapsed ? 'Restore player' : 'Minimize player';
      }
    });

    if (options.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch (_) {}
    }

    window.dispatchEvent(new CustomEvent('bozo:music-collapse', {
      detail: { collapsed }
    }));
  }

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  function setActiveProvider(provider) {
    activeProvider = provider;

    const spotifyMini = document.getElementById('spotify-mini-player');
    const youtubeMini = document.getElementById('youtube-mini-player');

    if (spotifyMini) spotifyMini.hidden = provider !== 'spotify';
    if (youtubeMini) youtubeMini.hidden = provider !== 'youtube';

    syncDocumentState();
    setCollapsed(collapsed, { persist: false });

    window.dispatchEvent(new CustomEvent('bozo:music-provider', {
      detail: { provider }
    }));
  }

  function getActiveProvider() {
    return activeProvider;
  }

  function initCollapseControls() {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    collapsed = saved === null ? window.matchMedia('(max-width: 700px)').matches : saved === '1';

    getPlayers().forEach((player) => {
      const button = player.querySelector('.music-player-collapse');
      if (button && !button.dataset.bound) {
        button.dataset.bound = 'true';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleCollapsed();
        });
      }
    });

    setCollapsed(collapsed, { persist: false });

    // Keep dialogs readable. When a modal opens, collapse the player without
    // changing the user's saved preference; restore it when all modals close.
    let modalForcedCollapse = false;
    let previousCollapsed = collapsed;
    const updateForModals = () => {
      const modalOpen = Boolean(document.querySelector('.modal-backdrop:not([hidden])'));
      if (modalOpen && !collapsed) {
        previousCollapsed = collapsed;
        modalForcedCollapse = true;
        setCollapsed(true, { persist: false });
      } else if (!modalOpen && modalForcedCollapse) {
        modalForcedCollapse = false;
        setCollapsed(previousCollapsed, { persist: false });
      }
    };

    const observer = new MutationObserver(updateForModals);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'class']
    });
    updateForModals();
  }

  window.BozoMusic = {
    setActiveProvider,
    getActiveProvider,
    setCollapsed,
    toggleCollapsed,
    isCollapsed: () => collapsed,
    getCurrentPlayer: currentPlayer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollapseControls, { once: true });
  } else {
    initCollapseControls();
  }
})();
