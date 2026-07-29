
(() => {
  'use strict';

  let activeProvider = null;

  function setActiveProvider(provider) {
    activeProvider = provider;

    const spotifyMini = document.getElementById('spotify-mini-player');
    const youtubeMini = document.getElementById('youtube-mini-player');

    if (spotifyMini) spotifyMini.hidden = provider !== 'spotify';
    if (youtubeMini) youtubeMini.hidden = provider !== 'youtube';

    document.documentElement.dataset.musicProvider = provider || '';
    window.dispatchEvent(new CustomEvent('bozo:music-provider', {
      detail: { provider }
    }));
  }

  function getActiveProvider() {
    return activeProvider;
  }

  window.BozoMusic = {
    setActiveProvider,
    getActiveProvider
  };
})();
