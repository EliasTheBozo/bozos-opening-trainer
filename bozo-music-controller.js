(() => {
  'use strict';

  const COLLAPSE_KEY = 'bozoMusicPlayerCollapsed';
  const DOCK_KEY = 'bozoMusicPlayerDock';
  const HIDDEN_KEY = 'bozoMusicPlayerHidden';
  const VALID_DOCKS = new Set(['bottom-right', 'bottom-left', 'left', 'right']);

  let activeProvider = null;
  let collapsed = false;
  let dismissed = false;
  let dock = 'bottom-right';
  let dragging = null;

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

  function readStorage() {
    try {
      const savedCollapse = localStorage.getItem(COLLAPSE_KEY);
      collapsed = savedCollapse === null
        ? window.matchMedia('(max-width: 700px)').matches
        : savedCollapse === '1';

      const savedDock = localStorage.getItem(DOCK_KEY);
      dock = VALID_DOCKS.has(savedDock) ? savedDock : 'bottom-right';
      dismissed = localStorage.getItem(HIDDEN_KEY) === '1';
    } catch (_) {
      collapsed = window.matchMedia('(max-width: 700px)').matches;
      dock = 'bottom-right';
      dismissed = false;
    }
  }

  function persist(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function effectiveDock() {
    if (window.matchMedia('(max-width: 700px)').matches && (dock === 'left' || dock === 'right')) {
      return 'bottom-right';
    }
    return dock;
  }

  function syncDocumentState() {
    document.documentElement.dataset.musicProvider = activeProvider || '';
    document.documentElement.dataset.musicCollapsed = collapsed ? 'true' : 'false';
    document.documentElement.dataset.musicActive = activeProvider && !dismissed ? 'true' : 'false';
    document.documentElement.dataset.musicDock = effectiveDock();
    document.documentElement.dataset.musicDismissed = dismissed ? 'true' : 'false';
  }

  function syncPlayerClasses() {
    const activeDock = effectiveDock();
    getPlayers().forEach((player) => {
      player.classList.toggle('is-collapsed', collapsed);
      player.classList.toggle('is-dismissed', dismissed);
      player.dataset.musicDock = activeDock;

      const collapseButton = player.querySelector('.music-player-collapse');
      if (collapseButton) {
        collapseButton.textContent = collapsed ? '⌃' : '⌄';
        collapseButton.setAttribute('aria-label', collapsed ? 'Restore music player' : 'Minimize music player');
        collapseButton.title = collapsed ? 'Restore player' : 'Minimize player';
      }
    });
  }

  function setCollapsed(next, options = {}) {
    collapsed = Boolean(next);
    syncDocumentState();
    syncPlayerClasses();

    if (options.persist !== false) persist(COLLAPSE_KEY, collapsed ? '1' : '0');

    window.dispatchEvent(new CustomEvent('bozo:music-collapse', {
      detail: { collapsed }
    }));
  }

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  function setDock(next, options = {}) {
    if (!VALID_DOCKS.has(next)) return;
    dock = next;
    syncDocumentState();
    syncPlayerClasses();
    if (options.persist !== false) persist(DOCK_KEY, dock);

    window.dispatchEvent(new CustomEvent('bozo:music-dock', {
      detail: { dock }
    }));
  }

  function setDismissed(next, options = {}) {
    dismissed = Boolean(next);
    syncDocumentState();
    syncPlayerClasses();
    if (options.persist !== false) persist(HIDDEN_KEY, dismissed ? '1' : '0');

    window.dispatchEvent(new CustomEvent('bozo:music-dismiss', {
      detail: { dismissed }
    }));
  }

  function restorePlayer() {
    setDismissed(false);
  }

  function setActiveProvider(provider) {
    activeProvider = provider;

    const spotifyMini = document.getElementById('spotify-mini-player');
    const youtubeMini = document.getElementById('youtube-mini-player');

    if (spotifyMini) spotifyMini.hidden = provider !== 'spotify';
    if (youtubeMini) youtubeMini.hidden = provider !== 'youtube';

    syncDocumentState();
    syncPlayerClasses();
    setCollapsed(collapsed, { persist: false });

    window.dispatchEvent(new CustomEvent('bozo:music-provider', {
      detail: { provider }
    }));
  }

  function getActiveProvider() {
    return activeProvider;
  }

  function startDrag(event, player) {
    if (event.button !== 0 || !player || dismissed) return;
    const rect = player.getBoundingClientRect();
    dragging = {
      player,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };

    player.classList.add('is-dragging');
    player.style.left = `${rect.left}px`;
    player.style.top = `${rect.top}px`;
    player.style.right = 'auto';
    player.style.bottom = 'auto';
    player.style.transform = 'none';
    player.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function moveDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const { player, offsetX, offsetY } = dragging;
    const rect = player.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - offsetX));
    const y = Math.max(64, Math.min(window.innerHeight - rect.height - 8, event.clientY - offsetY));
    player.style.left = `${x}px`;
    player.style.top = `${y}px`;
    event.preventDefault();
  }

  function finishDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const { player } = dragging;
    const rect = player.getBoundingClientRect();
    dragging = null;
    player.classList.remove('is-dragging');

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Side docks win when released near the middle left/right portions of the viewport.
    let nextDock;
    if (cx < vw * 0.28 && cy < vh * 0.82) nextDock = 'left';
    else if (cx > vw * 0.72 && cy < vh * 0.82) nextDock = 'right';
    else if (cx < vw / 2) nextDock = 'bottom-left';
    else nextDock = 'bottom-right';

    player.style.left = '';
    player.style.top = '';
    player.style.right = '';
    player.style.bottom = '';
    player.style.transform = '';
    setDock(nextDock);
  }

  function bindPlayerControls(player) {
    const collapseButton = player.querySelector('.music-player-collapse');
    if (collapseButton && !collapseButton.dataset.bound) {
      collapseButton.dataset.bound = 'true';
      collapseButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleCollapsed();
      });
    }

    const dragHandle = player.querySelector('.music-player-drag');
    if (dragHandle && !dragHandle.dataset.bound) {
      dragHandle.dataset.bound = 'true';
      dragHandle.addEventListener('pointerdown', (event) => startDrag(event, player));
      dragHandle.addEventListener('pointermove', moveDrag);
      dragHandle.addEventListener('pointerup', finishDrag);
      dragHandle.addEventListener('pointercancel', finishDrag);
    }

    const dismissButton = player.querySelector('.music-player-dismiss');
    if (dismissButton && !dismissButton.dataset.bound) {
      dismissButton.dataset.bound = 'true';
      dismissButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(true);
      });
    }
  }

  function initControls() {
    readStorage();
    getPlayers().forEach(bindPlayerControls);
    syncDocumentState();
    syncPlayerClasses();

    // The navbar Music button is the permanent way to bring a dismissed player back.
    const musicButton = document.getElementById('spotify-music-button');
    if (musicButton && !musicButton.dataset.dockRestoreBound) {
      musicButton.dataset.dockRestoreBound = 'true';
      musicButton.addEventListener('click', () => {
        if (dismissed) setDismissed(false);
      });
    }

    // Keep dialogs readable. When a modal opens, collapse the player without
    // changing the user's saved preference; restore it when all modals close.
    let modalForcedCollapse = false;
    let previousCollapsed = collapsed;
    const updateForModals = () => {
      const modalOpen = Boolean(document.querySelector('.modal-backdrop:not([hidden])'));
      if (modalOpen && !collapsed && !dismissed) {
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

    window.addEventListener('resize', () => {
      syncDocumentState();
      syncPlayerClasses();
    });
  }

  window.BozoMusic = {
    setActiveProvider,
    getActiveProvider,
    setCollapsed,
    toggleCollapsed,
    isCollapsed: () => collapsed,
    setDock,
    getDock: () => dock,
    setDismissed,
    restorePlayer,
    isDismissed: () => dismissed,
    getCurrentPlayer: currentPlayer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initControls, { once: true });
  } else {
    initControls();
  }
})();
