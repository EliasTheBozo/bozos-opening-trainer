(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const CLIENT_ID='4813bf77b1bb48c18242c9930d08920f';
  const FEATURED='6DGTxN9oUY96uHz0xWXNTj';
  const API='https://api.spotify.com/v1';
  const TOKEN='https://accounts.spotify.com/api/token';
  const SCOPES='streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
  let player=null, deviceId='', currentState=null, progressTimer=null, initPromise=null;

  const redirectUri=()=>location.hostname==='127.0.0.1'?`${location.protocol}//${location.host}${location.pathname}`:'https://bozos-opening-trainer.eliasdakid06.workers.dev';
  const tokens=()=>{try{return JSON.parse(localStorage.getItem('bozo_spotify_tokens')||'null')}catch{return null}};
  const save=t=>localStorage.setItem('bozo_spotify_tokens',JSON.stringify(t));
  const clear=()=>['bozo_spotify_tokens','bozo_spotify_verifier','bozo_spotify_state'].forEach(k=>localStorage.removeItem(k));
  const connected=()=>Boolean(tokens()?.access_token);
  const random=(n=64)=>{const a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~',v=crypto.getRandomValues(new Uint8Array(n));return Array.from(v,x=>a[x%a.length]).join('')};
  const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const sha=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  const msg=(m,e=false)=>{const el=$('spotify-player-message');if(el){el.textContent=m||'';el.classList.toggle('error',e)}};

  async function login(){const verifier=random(96),state=random(32),challenge=b64(await sha(verifier));localStorage.setItem('bozo_spotify_verifier',verifier);localStorage.setItem('bozo_spotify_state',state);const u=new URL('https://accounts.spotify.com/authorize');u.search=new URLSearchParams({client_id:CLIENT_ID,response_type:'code',redirect_uri:redirectUri(),scope:SCOPES,code_challenge_method:'S256',code_challenge:challenge,state}).toString();location.assign(u)}
  async function exchange(code){const verifier=localStorage.getItem('bozo_spotify_verifier');if(!verifier)throw Error('Spotify login expired. Connect again.');const r=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:'authorization_code',code,redirect_uri:redirectUri(),code_verifier:verifier})});const d=await r.json();if(!r.ok)throw Error(d.error_description||d.error||'Spotify login failed.');save({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Date.now()+(d.expires_in||3600)*1000,scope:d.scope});localStorage.removeItem('bozo_spotify_verifier');localStorage.removeItem('bozo_spotify_state')}
  async function refresh(){const t=tokens();if(!t?.refresh_token)throw Error('Reconnect Spotify.');const r=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:'refresh_token',refresh_token:t.refresh_token})});const d=await r.json();if(!r.ok){clear();throw Error(d.error_description||'Spotify session expired.')}const n={...t,access_token:d.access_token,refresh_token:d.refresh_token||t.refresh_token,expires_at:Date.now()+(d.expires_in||3600)*1000};save(n);return n.access_token}
  async function access(){const t=tokens();if(!t?.access_token)throw Error('Connect Spotify first.');return Date.now()<(t.expires_at||0)-60000?t.access_token:refresh()}
  async function api(path,opt={},retry=true){const r=await fetch(API+path,{...opt,headers:{Authorization:`Bearer ${await access()}`,'Content-Type':'application/json',...(opt.headers||{})}});if(r.status===401&&retry){await refresh();return api(path,opt,false)}if(r.status===204)return null;const d=await r.json().catch(()=>null);if(!r.ok)throw Error(d?.error?.message||`Spotify request failed (${r.status}).`);return d}
  async function callback(){const p=new URLSearchParams(location.search),code=p.get('code'),error=p.get('error');if(!code&&!error)return;if(error)throw Error(`Spotify authorization failed: ${error}`);if(p.get('state')!==localStorage.getItem('bozo_spotify_state'))throw Error('Spotify login state did not match.');await exchange(code);history.replaceState({},document.title,location.pathname+location.hash)}

  async function waitSdk(){
    if(window.Spotify?.Player) return;
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=()=>{if(settled)return;settled=true;resolve()};
      window.onSpotifyWebPlaybackSDKReady=finish;

      let script=document.querySelector('script[data-bozo-spotify-sdk]');
      if(!script){
        script=document.createElement('script');
        script.src='https://sdk.scdn.co/spotify-player.js';
        script.async=true;
        script.dataset.bozoSpotifySdk='true';
        script.onerror=()=>{if(!settled){settled=true;reject(Error('Spotify SDK did not load.'))}};
        document.head.appendChild(script);
      }

      if(window.Spotify?.Player) finish();
      setTimeout(()=>{if(!settled){settled=true;reject(Error('Spotify SDK did not load.'))}},20000);
    });
  }
  async function initPlayer(){if(!connected())return;if(initPromise)return initPromise;initPromise=(async()=>{await waitSdk();if(player)return player;player=new Spotify.Player({name:'BOZO Music',getOAuthToken:cb=>access().then(cb).catch(e=>msg(e.message,true)),volume:Number(localStorage.getItem('bozo_spotify_volume')||55)/100,enableMediaSession:true});player.addListener('ready',({device_id})=>{deviceId=device_id;msg('BOZO Music is ready.')});player.addListener('not_ready',()=>msg('Spotify player went offline.',true));player.addListener('account_error',({message})=>msg(`${message} Premium is required for browser playback.`,true));player.addListener('authentication_error',({message})=>{msg(message,true);clear()});player.addListener('initialization_error',({message})=>msg(message,true));player.addListener('playback_error',({message})=>msg(message,true));player.addListener('player_state_changed',s=>{if(s){currentState=s;paintState(s)}});if(!await player.connect())throw Error('Spotify player could not connect.');return player})().catch(e=>{initPromise=null;throw e});return initPromise}
  function paintConnection(){
    const c=connected();
    const disconnected=$('spotify-disconnected-view');
    const connectedView=$('spotify-connected-view');
    const mini=$('spotify-mini-player');
    const button=$('spotify-music-button');
    if(disconnected) disconnected.hidden=c;
    if(connectedView) connectedView.hidden=!c;
    if(mini) mini.hidden=!c;
    if(button) button.classList.toggle('connected',c);
  }
  function open(){const panel=$('spotify-panel');if(!panel)return;panel.hidden=false;paintConnection();if(connected())initExperience().catch(e=>msg(e.message,true))}
  function close(){const panel=$('spotify-panel');if(panel)panel.hidden=true}
  const image=i=>i?.images?.[0]?.url||i?.album?.images?.[0]?.url||'';
  async function profile(){const d=await api('/me');$('spotify-user-name').textContent=d.display_name||d.email||'Spotify user'}
  async function featured(){const d=await api(`/playlists/${FEATURED}`);$('spotify-featured-name').textContent=d.name;$('spotify-featured-owner').textContent=`Curated by ${d.owner?.display_name||'Elias'}`;const im=image(d),el=$('spotify-featured-image');el.hidden=!im;if(im)el.src=im;$('spotify-featured-playlist').dataset.spotifyUri=d.uri}
  async function playlists(){const t=$('spotify-user-playlists');t.innerHTML='<div class="spotify-loading">Loading playlists…</div>';const d=await api('/me/playlists?limit=24'),items=d.items||[];t.innerHTML=items.length?items.map(x=>`<button class="spotify-playlist-card" data-spotify-uri="${esc(x.uri)}">${image(x)?`<img src="${esc(image(x))}" alt="">`:'<div class="spotify-image-placeholder">♪</div>'}<div><b>${esc(x.name)}</b><span>${Number(x.tracks?.total||0)} tracks</span></div></button>`).join(''):'<div class="spotify-loading">No playlists found.</div>';t.querySelectorAll('[data-spotify-uri]').forEach(b=>b.onclick=()=>playContext(b.dataset.spotifyUri))}
  async function initExperience(){await initPlayer();await Promise.allSettled([profile(),featured(),playlists()])}
  async function search(){const q=$('spotify-search-input').value.trim();if(!q)return;const t=$('spotify-search-results'),b=$('spotify-search-button');b.disabled=true;t.innerHTML='<div class="spotify-loading">Searching…</div>';try{const p=new URLSearchParams({q,type:'track,artist,album,playlist',limit:'5'}),d=await api(`/search?${p}`),items=[...(d.tracks?.items||[]),...(d.artists?.items||[]),...(d.albums?.items||[]),...(d.playlists?.items||[]).filter(Boolean)];t.innerHTML=items.length?items.map(x=>`<button class="spotify-search-result" data-uri="${esc(x.uri)}" data-type="${esc(x.type)}">${image(x)?`<img src="${esc(image(x))}" alt="">`:'<div class="spotify-image-placeholder">♪</div>'}<div><b>${esc(x.name)}</b><span>${esc(x.artists?.map(a=>a.name).join(', ')||x.owner?.display_name||x.type)}</span></div><strong>▶</strong></button>`).join(''):'<div class="spotify-loading">No results.</div>';t.querySelectorAll('[data-uri]').forEach(x=>x.onclick=()=>x.dataset.type==='track'?playTrack(x.dataset.uri):playContext(x.dataset.uri))}catch(e){t.innerHTML=`<div class="spotify-loading">${esc(e.message)}</div>`}finally{b.disabled=false}}
  async function ensureDevice(){await initPlayer();if(!deviceId)await new Promise(r=>setTimeout(r,800));if(!deviceId)throw Error('Spotify player is not ready yet.');await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[deviceId],play:false})})}
  async function playContext(uri){try{msg('Starting playlist…');await ensureDevice();await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`,{method:'PUT',body:JSON.stringify({context_uri:uri})});localStorage.setItem('bozo_spotify_last_context',uri);msg('')}catch(e){msg(e.message,true)}}
  async function playTrack(uri){try{msg('Starting track…');await ensureDevice();await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`,{method:'PUT',body:JSON.stringify({uris:[uri]})});localStorage.setItem('bozo_spotify_last_context',uri);msg('')}catch(e){msg(e.message,true)}}
  const time=ms=>{const s=Math.max(0,Math.floor((ms||0)/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
  function progress(pos,dur){$('spotify-progress-current').textContent=time(pos);$('spotify-progress-duration').textContent=time(dur);$('spotify-progress-fill').style.width=`${dur?Math.min(100,pos/dur*100):0}%`}
  function paintState(s){const tr=s.track_window?.current_track,im=tr?.album?.images?.[0]?.url||'';$('spotify-track-name').textContent=tr?.name||'Nothing playing';$('spotify-track-artist').textContent=tr?.artists?.map(a=>a.name).join(', ')||'Spotify';const el=$('spotify-track-image');el.hidden=!im;if(im)el.src=im;$('spotify-play-pause').textContent=s.paused?'▶':'⏸';progress(s.position,s.duration);clearInterval(progressTimer);if(!s.paused){const start=Date.now(),initial=s.position;progressTimer=setInterval(()=>progress(Math.min(s.duration,initial+Date.now()-start),s.duration),500)}}
  async function disconnect(){try{await player?.disconnect()}catch{}player=null;deviceId='';initPromise=null;clearInterval(progressTimer);clear();paintConnection();close();window.toast?.('Spotify disconnected')}

  $('spotify-music-button')?.addEventListener('click',open);$('spotify-panel-close')?.addEventListener('click',close);$('spotify-connect-button')?.addEventListener('click',login);$('spotify-disconnect-button')?.addEventListener('click',disconnect);$('spotify-search-button')?.addEventListener('click',search);$('spotify-search-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')search()});$('spotify-refresh-playlists')?.addEventListener('click',playlists);$('spotify-featured-playlist')?.addEventListener('click',e=>playContext(e.currentTarget.dataset.spotifyUri));$('spotify-mini-open')?.addEventListener('click',open);$('spotify-play-pause')?.addEventListener('click',()=>player?.togglePlay());$('spotify-previous')?.addEventListener('click',()=>player?.previousTrack());$('spotify-next')?.addEventListener('click',()=>player?.nextTrack());$('spotify-volume')?.addEventListener('input',e=>{localStorage.setItem('bozo_spotify_volume',e.target.value);player?.setVolume(Number(e.target.value)/100)});
  function startSpotify(){
    callback()
      .catch(e=>{console.error(e);window.toast?.(e.message)})
      .finally(()=>{
        paintConnection();
        if(connected()) initPlayer().catch(e=>console.warn(e));
      });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startSpotify,{once:true});
  else startSpotify();
})();
