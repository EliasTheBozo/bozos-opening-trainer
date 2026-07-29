(() => {
  'use strict';

  const PLAYLIST_ID = 'PLBhpxtzTWwzA';
  const YOUTUBE_API_KEY = 'AIzaSyCrcksqDtkOC8k4VYvgL73A_eRpJdEFqfA';
  const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
  const SEARCH_COOLDOWN_MS = 1200;
  let lastSearchAt = 0;
  const $ = id => document.getElementById(id);

  function escapeHtml(value='') {
    return String(value)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function decodeEntities(value='') {
    const el = document.createElement('textarea');
    el.innerHTML = value;
    return el.value;
  }

  let player = null;
  let apiPromise = null;
  let playerPromise = null;
  let progressTimer = null;
  let ready = false;

  function message(text='', error=false) {
    const el = $('youtube-player-message');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', error);
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds || 0)));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function paintProgress() {
    if (!player || !ready) return;
    const current = Number(player.getCurrentTime?.() || 0);
    const duration = Number(player.getDuration?.() || 0);
    $('youtube-progress-current').textContent = formatTime(current);
    $('youtube-progress-duration').textContent = formatTime(duration);
    $('youtube-progress-fill').style.width =
      `${duration ? Math.min(100, current / duration * 100) : 0}%`;

    const data = player.getVideoData?.() || {};
    if (data.title) $('youtube-track-name').textContent = data.title;
    if (data.author) $('youtube-track-artist').textContent = data.author;
  }

  function startProgress() {
    clearInterval(progressTimer);
    paintProgress();
    progressTimer = setInterval(paintProgress, 500);
  }

  function stopProgress() {
    clearInterval(progressTimer);
    progressTimer = null;
    paintProgress();
  }

  function showMini(show=true) {
    const mini = $('youtube-mini-player');
    if (show) {
      window.BozoMusic?.setActiveProvider?.('youtube');
      if (mini) mini.hidden = false;
    } else if (mini) {
      mini.hidden = true;
    }
  }


  function searchStatus(text='', error=false) {
    const el = $('youtube-search-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', error);
  }

  function renderSearchResults(items=[]) {
    const container = $('youtube-search-results');
    if (!container) return;
    if (!items.length) {
      container.innerHTML = '<div class="youtube-empty-results">No embeddable videos found.</div>';
      return;
    }

    container.innerHTML = items.map(item => {
      const videoId = item?.id?.videoId || '';
      const snippet = item?.snippet || {};
      const title = decodeEntities(snippet.title || 'Untitled video');
      const channel = decodeEntities(snippet.channelTitle || 'YouTube');
      const thumb = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';

      return `
        <button type="button" class="youtube-result-card"
          data-youtube-video-id="${escapeHtml(videoId)}"
          data-youtube-title="${escapeHtml(title)}"
          data-youtube-channel="${escapeHtml(channel)}">
          <img src="${escapeHtml(thumb)}" alt="" loading="lazy">
          <span class="youtube-result-copy">
            <b>${escapeHtml(title)}</b>
            <small>${escapeHtml(channel)}</small>
          </span>
          <span class="youtube-result-play">▶</span>
        </button>
      `;
    }).join('');
  }

  async function searchYouTube() {
    const input = $('youtube-search-input');
    const button = $('youtube-search-button');
    const query = String(input?.value || '').trim();

    if (!query) {
      searchStatus('Enter a song, artist, or video.', true);
      input?.focus();
      return;
    }

    const now = Date.now();
    if (now - lastSearchAt < SEARCH_COOLDOWN_MS) {
      searchStatus('Please wait a moment before searching again.', true);
      return;
    }
    lastSearchAt = now;

    try {
      button.disabled = true;
      searchStatus('Searching YouTube…');
      $('youtube-search-results').innerHTML = '';

      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q: query,
        maxResults: '8',
        videoEmbeddable: 'true',
        safeSearch: 'moderate',
        key: YOUTUBE_API_KEY
      });

      const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || `YouTube search failed (${response.status}).`);
      }

      const items = Array.isArray(data.items) ? data.items : [];
      renderSearchResults(items);
      searchStatus(items.length ? `${items.length} results` : 'No results found.');
    } catch (error) {
      console.error('YouTube search:', error);
      searchStatus(error.message || 'YouTube search failed.', true);
      renderSearchResults([]);
    } finally {
      button.disabled = false;
    }
  }

  async function playSearchResult(videoId, title='YouTube video', channel='YouTube') {
    if (!videoId) return;
    try {
      const instance = await ensurePlayer();
      window.BozoSpotify?.pause?.();
      $('youtube-track-name').textContent = title;
      $('youtube-track-artist').textContent = channel;
      instance.loadVideoById(videoId);
      showMini(true);
      message(`Playing ${title}.`);
    } catch (error) {
      message(error.message, true);
    }
  }

  function loadApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previous?.(); } catch (_) {}
        resolve();
      };

      let script = document.querySelector('script[data-bozo-youtube-api]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.bozoYoutubeApi = 'true';
        script.onerror = () => reject(new Error('YouTube player could not load.'));
        document.head.appendChild(script);
      }

      setTimeout(() => {
        if (window.YT?.Player) resolve();
      }, 100);
      setTimeout(() => reject(new Error('YouTube player timed out while loading.')), 20000);
    });

    return apiPromise;
  }

  async function ensurePlayer() {
    if (player && ready) return player;
    if (playerPromise) return playerPromise;

    playerPromise = (async () => {
      await loadApi();

      $('youtube-player-shell').hidden = false;

      player = new YT.Player('youtube-player', {
        width: '100%',
        height: '240',
        playerVars: {
          listType: 'playlist',
          list: PLAYLIST_ID,
          autoplay: 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          origin: location.origin
        },
        events: {
          onReady(event) {
            ready = true;
            const saved = Number(localStorage.getItem('bozo_youtube_volume') || 55);
            event.target.setVolume(saved);
            message('YouTube is ready.');
            paintProgress();
          },
          onStateChange(event) {
            const state = event.data;
            if (state === YT.PlayerState.PLAYING) {
              window.BozoMusic?.setActiveProvider?.('youtube');
              $('youtube-play-pause').textContent = '⏸';
              showMini(true);
              startProgress();
              message('Playing BOZO’s Picks on YouTube.');
            } else if (state === YT.PlayerState.PAUSED) {
              $('youtube-play-pause').textContent = '▶';
              stopProgress();
            } else if (state === YT.PlayerState.ENDED) {
              $('youtube-play-pause').textContent = '▶';
              stopProgress();
            }
          },
          onError(event) {
            const messages = {
              2: 'The YouTube playlist request was invalid.',
              5: 'This video cannot play in the HTML5 player.',
              100: 'A video in the playlist is unavailable.',
              101: 'A video owner disabled website playback.',
              150: 'A video owner disabled website playback.'
            };
            message(messages[event.data] || `YouTube playback error ${event.data}.`, true);
          }
        }
      });

      return await new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (ready) {
            clearInterval(timer);
            resolve(player);
          } else if (Date.now() - started > 15000) {
            clearInterval(timer);
            reject(new Error('YouTube player was created but did not become ready.'));
          }
        }, 100);
      });
    })().catch(error => {
      playerPromise = null;
      message(error.message, true);
      throw error;
    });

    return playerPromise;
  }

  async function play() {
    try {
      const instance = await ensurePlayer();
      await window.BozoSpotify?.pause?.();
      window.BozoMusic?.setActiveProvider?.('youtube');

      instance.loadPlaylist({
        list: PLAYLIST_ID,
        listType: 'playlist',
        index: 0,
        startSeconds: 0,
        suggestedQuality: 'default'
      });

      $('youtube-track-name').textContent = "BOZO's Picks";
      $('youtube-track-artist').textContent = 'YouTube';
      showMini(true);
      message("Playing BOZO's Picks on YouTube.");
    } catch (error) {
      message(error.message, true);
    }
  }

  function pause() {
    try { player?.pauseVideo?.(); } catch (_) {}
  }

  async function toggle() {
    try {
      const instance = await ensurePlayer();
      const state = instance.getPlayerState();
      if (state === YT.PlayerState.PLAYING) instance.pauseVideo();
      else instance.playVideo();
    } catch (error) {
      message(error.message, true);
    }
  }

  function openPanel() {
    const panel = $('spotify-panel');
    if (panel) panel.hidden = false;
    $('youtube-music-section')?.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  $('youtube-search-button')?.addEventListener('click', searchYouTube);
  $('youtube-search-input')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchYouTube();
    }
  });
  $('youtube-search-results')?.addEventListener('click', event => {
    const card = event.target.closest('[data-youtube-video-id]');
    if (!card) return;
    playSearchResult(
      card.dataset.youtubeVideoId,
      card.dataset.youtubeTitle,
      card.dataset.youtubeChannel
    );
  });

  $('youtube-featured-playlist')?.addEventListener('click', play);
  $('youtube-mini-open')?.addEventListener('click', openPanel);
  $('youtube-play-pause')?.addEventListener('click', toggle);
  $('youtube-previous')?.addEventListener('click', () => player?.previousVideo?.());
  $('youtube-next')?.addEventListener('click', () => player?.nextVideo?.());
  $('youtube-volume')?.addEventListener('input', event => {
    const value = Number(event.target.value);
    localStorage.setItem('bozo_youtube_volume', String(value));
    player?.setVolume?.(value);
  });

  window.BozoYouTube = {
    play,
    pause,
    toggle,
    search: searchYouTube,
    open: openPanel,
    playFeatured: play,
    stop: () => {
      try { player?.stopVideo?.(); } catch (_) {}
    },
    getState: () => {
      try { return player?.getPlayerState?.(); } catch (_) { return null; }
    }
  };
})();