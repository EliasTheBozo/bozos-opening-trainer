(() => {
  'use strict';

  const COLLAPSE_KEY = 'bozoMusicPlayerCollapsed';
  const DOCK_KEY = 'bozoMusicPlayerDockV2';
  const VALID_DOCKS = new Set(['bottom-right', 'bottom-left', 'left', 'right']);
  const DEFAULT_DOCK = 'bottom-right';

  let activeProvider = null;
  let collapsed = false;
  let dock = DEFAULT_DOCK;
  let dragging = null;
  let suppressNextClick = false;

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
      dock = VALID_DOCKS.has(savedDock) ? savedDock : DEFAULT_DOCK;
    } catch (_) {
      collapsed = window.matchMedia('(max-width: 700px)').matches;
      dock = DEFAULT_DOCK;
    }
  }

  function persist(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function effectiveDock() {
    if (window.matchMedia('(max-width: 700px)').matches && (dock === 'left' || dock === 'right')) {
      return DEFAULT_DOCK;
    }
    return dock;
  }

  function syncDocumentState() {
    document.documentElement.dataset.musicProvider = activeProvider || '';
    document.documentElement.dataset.musicCollapsed = collapsed ? 'true' : 'false';
    document.documentElement.dataset.musicActive = activeProvider ? 'true' : 'false';
    document.documentElement.dataset.musicDock = effectiveDock();
  }

  function clearInlineDragPosition(player) {
    ['left','top','right','bottom','transform'].forEach((prop) => player.style.removeProperty(prop));
  }

  function syncPlayerClasses() {
    const activeDock = effectiveDock();
    getPlayers().forEach((player) => {
      player.classList.toggle('is-collapsed', collapsed);
      player.classList.toggle('is-vertical', activeDock === 'left' || activeDock === 'right');
      player.dataset.musicDock = activeDock;
      player.setAttribute('data-draggable-player', 'true');

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
    window.dispatchEvent(new CustomEvent('bozo:music-collapse', { detail: { collapsed } }));
  }

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  function setDock(next, options = {}) {
    if (!VALID_DOCKS.has(next)) next = DEFAULT_DOCK;
    dock = next;
    getPlayers().forEach((player) => { clearInlineDragPosition(player); player.style.removeProperty('position'); });
    syncDocumentState();
    syncPlayerClasses();
    if (options.persist !== false) persist(DOCK_KEY, dock);
    window.dispatchEvent(new CustomEvent('bozo:music-dock', { detail: { dock } }));
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

    window.dispatchEvent(new CustomEvent('bozo:music-provider', { detail: { provider } }));
  }

  function getActiveProvider() {
    return activeProvider;
  }

  function isInteractiveControl(target) {
    if (!(target instanceof Element)) return false;
    // The track summary itself can still start a drag; a normal click remains a normal click.
    return Boolean(target.closest(
      '.spotify-mini-controls, .spotify-progress-wrap, .spotify-volume-control, ' +
      '.music-player-collapse, input, select, textarea, a, button:not(.spotify-track-summary)'
    ));
  }

  function setDragPosition(player, left, top) {
    // Dock CSS intentionally uses !important. During a live drag the inline
    // coordinates must temporarily outrank those dock constraints.
    player.style.setProperty('position', 'fixed', 'important');
    player.style.setProperty('left', `${left}px`, 'important');
    player.style.setProperty('top', `${top}px`, 'important');
    player.style.setProperty('right', 'auto', 'important');
    player.style.setProperty('bottom', 'auto', 'important');
    player.style.setProperty('transform', 'none', 'important');
  }

  function beginPotentialDrag(event, player) {
    if (event.button !== 0 || !player || isInteractiveControl(event.target)) return;
    const rect = player.getBoundingClientRect();
    dragging = {
      player,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    player.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const { player, startX, startY, offsetX, offsetY } = dragging;

    if (!dragging.moved) {
      const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (distance < 6) return;
      dragging.moved = true;
      player.classList.add('is-dragging');
      const rect = player.getBoundingClientRect();
      setDragPosition(player, rect.left, rect.top);
    }

    const rect = player.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - offsetX));
    const y = Math.max(72, Math.min(window.innerHeight - rect.height - 8, event.clientY - offsetY));
    setDragPosition(player, x, y);
    event.preventDefault();
  }

  function chooseDock(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Deliberately conservative snap zones. The central page is never a valid dock.
    const sideZone = Math.min(230, vw * 0.15);
    const bottomZone = Math.min(135, vh * 0.16);
    const navSafeTop = Math.max(88, vh * 0.10);

    const nearLeft = rect.left <= sideZone;
    const nearRight = rect.right >= vw - sideZone;
    const nearBottom = rect.bottom >= vh - bottomZone;
    const verticallySafeForSide = cy > navSafeTop && cy < vh * 0.78;

    // A side dock is valid only in the outer gutter and away from the nav/bottom controls.
    if (nearLeft && verticallySafeForSide) return 'left';
    if (nearRight && verticallySafeForSide) return 'right';

    // Only the actual lower edge is a valid horizontal dock.
    if (nearBottom) return cx < vw / 2 ? 'bottom-left' : 'bottom-right';

    // Center/top/content drops are obstructive and always return home.
    return DEFAULT_DOCK;
  }

  function finishDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const { player, moved } = dragging;
    dragging = null;

    if (!moved) return;

    suppressNextClick = true;
    player.classList.remove('is-dragging');
    const nextDock = chooseDock(player.getBoundingClientRect());
    setDock(nextDock);
    setTimeout(() => { suppressNextClick = false; }, 0);
    event.preventDefault();
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

    if (!player.dataset.dragSurfaceBound) {
      player.dataset.dragSurfaceBound = 'true';
      player.addEventListener('pointerdown', (event) => beginPotentialDrag(event, player));
      player.addEventListener('pointermove', moveDrag);
      player.addEventListener('pointerup', finishDrag);
      player.addEventListener('pointercancel', finishDrag);
      player.addEventListener('click', (event) => {
        if (!suppressNextClick) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
    }
  }

  function initControls() {
    readStorage();
    getPlayers().forEach(bindPlayerControls);
    syncDocumentState();
    syncPlayerClasses();

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

    window.addEventListener('resize', () => {
      // Never leave a side dock in an unusable narrow viewport.
      if (window.matchMedia('(max-width: 700px)').matches && (dock === 'left' || dock === 'right')) {
        setDock(DEFAULT_DOCK, { persist: false });
      } else {
        syncDocumentState();
        syncPlayerClasses();
      }
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
    getCurrentPlayer: currentPlayer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initControls, { once: true });
  } else {
    initControls();
  }
})();
