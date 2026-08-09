
const SUPABASE_URL = 'https://iollrrbpjsmvxozkpxeh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TSiatPuLjWMSx27rnsJTBw_Wxtc_F3y';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
window.BozoSupabase = sb;

const state = {
  session: null,
  profile: null,
  role: 'member',
  progress: null
};

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.hidden = true, 3200);
}

function readableError(error) {
  if (!error) return 'Something went wrong.';
  return error.message || error.error_description || error.msg || String(error);
}

function roleLabel(role) {
  return {
    owner: 'Creator',
    administrator: 'Administrator',
    senior_moderator: 'Administrator',
    moderator: 'Moderator',
    reviewer: 'Reviewer',
    member: 'Member'
  }[role] || role;
}

function route(name) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  $$('[data-route]').forEach(b => b.classList.toggle('active', b.dataset.route === name));
  $('mobile-nav').hidden = true;
  history.replaceState(null, '', `#${name}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'library') searchOpenings('');
  if (name === 'train') prepareTrainPage();
  if (name === 'dashboard') renderDashboard();
  if (name === 'challenges') renderChallenges();
  if (name === 'friends') renderFriends();
  if (name === 'review') prepareReviewPage();
  if (name === 'studies') renderStudies();
  if (name === 'profile') renderProfile();
  if (name === 'owner') renderOwnerGate();
}

$$('[data-route]').forEach(el => el.addEventListener('click', () => route(el.dataset.route)));
$('mobile-menu-button').addEventListener('click', () => $('mobile-nav').hidden = !$('mobile-nav').hidden);

function openAuth(tab = 'signin') {
  $('auth-modal').hidden = false;
  setAuthTab(tab);
}
function closeAuth() { $('auth-modal').hidden = true; }
$('close-auth-modal').addEventListener('click', closeAuth);
$('auth-modal').addEventListener('click', e => { if (e.target.id === 'auth-modal') closeAuth(); });
$$('.open-auth').forEach(b => b.addEventListener('click', () => openAuth()));
$('header-auth-button').addEventListener('click', () => state.session ? route('profile') : openAuth());
$('hero-start-button').addEventListener('click', () => state.session ? route('dashboard') : openAuth('signup'));

function setAuthTab(tab) {
  const signin = tab === 'signin';
  $('auth-signin-tab').classList.toggle('active', signin);
  $('auth-signup-tab').classList.toggle('active', !signin);
  $('signin-form').hidden = !signin;
  $('signup-form').hidden = signin;
  setAuthMessage('');
}
$('auth-signin-tab').addEventListener('click', () => setAuthTab('signin'));
$('auth-signup-tab').addEventListener('click', () => setAuthTab('signup'));

function setAuthMessage(message, error = false) {
  const el = $('auth-message');
  el.textContent = message;
  el.classList.toggle('error', error);
}

$('signin-form').addEventListener('submit', async e => {
  e.preventDefault();
  setAuthMessage('Signing in…');
  const { error } = await sb.auth.signInWithPassword({
    email: $('signin-email').value.trim(),
    password: $('signin-password').value
  });
  if (error) return setAuthMessage(readableError(error), true);
  closeAuth();
  toast('Signed in');
  route('dashboard');
});

$('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('signup-username').value.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  if (username.length < 3) return setAuthMessage('Username must be at least 3 characters.', true);

  setAuthMessage('Creating account…');
  const { data, error } = await sb.auth.signUp({
    email: $('signup-email').value.trim(),
    password: $('signup-password').value,
    options: {
      emailRedirectTo: window.location.origin,
      data: { ign: $('signup-ign').value.trim(), username }
    }
  });
  if (error) return setAuthMessage(readableError(error), true);
  if (!data.session) {
    setAuthMessage('Account created. Check your email and confirm it, then sign in.');
    setAuthTab('signin');
    $('signin-email').value = $('signup-email').value.trim();
  } else {
    closeAuth();
    route('dashboard');
  }
});

$('forgot-password-button').addEventListener('click', async () => {
  const email = $('signin-email').value.trim();
  if (!email) return setAuthMessage('Enter your email first.', true);
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  setAuthMessage(error ? readableError(error) : 'Password-reset email sent.', Boolean(error));
});

async function loadIdentity() {
  if (!state.session?.user) {
    state.profile = null; state.role = 'member'; state.progress = null;
    await window.BozoMastery?.setAuth?.(sb, null);
    renderShell(); return;
  }

  const uid = state.session.user.id;
  const [profileRes, roleRes, progressRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('user_roles').select('role').eq('user_id', uid).maybeSingle(),
    sb.from('user_progress').select('*').eq('user_id', uid).maybeSingle()
  ]);

  if (profileRes.error) console.warn(profileRes.error);
  if (roleRes.error) console.warn(roleRes.error);
  if (progressRes.error) console.warn(progressRes.error);

  state.profile = profileRes.data;
  state.role = roleRes.data?.role || 'member';
  state.progress = progressRes.data;
  await window.BozoMastery?.setAuth?.(sb, state.session.user);
  renderShell();
  await loadAnnouncement();
}

function renderShell() {
  const signedIn = Boolean(state.session?.user);
  $('cloud-state').textContent = signedIn ? '● cloud connected' : '● cloud ready';
  $('header-auth-button').textContent = signedIn ? (state.profile?.ign || 'Profile') : 'Sign in';
  $('owner-nav').hidden = state.role !== 'owner';
  $('owner-mobile-nav').hidden = state.role !== 'owner';
  $('dashboard-owner-shortcut').hidden = state.role !== 'owner';

  const mastery = masteryStats();
  $('home-mastery-preview').textContent = mastery.total.toLocaleString();

  renderDashboard();
  renderProfile();
  renderChallenges();
  renderFriends();
}

function masteryStats() {
  const openingMastery = state.progress?.settings?.openingMastery || {};
  const records = Object.values(openingMastery);
  return {
    records,
    mastered: records.filter(r => r.masteryAwarded).length,
    total: records.reduce((sum, r) => sum + Number(r.masteryPoints || (r.masteryAwarded ? 500 : 0)), 0)
  };
}


function activityLabel(item = {}) {
  const payload = item.payload || {};
  const labels = {
    opening_studied: ['♟️', `Studied ${payload.opening || 'an opening'}`],
    game_reviewed: ['🔎', `Reviewed ${payload.opening || 'a game'}`],
    profile_updated: ['👤', 'Updated profile'],
    friend_added: ['👥', `Became friends with ${payload.username ? '@' + payload.username : 'a player'}`],
    suggestion_submitted: ['💡', `Suggested an improvement${payload.opening ? ` to ${payload.opening}` : ''}`],
    challenge_completed: ['⚔️', `Completed a challenge${payload.opening ? ` in ${payload.opening}` : ''}`]
  };
  return labels[item.activity_type] || ['•', String(item.activity_type || 'BOZO activity').replaceAll('_', ' ')];
}

function relativeActivityTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function activityMarkup(rows = [], emptyCopy = 'No activity yet. Start studying to build your timeline.') {
  if (!rows.length) return `<div class="empty-state mini"><b>Nothing here yet</b><span>${escapeHtml(emptyCopy)}</span></div>`;
  return rows.map(item => {
    const [icon, label] = activityLabel(item);
    return `<article class="activity-row"><span class="activity-icon">${icon}</span><div><b>${escapeHtml(label)}</b><small>${escapeHtml(relativeActivityTime(item.created_at))}</small></div></article>`;
  }).join('');
}

async function logActivity(activityType, payload = {}) {
  if (!state.session?.user) return;
  const { error } = await sb.from('user_activity').insert({
    user_id: state.session.user.id,
    activity_type: activityType,
    payload
  });
  if (error && !/relation .* does not exist|permission denied/i.test(error.message || '')) console.warn('Activity log failed:', error);
}

async function loadDashboardConnectedData() {
  if (!state.session?.user) return;
  const uid = state.session.user.id;
  const [{ data: activity, error: activityError }, { data: studies, error: studiesError }] = await Promise.all([
    sb.from('user_activity').select('activity_type,payload,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(8),
    sb.from('user_activity').select('activity_type,payload,created_at').eq('user_id', uid).eq('activity_type', 'opening_studied').order('created_at', { ascending: false }).limit(1)
  ]);

  const feed = $('dashboard-activity-feed');
  if (feed) feed.innerHTML = activityError
    ? `<div class="empty-state mini"><b>Activity setup needed</b><span>Run the BOZO 2.7 Supabase migration.</span></div>`
    : activityMarkup(activity || []);

  const latestStudy = !studiesError && studies?.[0];
  const focus = $('dashboard-focus-card');
  if (focus) {
    if (latestStudy?.payload?.opening_id) {
      focus.innerHTML = `<span class="eyebrow">CONTINUE STUDYING</span><h3>${escapeHtml(latestStudy.payload.opening || 'Opening')}</h3><p>Pick up where your recent study session left off.</p><button class="button primary" data-focus-opening="${escapeHtml(String(latestStudy.payload.opening_id))}">Continue</button>`;
      focus.querySelector('[data-focus-opening]')?.addEventListener('click', e => openStudyById(e.currentTarget.dataset.focusOpening));
    } else {
      focus.innerHTML = `<span class="eyebrow">BUILD YOUR REPERTOIRE</span><h3>Choose your next opening</h3><p>Browse published theory and begin a study session.</p><button class="button primary" data-route="library">Browse openings</button>`;
      focus.querySelector('[data-route]')?.addEventListener('click', () => route('library'));
    }
  }

  const mastery = masteryStats();
  const types = new Set((activity || []).map(item => item.activity_type));
  const achievements = [
    ['First Study', 'Study your first opening', types.has('opening_studied')],
    ['Game Detective', 'Complete a game review', types.has('game_reviewed')],
    ['Profile Ready', 'Customize your BOZO identity', Boolean(state.profile?.bio || state.profile?.favorite_white_opening)],
    ['Opening Specialist', 'Master your first opening', mastery.mastered > 0],
    ['On a Roll', 'Reach a 7-day streak', Number(state.progress?.current_streak || 0) >= 7],
    ['Community Voice', 'Submit an opening improvement', types.has('suggestion_submitted')]
  ];
  const achievementTarget = $('dashboard-achievements');
  if (achievementTarget) achievementTarget.innerHTML = achievements.map(([name, description, unlocked]) => `<article class="achievement-card ${unlocked ? 'unlocked' : ''}"><span>${unlocked ? '🏅' : '🔒'}</span><div><b>${escapeHtml(name)}</b><small>${escapeHtml(description)}</small></div></article>`).join('');
}

function renderDashboard() {
  const signedIn = Boolean(state.session?.user);
  $('dashboard-guest').hidden = signedIn;
  $('dashboard-user').hidden = !signedIn;
  if (!signedIn) return;

  const mastery = masteryStats();
  $('dashboard-greeting').textContent = `Welcome back, ${state.profile?.ign || 'Player'}.`;
  $('dashboard-xp').textContent = Number(state.progress?.xp || 0).toLocaleString();
  $('dashboard-mastery').textContent = mastery.total.toLocaleString();
  $('dashboard-mastered').textContent = mastery.mastered.toLocaleString();
  $('dashboard-streak').textContent = Number(state.progress?.current_streak || 0).toLocaleString();

  const room = $('web-trophy-room');
  const records = mastery.records
    .filter(r => Array.isArray(r.stars) && r.stars.some(Boolean))
    .sort((a,b) => Number(b.masteryAwarded)-Number(a.masteryAwarded) || b.stars.filter(Boolean).length-a.stars.filter(Boolean).length);

  loadDashboardConnectedData();

  room.innerHTML = records.length ? records.slice(0, 12).map(r => `
    <div class="trophy-row">
      <div><b>${escapeHtml(r.name || 'Opening')}</b><small>${r.masteryAwarded ? 'Mastered · +500' : `${r.stars.filter(Boolean).length}/5 stars`}</small></div>
      <div class="trophy-stars">${r.stars.map(on => on ? '★' : '☆').join('')}</div>
    </div>
  `).join('') : `<div class="empty-state"><div>🏆</div><b>No trophies yet</b><span>Train an opening in the Android app to begin your shared Trophy Room.</span></div>`;
}

$('dashboard-sync-button').addEventListener('click', async () => {
  await loadIdentity();
  await window.BozoMastery?.syncNow?.();
  toast('Cloud data refreshed');
});


const PROFILE_AVATAR_BUCKET = 'avatars';
const PROFILE_AVATAR_FALLBACK = './assets/bozo-mascot.webp';
let repertoireOpeningNames = [];
let repertoireOptionsLoaded = false;
let repertoireOptionsPromise = null;
let repertoireOptionsError = '';

function openingPickerForInput(inputId) {
  return document.querySelector(`.opening-picker[data-opening-picker="${inputId}"]`);
}

function setOpeningPickerValue(inputId, value = '') {
  const input = $(inputId);
  const picker = openingPickerForInput(inputId);
  if (!input || !picker) return;
  const normalized = value || '';
  input.value = normalized;
  const label = picker.querySelector('.opening-picker-value');
  if (label) label.textContent = normalized || 'Not selected';
}

function closeOpeningPicker(picker) {
  if (!picker) return;
  const menu = picker.querySelector('.opening-picker-menu');
  const trigger = picker.querySelector('.opening-picker-trigger');
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  picker.classList.remove('open');
}

function closeAllOpeningPickers(except = null) {
  document.querySelectorAll('.opening-picker.open').forEach(picker => {
    if (picker !== except) closeOpeningPicker(picker);
  });
}

function renderOpeningPickerResults(picker, query = '') {
  const results = picker?.querySelector('.opening-picker-results');
  if (!results) return;

  if (!repertoireOptionsLoaded && !repertoireOptionsError) {
    results.innerHTML = '<div class="opening-picker-empty">Loading published openings…</div>';
    return;
  }

  if (repertoireOptionsError && !repertoireOpeningNames.length) {
    results.innerHTML = `<div class="opening-picker-empty">Could not load openings.<br><button type="button" class="opening-picker-retry">Try again</button></div>`;
    return;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const matches = repertoireOpeningNames
    .filter(name => !normalizedQuery || name.toLowerCase().includes(normalizedQuery))
    .slice(0, 150);

  if (!matches.length && normalizedQuery) {
    results.innerHTML = '<div class="opening-picker-empty">No matching openings found.</div>';
    return;
  }

  const choices = [''].concat(matches);
  results.innerHTML = choices.map(name => {
    const label = name || 'Not selected';
    return `<button type="button" class="opening-picker-option" role="option" data-opening-value="${escapeHtml(name)}">${escapeHtml(label)}</button>`;
  }).join('');
}

function initializeOpeningPickers() {
  document.querySelectorAll('.opening-picker').forEach(picker => {
    if (picker.dataset.ready === 'true') return;
    picker.dataset.ready = 'true';
    const inputId = picker.dataset.openingPicker;
    const trigger = picker.querySelector('.opening-picker-trigger');
    const menu = picker.querySelector('.opening-picker-menu');
    const search = picker.querySelector('.opening-picker-search');
    const results = picker.querySelector('.opening-picker-results');

    trigger?.addEventListener('click', async () => {
      const willOpen = menu.hidden;
      closeAllOpeningPickers(picker);
      menu.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
      picker.classList.toggle('open', willOpen);
      if (willOpen) {
        search.value = '';
        renderOpeningPickerResults(picker);
        requestAnimationFrame(() => search.focus());
        if (!repertoireOptionsLoaded) {
          await loadRepertoireOpeningOptions();
          if (picker.classList.contains('open')) renderOpeningPickerResults(picker, search.value);
        }
      }
    });

    search?.addEventListener('input', () => renderOpeningPickerResults(picker, search.value));
    search?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeOpeningPicker(picker);
        trigger?.focus();
      }
    });

    results?.addEventListener('click', async event => {
      const retry = event.target.closest('.opening-picker-retry');
      if (retry) {
        repertoireOptionsLoaded = false;
        repertoireOptionsError = '';
        renderOpeningPickerResults(picker, search.value);
        await loadRepertoireOpeningOptions(true);
        renderOpeningPickerResults(picker, search.value);
        return;
      }
      const option = event.target.closest('.opening-picker-option');
      if (!option) return;
      setOpeningPickerValue(inputId, option.dataset.openingValue || '');
      closeOpeningPicker(picker);
      trigger?.focus();
    });
  });
}

document.addEventListener('click', event => {
  if (!event.target.closest('.opening-picker')) closeAllOpeningPickers();
});

async function loadRepertoireOpeningOptions(force = false) {
  initializeOpeningPickers();
  if (repertoireOptionsLoaded && !force) return repertoireOpeningNames;
  if (repertoireOptionsPromise && !force) return repertoireOptionsPromise;

  const pickers = [...document.querySelectorAll('.opening-picker')];
  pickers.forEach(picker => {
    picker.classList.add('loading');
    renderOpeningPickerResults(picker);
  });
  repertoireOptionsError = '';

  repertoireOptionsPromise = (async () => {
    // Use the same published-opening shape as the public Opening Library.
    // Fetch in pages so projects with more than Supabase's row cap still work.
    const rows = [];
    const pageSize = 1000;
    for (let from = 0; from < 10000; from += pageSize) {
      const { data, error } = await sb.from('openings')
        .select('id,name,status')
        .eq('status', 'published')
        .order('name', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    repertoireOpeningNames = [...new Set(rows
      .map(row => familyBaseName(String(row.name || '').trim()))
      .filter(name => name && name !== 'Unnamed Opening'))]
      .sort((a, b) => a.localeCompare(b));

    repertoireOptionsLoaded = true;
    return repertoireOpeningNames;
  })().catch(error => {
    repertoireOptionsError = readableError(error);
    repertoireOptionsLoaded = false;
    console.warn('Could not load repertoire opening choices:', error);
    return [];
  }).finally(() => {
    repertoireOptionsPromise = null;
    pickers.forEach(picker => {
      picker.classList.remove('loading');
      renderOpeningPickerResults(picker, picker.querySelector('.opening-picker-search')?.value || '');
    });
  });

  return repertoireOptionsPromise;
}

let pendingAvatarBlob = null;
let pendingAvatarObjectUrl = null;

function setAvatarStatus(message, isError = false) {
  const element = $('profile-avatar-status');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function clearPendingAvatar() {
  pendingAvatarBlob = null;
  if (pendingAvatarObjectUrl) URL.revokeObjectURL(pendingAvatarObjectUrl);
  pendingAvatarObjectUrl = null;
  if ($('profile-avatar-input')) $('profile-avatar-input').value = '';
  if ($('profile-avatar-upload')) $('profile-avatar-upload').disabled = true;
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened.'));
    };
    image.src = url;
  });
}

async function createSquareAvatar(file) {
  if (!file) throw new Error('Choose an image first.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Use a JPG, PNG, or WebP image.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Profile pictures must be smaller than 8 MB.');
  }

  const image = await loadImageFile(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.floor((image.naturalWidth - side) / 2);
  const sourceY = Math.floor((image.naturalHeight - side) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const context = canvas.getContext('2d');
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 512, 512);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('The image could not be prepared.')),
      'image/webp',
      0.88
    );
  });
}

function avatarPublicUrl(path) {
  return sb.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function selectAvatarFile(file) {
  try {
    setAvatarStatus('Preparing image…');
    pendingAvatarBlob = await createSquareAvatar(file);
    if (pendingAvatarObjectUrl) URL.revokeObjectURL(pendingAvatarObjectUrl);
    pendingAvatarObjectUrl = URL.createObjectURL(pendingAvatarBlob);
    $('profile-avatar-preview').src = pendingAvatarObjectUrl;
    $('profile-avatar-upload').disabled = false;
    setAvatarStatus('Ready to upload. Your image will appear as a square.');
  } catch (error) {
    clearPendingAvatar();
    setAvatarStatus(error.message || 'Could not prepare that image.', true);
  }
}

async function uploadProfileAvatar() {
  if (!state.session?.user || !pendingAvatarBlob) return;
  const button = $('profile-avatar-upload');
  button.disabled = true;
  button.textContent = 'Uploading…';
  setAvatarStatus('Uploading securely to your BOZO account…');

  try {
    const userId = state.session.user.id;
    const path = `${userId}/avatar.webp`;
    const { error: uploadError } = await sb.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(path, pendingAvatarBlob, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const publicUrl = `${avatarPublicUrl(path)}?v=${Date.now()}`;
    const { error: profileError } = await sb
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (profileError) throw profileError;

    clearPendingAvatar();
    await loadIdentity();
    setAvatarStatus('Profile picture updated.');
    toast('Profile picture updated');
  } catch (error) {
    console.error('Profile picture upload failed:', error);
    button.disabled = false;
    setAvatarStatus(readableError(error), true);
  } finally {
    button.textContent = 'Upload picture';
  }
}

async function removeProfileAvatar() {
  if (!state.session?.user) return;
  if (!confirm('Replace your profile picture with the BOZO mascot?')) return;

  const userId = state.session.user.id;
  setAvatarStatus('Removing profile picture…');

  const { error: profileError } = await sb
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);

  if (profileError) {
    setAvatarStatus(readableError(profileError), true);
    return;
  }

  const { error: storageError } = await sb.storage
    .from(PROFILE_AVATAR_BUCKET)
    .remove([`${userId}/avatar.webp`]);

  if (storageError) console.warn('Old avatar file could not be removed:', storageError);

  clearPendingAvatar();
  await loadIdentity();
  setAvatarStatus('Using the BOZO mascot.');
  toast('Profile picture removed');
}

$('profile-avatar-edit')?.addEventListener('click', () => $('profile-avatar-input')?.click());
$('profile-avatar-choose')?.addEventListener('click', () => $('profile-avatar-input')?.click());
$('profile-avatar-input')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) selectAvatarFile(file);
});
$('profile-avatar-upload')?.addEventListener('click', uploadProfileAvatar);
$('profile-avatar-remove')?.addEventListener('click', removeProfileAvatar);


function renderProfile() {
  const signedIn = Boolean(state.session?.user);
  $('profile-guest').hidden = signedIn;
  $('profile-user').hidden = !signedIn;
  if (!signedIn) return;

  const p = state.profile || {};
  const avatarUrl = p.avatar_url || PROFILE_AVATAR_FALLBACK;
  $('profile-avatar').src = avatarUrl;
  $('profile-avatar').onerror = () => { $('profile-avatar').src = PROFILE_AVATAR_FALLBACK; };
  if (!pendingAvatarBlob) $('profile-avatar-preview').src = avatarUrl;
  $('profile-avatar-preview').onerror = () => { $('profile-avatar-preview').src = PROFILE_AVATAR_FALLBACK; };
  $('profile-avatar-remove').disabled = !p.avatar_url;
  if (!pendingAvatarBlob) setAvatarStatus(p.avatar_url ? 'Current profile picture is saved to your account.' : 'Using the BOZO mascot.');
  $('profile-ign').textContent = p.ign || 'Player';
  $('profile-username').textContent = '@' + (p.username || 'username');
  $('profile-role-badge').textContent = roleLabel(state.role);
  $('profile-role-badge').classList.toggle('owner', state.role === 'owner');
  $('profile-ign-input').value = p.ign || '';
  $('profile-username-input').value = p.username || '';
  $('profile-bio-input').value = p.bio || '';
  $('profile-personality-input').value = p.opening_personality || 'Explorer';
  loadRepertoireOpeningOptions().then(() => {
    setOpeningPickerValue('profile-white-opening-input', p.favorite_white_opening);
    setOpeningPickerValue('profile-black-e4-opening-input', p.favorite_black_e4_opening);
    setOpeningPickerValue('profile-black-d4-opening-input', p.favorite_black_d4_opening);
  });
  $('profile-email').textContent = state.session.user.email || '';
  $('profile-user-id').textContent = state.session.user.id;
  loadMyReports();
}

async function loadMyReports() {
  const list = $('profile-reports-list');
  if (!list || !state.session?.user) return;
  list.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading reports…</b></div>';
  const { data, error } = await sb.from('reports')
    .select('id,report_type,severity,reason,status,created_at,updated_at')
    .eq('reporter_id', state.session.user.id)
    .order('created_at', { ascending:false })
    .limit(25);
  if (error) {
    list.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load reports</b><span>${escapeHtml(readableError(error))}</span></div>`;
    return;
  }
  list.innerHTML = (data || []).map(report => `<article class="profile-report-row">
    <div><b>${escapeHtml((report.report_type || 'issue').replaceAll('_',' '))}</b><p>${escapeHtml(report.reason || '')}</p><small>${new Date(report.created_at).toLocaleString()}</small></div>
    <span class="report-status report-status-${escapeHtml(report.status || 'open')}">${escapeHtml(reportStatusLabel(report.status))}</span>
  </article>`).join('') || '<div class="empty-state"><div>✓</div><b>No reports submitted</b><span>Issues you report will appear here.</span></div>';
}
$('profile-reports-refresh')?.addEventListener('click', loadMyReports);

$('profile-save-button').addEventListener('click', async () => {
  const username = $('profile-username-input').value.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  if (username.length < 3) return toast('Username must be at least 3 characters.');

  const { error } = await sb.from('profiles').update({
    ign: $('profile-ign-input').value.trim(),
    username,
    bio: $('profile-bio-input').value.trim(),
    opening_personality: $('profile-personality-input').value,
    favorite_white_opening: $('profile-white-opening-input').value || null,
    favorite_black_e4_opening: $('profile-black-e4-opening-input').value || null,
    favorite_black_d4_opening: $('profile-black-d4-opening-input').value || null
  }).eq('id', state.session.user.id);

  if (error) return toast(readableError(error));
  await logActivity('profile_updated', {});
  await loadIdentity();
  toast('Profile saved');
});

$('sign-out-button').addEventListener('click', async () => {
  await sb.auth.signOut();
  route('home');
  toast('Signed out');
});

async function loadAnnouncement() {
  if (!state.session) return $('announcement-card').hidden = true;
  const { data, error } = await sb.from('announcements')
    .select('id,title,body,created_at').eq('is_active', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  if (error || !data) return $('announcement-card').hidden = true;
  const dismissalKey = `bozo-dismissed-announcement:${data.id || data.created_at || data.title}`;
  if (localStorage.getItem(dismissalKey) === '1') {
    $('announcement-card').hidden = true;
    return;
  }
  $('announcement-title').textContent = data.title;
  $('announcement-body').textContent = data.body;
  $('announcement-card').dataset.dismissalKey = dismissalKey;
  $('announcement-card').hidden = false;
}

$('announcement-dismiss')?.addEventListener('click', () => {
  const card = $('announcement-card');
  if (card?.dataset.dismissalKey) localStorage.setItem(card.dataset.dismissalKey, '1');
  if (card) card.hidden = true;
});

const OPENING_DISCOVERY_TAGS = new Set(['white','black','positional','tactical','aggressive','gambit','system']);
const openingBrowserFilters = new Set();
let openingLibraryRows = [];

$('opening-search-button').addEventListener('click', () => searchOpenings($('opening-search-input').value));
$('opening-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchOpenings(e.target.value); });
$('opening-search-input').addEventListener('input', () => {
  if (!$('opening-search-input').value.trim() && openingLibraryRows.length) renderOpeningBrowserRows(openingLibraryRows, '');
});

document.querySelectorAll('[data-opening-filter]').forEach(button => {
  button.addEventListener('click', () => {
    const tag = button.dataset.openingFilter;
    if (openingBrowserFilters.has(tag)) openingBrowserFilters.delete(tag);
    else openingBrowserFilters.add(tag);
    syncOpeningFilterChips();
    searchOpenings($('opening-search-input').value);
  });
});

$('opening-filter-clear')?.addEventListener('click', () => {
  openingBrowserFilters.clear();
  $('opening-search-input').value = '';
  syncOpeningFilterChips();
  searchOpenings('');
});

function syncOpeningFilterChips() {
  document.querySelectorAll('[data-opening-filter]').forEach(button => {
    button.classList.toggle('active', openingBrowserFilters.has(button.dataset.openingFilter));
  });
}

function parseOpeningDiscoveryQuery(query = '') {
  const words = String(query).trim().split(/\s+/).filter(Boolean);
  const textWords = [];
  const tags = new Set(openingBrowserFilters);
  words.forEach(word => {
    const normalized = word.toLowerCase().replace(/[^a-z-]/g, '');
    if (OPENING_DISCOVERY_TAGS.has(normalized)) tags.add(normalized);
    else textWords.push(word);
  });
  return { text: textWords.join(' ').trim(), tags };
}

function openingMoveSans(pgn = '') {
  return String(pgn)
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+\.(?:\.\.)?/g, ' ')
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, ' ')
    .trim().split(/\s+/).filter(Boolean);
}

function explicitOpeningSide(opening = {}) {
  const definition = typeof matchingBozoOpeningDefinition === 'function' ? matchingBozoOpeningDefinition(opening) : null;
  const raw = definition?.repertoire_side
    || opening?.metadata?.repertoire_side
    || opening?.metadata?.repertoireSide
    || opening?.metadata?.side
    || '';
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'white' || normalized === 'w') return 'white';
  if (normalized === 'black' || normalized === 'b') return 'black';
  return '';
}

function inferOpeningSide(opening = {}) {
  const explicit = explicitOpeningSide(opening);
  if (explicit) return explicit;
  const text = `${opening.name || ''} ${opening.variation || ''}`.toLowerCase();
  if (/defen[sc]e|countergambit|sicilian|caro-kann|french|scandinavian|pirc|alekhine|petrov|philidor|gr[uü]nfeld|benoni|dutch/.test(text)) return 'black';
  if (/opening|attack|system|gambit|game|london|catalan|english|bird|polish|r[ée]ti|vienna|italian|spanish/.test(text)) return 'white';
  return 'neutral';
}

function openingDiscoveryTags(opening = {}) {
  const tags = new Set();
  const side = inferOpeningSide(opening);
  if (side !== 'neutral') tags.add(side);
  const text = `${opening.name || ''} ${opening.variation || ''} ${opening.notes || ''}`.toLowerCase();

  if (/gambit|countergambit/.test(text)) tags.add('gambit');
  if (/attack|gambit|countergambit|gro[b]?|wing|dragon|najdorf|fried liver|smith-morra|evans|marshall|four pawns/.test(text)) tags.add('aggressive');
  if (/gambit|countergambit|trap|sacrifice|sharp|attack|fried liver|smith-morra|evans|marshall/.test(text)) tags.add('tactical');
  if (/system|closed|declined|slav|caro-kann|london|catalan|queen'?s indian|nimzo|r[ée]ti|english|stonewall|colle|hedgehog|petrov/.test(text)) tags.add('positional');
  if (/system|london|colle|stonewall|hippopotamus/.test(text)) tags.add('system');
  if (!tags.has('tactical') && !tags.has('aggressive')) tags.add('positional');
  return tags;
}

function openingMatchesDiscovery(opening, tags) {
  if (!tags?.size) return true;
  const openingTags = openingDiscoveryTags(opening);
  return [...tags].every(tag => openingTags.has(tag));
}

function renderOpeningBrowserRows(rows, query = '') {
  const target = $('opening-results');
  const parsed = parseOpeningDiscoveryQuery(query);
  const filtered = rows.filter(opening => openingMatchesDiscovery(opening, parsed.tags));
  const summary = $('opening-filter-summary');
  if (summary) {
    const active = [...parsed.tags];
    summary.textContent = active.length
      ? `${filtered.length.toLocaleString()} matching lines · ${active.map(tag => tag[0].toUpperCase() + tag.slice(1)).join(' + ')}`
      : `${filtered.length.toLocaleString()} published lines available.`;
  }

  if (!filtered.length) {
    target.innerHTML = `<div class="empty-state"><div>♟</div><b>No openings match those filters</b><span>Try removing a style, switching sides, or searching a broader name.</span></div>`;
    return;
  }

  const families = groupOpeningFamilies(filtered);
  target.innerHTML = families.map(renderOpeningFamily).join('');
  window.BozoMastery?.refreshAll?.();

  target.querySelectorAll('[data-family-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const familyId = button.dataset.familyToggle;
      const body = document.querySelector(`[data-family-body="${familyId}"]`);
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      body.hidden = expanded;
      button.querySelector('.family-toggle-label').textContent =
        expanded ? `Browse variations (${body.dataset.count})` : 'Hide variations';
      button.querySelector('.family-chevron').textContent = expanded ? '⌄' : '⌃';
    });
  });
}

async function searchOpenings(query) {
  const target = $('opening-results');
  target.innerHTML = '<div class="empty-state"><div>⌛</div><b>Searching theory…</b></div>';
  const parsed = parseOpeningDiscoveryQuery(query);

  let req = sb.from('openings').select('id,eco,name,variation,pgn,source_type,notes,metadata').eq('status','published').limit(10000);
  if (parsed.text) req = req.or(`name.ilike.%${parsed.text}%,variation.ilike.%${parsed.text}%,eco.ilike.%${parsed.text}%`);
  const { data, error } = await req.order('name');

  if (error) {
    target.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load the cloud library</b><span>${escapeHtml(readableError(error))}</span></div>`;
    return;
  }

  if (!data?.length) {
    target.innerHTML = `<div class="empty-state"><div>📚</div><b>No published cloud openings found</b><span>Try another opening name or clear the filters.</span></div>`;
    return;
  }

  openingLibraryRows = data;
  renderOpeningBrowserRows(data, query);
}

function familyBaseName(name = '') {
  const colon = name.indexOf(':');
  return (colon === -1 ? name : name.slice(0, colon)).trim() || 'Unnamed Opening';
}

function variationLabel(opening) {
  if (opening.variation?.trim()) return opening.variation.trim();
  const base = familyBaseName(opening.name);
  if (opening.name.startsWith(base + ':')) {
    return opening.name.slice(base.length + 1).trim();
  }
  return opening.name === base ? 'Main Line' : opening.name;
}

function moveCount(pgn = '') {
  return (pgn.match(/\d+\./g) || []).length;
}

function groupOpeningFamilies(openings) {
  const map = new Map();

  for (const opening of openings) {
    const base = familyBaseName(opening.name);
    const key = base.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        id: `family-${key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        name: base,
        ecos: new Set(),
        sourceTypes: new Set(),
        lines: []
      });
    }

    const family = map.get(key);
    if (opening.eco) family.ecos.add(opening.eco);
    if (opening.source_type) family.sourceTypes.add(opening.source_type);
    family.lines.push({
      ...opening,
      displayVariation: variationLabel(opening),
      moveCount: moveCount(opening.pgn)
    });
  }

  return Array.from(map.values())
    .map(family => {
      family.lines.sort((a, b) => {
        const aMain = a.displayVariation === 'Main Line' ? 0 : 1;
        const bMain = b.displayVariation === 'Main Line' ? 0 : 1;
        return aMain - bMain ||
          a.moveCount - b.moveCount ||
          a.displayVariation.localeCompare(b.displayVariation);
      });

      const richest = [...family.lines].sort((a, b) =>
        b.moveCount - a.moveCount ||
        (b.pgn?.length || 0) - (a.pgn?.length || 0)
      )[0];

      return {
        ...family,
        ecos: Array.from(family.ecos).sort(),
        sourceTypes: Array.from(family.sourceTypes),
        preview: richest
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatPreviewMoves(pgn = '', fullMoves = 4) {
  const safe = escapeHtml(pgn);
  const tokens = safe.trim().split(/\s+/);
  const rows = [];
  let current = '';

  for (const token of tokens) {
    if (/^\d+\.$/.test(token)) {
      if (current) rows.push(current.trim());
      current = token;
    } else {
      current += ` ${token}`;
    }
    if (rows.length >= fullMoves) break;
  }

  if (current && rows.length < fullMoves) rows.push(current.trim());
  return rows.slice(0, fullMoves).join('<br>');
}

function openChallengeForOpening(name) {
  route('challenges');
  setTimeout(() => {
    openNewGameSetup('friend');
    $('duel-opening-search').value = name;
    searchDuelOpenings();
  }, 80);
}

function openBotForOpening(name) {
  route('challenges');
  setTimeout(() => {
    openNewGameSetup('bot');
    $('duel-opening-search').value = name;
    searchDuelOpenings();
  }, 80);
}

function openStudyById(openingId) {
  openStudyOpening(openingId);
}

function openingTagMarkup(opening) {
  const tags = [...openingDiscoveryTags(opening)].filter(tag => ['white','black','positional','tactical','aggressive','gambit','system'].includes(tag));
  return tags.slice(0, 4).map(tag => `<span class="opening-style-tag ${tag}">${escapeHtml(tag)}</span>`).join('');
}

function responseButtonLabel(opening) {
  const side = inferOpeningSide(opening);
  if (side === 'white') return 'Common Black responses';
  if (side === 'black') return 'Common White responses';
  return 'Common responses';
}

function renderOpeningFamily(family) {
  const lineCount = family.lines.length;
  const single = lineCount === 1;
  const visibleEcos = family.ecos.slice(0, 4).join(', ');
  const extraEcos = family.ecos.length > 4 ? ` +${family.ecos.length - 4}` : '';
  const officialCount = family.lines.filter(line => line.source_type === 'official').length;
  const bozoCount = family.lines.filter(line => line.source_type === 'bozo').length;
  const preview = family.preview;
  const challengeName = `${preview.name}${preview.variation ? ': ' + preview.variation : ''}`;

  return `
    <article class="opening-family-card ${single ? 'single-line-family' : ''}">
      <div class="family-card-header">
        <div>
          <span class="family-meta">
            ${escapeHtml(visibleEcos || 'ECO —')}${extraEcos}
            · ${single ? 'OPENING LINE' : 'OPENING FAMILY'}
          </span>
          <h3>${escapeHtml(family.name)}</h3>
          <div class="opening-style-tags">${openingTagMarkup(preview)}</div>
          <p>
            ${single ? '1 published line' : `${lineCount.toLocaleString()} variations`}
            ${officialCount ? ` · ${officialCount} official` : ''}
            ${bozoCount ? ` · ${bozoCount} BOZO` : ''}
          </p>
        </div>
        ${single ? '' : `<span class="family-count">${lineCount}</span>`}
      </div>

      <div class="opening-mastery-inline" data-mastery-opening="${preview.id}" data-mastery-name="${escapeHtml(challengeName)}">
        ${window.BozoMastery ? window.BozoMastery.cardMarkup(preview.id) : ''}
      </div>

      <div class="family-preview">
        <span>${escapeHtml(preview.displayVariation)}</span>
        <code>${formatPreviewMoves(preview.pgn || '', 4)}</code>
      </div>

      ${single ? `
        <div class="single-line-actions four-actions">
          <button class="study-button" onclick="openStudyById('${preview.id}')">Study</button>
          <button class="train-opening-button" onclick="startTrainingOpening('${preview.id}')">Train</button>
          <button class="opening-puzzle-button" onclick="startOpeningPuzzles('${preview.id}')">Puzzle</button>
          <button class="response-repertoire-button" onclick="openResponseRepertoire('${preview.id}')">${responseButtonLabel(preview)}</button>
          <button class="family-bot-button"
                  onclick="openBotForOpening('${escapeHtml(challengeName).replace(/'/g, "\\'")}')">
            Play bot
          </button>
          <button class="family-practice-button"
                  onclick="openChallengeForOpening('${escapeHtml(challengeName).replace(/'/g, "\\'")}')">
            Challenge
          </button>
        </div>
        ${communityOpeningActions(preview)}
      ` : `
        <div class="family-action-row five-actions">
          <button class="study-button" onclick="openStudyById('${preview.id}')">Study preview</button>
          <button class="response-repertoire-button" onclick="openResponseRepertoire('${preview.id}')">${responseButtonLabel(preview)}</button>
          <button class="family-bot-button"
                  onclick="openBotForOpening('${escapeHtml(family.name).replace(/'/g, "\\'")}')">
            Play bot
          </button>
          <button class="family-practice-button"
                  onclick="openChallengeForOpening('${escapeHtml(family.name).replace(/'/g, "\\'")}')">
            Challenge
          </button>
          <button class="family-toggle"
                  data-family-toggle="${family.id}"
                  aria-expanded="false">
            <span class="family-toggle-label">Browse variations (${lineCount})</span>
            <span class="family-chevron">⌄</span>
          </button>
        </div>
        ${communityOpeningActions(preview, `Suggest a ${escapeHtml(family.name)} improvement`)}

        <div class="family-lines"
             data-family-body="${family.id}"
             data-count="${lineCount}"
             hidden>
          ${family.lines.map((line, index) => {
            const lineChallengeName = `${line.name}${line.variation ? ': ' + line.variation : ''}`;
            return `
              <div class="family-line-row">
                <div class="line-index">${index + 1}</div>
                <div class="line-content">
                  <div class="line-heading">
                    <b>${escapeHtml(line.displayVariation)}</b>
                    <span>${escapeHtml(line.eco || 'ECO —')} · ${escapeHtml(line.source_type || 'official')}</span>
                  </div>
                  <div class="line-mastery-inline" data-mastery-opening="${line.id}" data-mastery-name="${escapeHtml(lineChallengeName)}">
                    ${window.BozoMastery ? window.BozoMastery.compactMarkup(line.id) : ''}
                  </div>
                  <code>${escapeHtml(line.pgn || '')}</code>
                  ${line.notes ? `<p>${escapeHtml(line.notes)}</p>` : ''}
                  <div class="line-action-row four-line-actions">
                    <button class="line-study-button" onclick="openStudyById('${line.id}')">Study</button>
                    <button class="line-train-button" onclick="startTrainingOpening('${line.id}')">Train</button>
                    <button class="line-puzzle-button" onclick="startOpeningPuzzles('${line.id}')">Puzzle</button>
                    <button class="line-response-button" onclick="openResponseRepertoire('${line.id}')">Responses</button>
                    <button class="line-bot-button"
                            onclick="openBotForOpening('${escapeHtml(lineChallengeName).replace(/'/g, "\\'")}')">
                      Bot
                    </button>
                    <button class="line-challenge-button"
                            onclick="openChallengeForOpening('${escapeHtml(lineChallengeName).replace(/'/g, "\\'")}')">
                      Challenge
                    </button>
                  </div>
                  ${communityOpeningActions(line)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </article>
  `;
}


function oppositeRepertoireSide(side = '') {
  return String(side).toLowerCase() === 'black' ? 'White' : 'Black';
}

function sameMovePrefix(a, b, count) {
  if (a.length < count || b.length < count) return false;
  for (let i = 0; i < count; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function openResponseRepertoire(openingId) {
  const modal = $('response-repertoire-modal');
  const root = $('response-repertoire-root');
  const title = $('response-repertoire-title');
  const copy = $('response-repertoire-copy');
  if (!modal || !root) return;

  modal.hidden = false;
  root.innerHTML = '<div class="response-loading">Finding common replies…</div>';

  let selected = openingLibraryRows.find(row => String(row.id) === String(openingId));
  if (!selected) {
    const { data, error } = await sb.from('openings')
      .select('id,eco,name,variation,pgn,source_type,notes,metadata')
      .eq('id', openingId).maybeSingle();
    if (error || !data) {
      root.innerHTML = `<div class="response-empty">Could not load this opening.<br>${escapeHtml(readableError(error || new Error('Opening not found')))}</div>`;
      return;
    }
    selected = data;
  }

  const ownerSide = inferOpeningSide(selected);
  const effectiveOwnerSide = ownerSide === 'neutral' ? 'white' : ownerSide;
  const trainingSide = oppositeRepertoireSide(effectiveOwnerSide);
  const selectedMoves = openingMoveSans(selected.pgn);
  const prefixCount = effectiveOwnerSide === 'black' ? 2 : 1;
  const responseIndex = prefixCount;
  const prefix = selectedMoves.slice(0, prefixCount);

  title.textContent = `Common responses to ${selected.name}`;
  copy.textContent = `Train as ${trainingSide} against this ${effectiveOwnerSide === 'white' ? 'White' : 'Black'} repertoire. Starting from ${prefix.join(' ') || 'the opening position'}.`;

  const { data: candidates, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn,source_type,notes,metadata')
    .eq('status','published')
    .limit(10000);
  if (error) {
    root.innerHTML = `<div class="response-empty">Could not load common replies.<br>${escapeHtml(readableError(error))}</div>`;
    return;
  }

  const groups = new Map();
  for (const candidate of candidates || []) {
    const moves = openingMoveSans(candidate.pgn);
    if (!sameMovePrefix(selectedMoves, moves, prefixCount)) continue;
    const reply = moves[responseIndex];
    if (!reply) continue;
    if (!groups.has(reply)) groups.set(reply, []);
    groups.get(reply).push({ ...candidate, moves });
  }

  const responses = [...groups.entries()]
    .map(([reply, lines]) => {
      lines.sort((a,b) => b.moves.length - a.moves.length || String(a.name).localeCompare(String(b.name)));
      return { reply, lines, representative: lines[0] };
    })
    .sort((a,b) => b.lines.length - a.lines.length || a.reply.localeCompare(b.reply))
    .slice(0, 12);

  if (!responses.length) {
    root.innerHTML = '<div class="response-empty">No alternate published responses were found from this starting position yet.</div>';
    return;
  }

  root.innerHTML = `
    <div class="response-repertoire-summary">
      <span>${responses.length} common replies</span>
      <span>Training side: <b>${trainingSide}</b></span>
    </div>
    <div class="response-repertoire-list">
      ${responses.map((item, index) => {
        const line = item.representative;
        return `<article class="response-repertoire-card">
          <div class="response-rank">${index + 1}</div>
          <div class="response-card-content">
            <div class="response-card-heading">
              <div><span>COMMON REPLY</span><h3>${escapeHtml(item.reply)}</h3></div>
              <span class="response-line-count">${item.lines.length} line${item.lines.length === 1 ? '' : 's'}</span>
            </div>
            <p>${escapeHtml(line.name)}${line.variation ? ` · ${escapeHtml(line.variation)}` : ''}</p>
            <code>${formatPreviewMoves(line.pgn || '', 4)}</code>
            <div class="response-card-actions">
              <button class="button primary" onclick="openResponseStudy('${line.id}','${trainingSide.toLowerCase()}')">Study as ${trainingSide}</button>
              <button class="button secondary" onclick="openStudyById('${line.id}')">View line</button>
            </div>
          </div>
        </article>`;
      }).join('')}
    </div>`;
}

function closeResponseRepertoire() {
  const modal = $('response-repertoire-modal');
  if (modal) modal.hidden = true;
}

$('close-response-repertoire')?.addEventListener('click', closeResponseRepertoire);
$('response-repertoire-modal')?.addEventListener('click', event => {
  if (event.target === $('response-repertoire-modal')) closeResponseRepertoire();
});

function openResponseStudy(openingId, side) {
  closeResponseRepertoire();
  openStudyOpening(openingId, { repertoireSide: side, orientation: side });
}


function communityOpeningActions(opening, suggestionLabel = 'Suggest an improvement') {
  const name = `${opening.name || 'Opening'}${opening.variation ? `: ${opening.variation}` : ''}`;
  return `<div class="community-action-row">
    <button type="button" class="suggest-opening-button"
      data-opening-id="${escapeHtml(String(opening.id || ''))}"
      data-opening-name="${escapeHtml(name)}"
      data-opening-pgn="${escapeHtml(opening.pgn || '')}">✎ ${suggestionLabel}</button>
    <button type="button" class="report-opening-button"
      data-opening-id="${escapeHtml(String(opening.id || ''))}"
      data-opening-name="${escapeHtml(name)}"
      data-opening-pgn="${escapeHtml(opening.pgn || '')}">⚑ Report issue</button>
  </div>`;
}

const SUGGESTION_TYPES = [
  ['incorrect_move','Incorrect move'],
  ['better_line','Better line or continuation'],
  ['missing_variation','Missing variation'],
  ['explanation','Explanation or plan'],
  ['grammar','Grammar or formatting'],
  ['other','Other improvement']
];
const REPORT_TYPES = [
  ['ai_coach','AI Coach response'],
  ['game_review','Game Review'],
  ['opening_content','Opening information'],
  ['ui_design','UI or design'],
  ['performance','Performance or loading'],
  ['account','Account or cloud sync'],
  ['broken_page','Broken page or feature'],
  ['accessibility','Accessibility problem'],
  ['copyright','Copyright concern'],
  ['spam','Spam or abuse'],
  ['suggestion','Feature suggestion'],
  ['other','Other issue']
];

const REPORT_SCREENSHOT_BUCKET = 'issue-screenshots';

function currentReportContext() {
  const context = {
    page_url: location.href,
    route: location.hash || '#home',
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    reported_at: new Date().toISOString()
  };
  try {
    if (typeof reviewData !== 'undefined' && reviewData?.rows?.length) {
      const row = reviewData.rows[Math.max(0, Math.min(reviewStepIndex || 0, reviewData.rows.length - 1))];
      context.fen = row?.fen || '';
      context.move_number = row?.ply ? Math.ceil(row.ply / 2) : null;
      context.pgn = document.getElementById('review-pgn-input')?.value?.trim() || '';
      context.board_orientation = 'white';
    } else if (typeof studyGame !== 'undefined' && studyGame?.fen) {
      context.fen = studyGame.fen();
      context.pgn = studyGame.pgn?.() || '';
      context.move_number = Math.ceil((studyGame.history?.().length || 0) / 2);
      context.board_orientation = typeof studyOrientation !== 'undefined' ? studyOrientation : 'white';
    }
  } catch (error) {
    console.warn('Could not collect board context:', error);
  }
  return context;
}

async function uploadReportScreenshot(file) {
  if (!file) return null;
  if (!state.session?.user) throw new Error('Sign in before uploading a screenshot.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Screenshot must be 10 MB or smaller.');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Screenshot must be PNG, JPG, or WebP.');
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${state.session.user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await sb.storage.from(REPORT_SCREENSHOT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

function reportStatusLabel(status = '') {
  const labels = { open:'Submitted', under_review:'Under review', resolved:'Fixed', dismissed:'Closed' };
  return labels[status] || status.replaceAll('_',' ');
}


function openCommunityFeedback(mode = 'suggestion', opening = {}) {
  if (!state.session?.user) {
    toast('Sign in to send community feedback.');
    openAuth('signin');
    return;
  }
  const suggestion = mode === 'suggestion';
  $('community-feedback-mode').value = mode;
  $('community-feedback-opening-id').value = opening.id || '';
  $('community-feedback-opening-name').value = opening.name || (suggestion ? 'General opening suggestion' : 'BOZO website');
  $('community-feedback-pgn').value = opening.pgn || '';
  $('community-feedback-details').value = '';
  $('community-feedback-source').value = '';
  $('community-feedback-screenshot').value = '';
  $('community-feedback-severity').value = 'minor';
  $('community-feedback-board-context').checked = true;
  $('community-feedback-severity-label').hidden = suggestion;
  $('community-feedback-screenshot-label').hidden = suggestion;
  $('community-feedback-board-context-label').hidden = suggestion;
  $('community-feedback-auto-context').hidden = suggestion;
  if (!suggestion) {
    const auto = currentReportContext();
    $('community-feedback-auto-context').innerHTML = `<b>Automatically included</b><span>${escapeHtml(auto.route)} · ${escapeHtml(auto.viewport)} · ${auto.fen ? 'board position available' : 'page context only'}</span>`;
  }
  $('community-feedback-title').textContent = suggestion ? 'Suggest an improvement' : 'Report an issue';
  $('community-feedback-eyebrow').textContent = suggestion ? 'COMMUNITY OPENING REVIEW' : 'HELP US FIX IT';
  $('community-feedback-submit').textContent = suggestion ? 'Submit suggestion' : 'Submit report';
  $('community-feedback-pgn-label').hidden = !suggestion;
  $('community-feedback-source-label').hidden = !suggestion;
  $('community-feedback-opening-label').querySelector('span')?.remove();
  const types = suggestion ? SUGGESTION_TYPES : REPORT_TYPES;
  $('community-feedback-type').innerHTML = types.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
  $('community-feedback-details').placeholder = suggestion
    ? 'Explain what should change and why. Include analysis, move orders, or sources when useful.'
    : 'Tell us what happened, what you expected, and how we can reproduce the problem.';
  $('community-feedback-modal').hidden = false;
  setTimeout(() => $('community-feedback-type').focus(), 20);
}

function closeCommunityFeedback() {
  $('community-feedback-modal').hidden = true;
}

$('close-community-feedback').addEventListener('click', closeCommunityFeedback);
$('community-feedback-cancel').addEventListener('click', closeCommunityFeedback);
$('community-feedback-modal').addEventListener('click', event => {
  if (event.target.id === 'community-feedback-modal') closeCommunityFeedback();
});
$('footer-report-issue').addEventListener('click', () => openCommunityFeedback('report'));

document.addEventListener('click', event => {
  const suggestion = event.target.closest('.suggest-opening-button');
  if (suggestion) {
    openCommunityFeedback('suggestion', {
      id: suggestion.dataset.openingId,
      name: suggestion.dataset.openingName,
      pgn: suggestion.dataset.openingPgn
    });
    return;
  }
  const report = event.target.closest('.report-opening-button');
  if (report) {
    openCommunityFeedback('report', {
      id: report.dataset.openingId,
      name: report.dataset.openingName,
      pgn: report.dataset.openingPgn
    });
  }
});

$('community-feedback-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.session?.user) return openAuth('signin');
  const submit = $('community-feedback-submit');
  const mode = $('community-feedback-mode').value;
  const type = $('community-feedback-type').value;
  const openingId = $('community-feedback-opening-id').value || null;
  const openingName = $('community-feedback-opening-name').value.trim();
  const pgn = $('community-feedback-pgn').value.trim();
  const details = $('community-feedback-details').value.trim();
  const source = $('community-feedback-source').value.trim();
  const severity = $('community-feedback-severity').value || 'minor';
  const screenshotFile = $('community-feedback-screenshot').files?.[0] || null;
  if (!details) return toast('Please describe the suggestion or issue.');

  submit.disabled = true;
  submit.textContent = 'Sending…';
  let error;
  if (mode === 'suggestion') {
    const richPayload = {
      submitted_by: state.session.user.id,
      opening_id: openingId,
      proposed_name: openingName,
      proposed_pgn: pgn || null,
      submission_type: type,
      notes: [details, source ? `Source: ${source}` : ''].filter(Boolean).join('\n\n'),
      status: 'pending'
    };
    ({ error } = await sb.from('opening_submissions').insert(richPayload));
    if (error && /column|schema cache/i.test(readableError(error))) {
      ({ error } = await sb.from('opening_submissions').insert({
        proposed_name: openingName,
        submission_type: type,
        status: 'pending'
      }));
    }
  } else {
    let screenshotPath = null;
    try { screenshotPath = await uploadReportScreenshot(screenshotFile); }
    catch (uploadError) {
      submit.disabled = false;
      submit.textContent = 'Submit report';
      return toast(`Could not upload screenshot: ${readableError(uploadError)}`);
    }
    const auto = currentReportContext();
    const includeBoard = $('community-feedback-board-context').checked;
    const context = [openingName ? `Context: ${openingName}` : '', openingId ? `Opening ID: ${openingId}` : '', details].filter(Boolean).join('\n');
    const richPayload = {
      reporter_id: state.session.user.id,
      report_type: type,
      severity,
      target_type: openingId ? 'opening' : 'website',
      target_id: openingId,
      opening_name: openingName || null,
      reason: details,
      details: context,
      page_url: auto.page_url,
      route: auto.route,
      browser_info: auto.user_agent,
      viewport: auto.viewport,
      screenshot_path: screenshotPath,
      fen: includeBoard ? (auto.fen || null) : null,
      pgn: includeBoard ? (auto.pgn || null) : null,
      move_number: includeBoard ? (auto.move_number || null) : null,
      board_orientation: includeBoard ? (auto.board_orientation || null) : null,
      status: 'open'
    };
    ({ error } = await sb.from('reports').insert(richPayload));
    if (error && /column|schema cache/i.test(readableError(error))) {
      ({ error } = await sb.from('reports').insert({ report_type: type, reason: context, status: 'open' }));
    }
  }
  submit.disabled = false;
  submit.textContent = mode === 'suggestion' ? 'Submit suggestion' : 'Submit report';
  if (error) return toast(`Could not send feedback: ${readableError(error)}`);
  closeCommunityFeedback();
  if (mode === 'suggestion') await logActivity('suggestion_submitted', { opening: openingName || '' });
  toast(mode === 'suggestion' ? 'Suggestion sent for review. Thank you!' : 'Report submitted. Thank you!');
});

function renderOwnerGate() {
  const allowed = Boolean(state.session && state.role === 'owner');
  $('owner-denied').hidden = allowed;
  $('owner-content').hidden = !allowed;
}

$$('[data-owner-panel]').forEach(button => {
  button.addEventListener('click', () => loadOwnerPanel(button.dataset.ownerPanel));
});

async function loadOwnerPanel(panel) {
  const target = $('owner-panel');
  target.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading…</b></div>';

  if (panel === 'analytics') {
    const { data, error } = await sb.rpc('owner_platform_analytics');
    if (error) return ownerError(error);
    const s = data || {};
    target.innerHTML = `<div class="panel-heading"><div><span>LIVE DATA</span><h2>Platform analytics</h2></div></div>
      <div class="analytics-grid">
        ${analyticsStat(s.total_users,'Total users')}
        ${analyticsStat(s.confirmed_users,'Confirmed')}
        ${analyticsStat(s.active_7d,'Active in 7 days')}
        ${analyticsStat(s.total_xp,'Total XP')}
        ${analyticsStat(s.total_lines,'Lines drilled')}
        ${analyticsStat(s.total_games,'Games analyzed')}
        ${analyticsStat(s.pending_submissions,'Pending theory')}
        ${analyticsStat(s.open_reports,'Open reports')}
      </div>`;
    return;
  }

  if (panel === 'users') {
    target.innerHTML = `<div class="panel-heading"><div><span>USERS</span><h2>Search accounts</h2></div></div>
      <div class="user-search-form"><input id="owner-user-search" placeholder="Search IGN or username"><button id="owner-user-search-button" class="button primary">Search</button></div>
      <div id="owner-user-results" class="owner-list"></div>`;
    $('owner-user-search-button').addEventListener('click', ownerSearchUsers);
    return;
  }


  if (panel === 'import') {
    target.innerHTML = `
      <div class="panel-heading">
        <div><span>CANONICAL LIBRARY</span><h2>Import openings into Supabase</h2></div>
      </div>
      <div class="import-explainer">
        <p>
          This downloads the five CC0 Lichess opening files in your browser,
          combines them with BOZO custom variations, and safely upserts them
          into <code>public.openings</code> in batches.
        </p>
        <div class="import-summary">
          <span><b>Source</b>Lichess chess-openings + BOZO custom lines</span>
          <span><b>Destination</b>Supabase public.openings</span>
          <span><b>Safety</b>Existing IDs update, progress is preserved</span>
        </div>
        <button id="start-opening-import" class="button primary">
          Import full opening library
        </button>
        <div id="opening-import-status" class="import-status">
          Ready. This may take a few minutes.
        </div>
        <div class="import-progress"><div id="opening-import-progress-bar"></div></div>
      </div>`;
    $('start-opening-import').addEventListener('click', importOpeningLibrary);
    return;
  }

  if (panel === 'announcements') {
    target.innerHTML = `<div class="panel-heading"><div><span>BULLETIN</span><h2>Publish an announcement</h2></div></div>
      <div class="announcement-form">
        <input id="owner-announcement-title" maxlength="60" placeholder="Title">
        <div class="announcement-character-count"><span id="owner-announcement-title-count">0</span>/60</div>
        <textarea id="owner-announcement-body" maxlength="500" placeholder="Message"></textarea>
        <div class="announcement-character-count"><span id="owner-announcement-body-count">0</span>/500</div>
        <label><input id="owner-announcement-pin" type="checkbox" checked> Pin announcement</label>
        <button id="owner-publish-announcement" class="button primary">Publish</button>
      </div>
      <section class="announcement-manager">
        <div class="announcement-manager-head"><div><span class="eyebrow">MANAGE</span><h2>Existing announcements</h2></div><button id="owner-refresh-announcements" class="button secondary">Refresh</button></div>
        <div id="owner-announcement-list" class="announcement-manager-list"><div class="empty-state"><div>⌛</div><b>Loading announcements…</b></div></div>
      </section>`;
    $('owner-publish-announcement').addEventListener('click', publishAnnouncement);
    $('owner-refresh-announcements').addEventListener('click', loadOwnerAnnouncements);
    $('owner-announcement-title').addEventListener('input', e => $('owner-announcement-title-count').textContent = e.target.value.length);
    $('owner-announcement-body').addEventListener('input', e => $('owner-announcement-body-count').textContent = e.target.value.length);
    await loadOwnerAnnouncements();
    return;
  }

  const map = {
    submissions: ['opening_submissions','Opening review'],
    reports: ['reports','Open reports'],
    audit: ['moderation_actions','Audit history']
  };
  const [table, title] = map[panel];
  let request = sb.from(table).select('*').order('created_at',{ascending:false}).limit(50);
  if (panel === 'submissions') request = request.in('status',['pending','changes_requested']);
  if (panel === 'reports') request = request.in('status',['open','under_review','resolved','dismissed']);
  const { data, error } = await request;
  if (error) return ownerError(error);
  let rows = data || [];
  if (panel === 'reports') {
    rows = await Promise.all(rows.map(async item => {
      if (!item.screenshot_path) return item;
      const { data: signed } = await sb.storage.from(REPORT_SCREENSHOT_BUCKET).createSignedUrl(item.screenshot_path, 60 * 60);
      return { ...item, _screenshot_url: signed?.signedUrl || '' };
    }));
  }

  target.innerHTML = `<div class="panel-heading"><div><span>OWNER</span><h2>${title}</h2></div></div>
    <div class="owner-list">${rows.map(item => ownerCaseMarkup(panel, item)).join('') || '<div class="empty-state"><div>✓</div><b>Nothing waiting</b></div>'}</div>`;

  target.querySelectorAll('[data-case-status]').forEach(button => {
    button.addEventListener('click', () => updateCommunityCase(
      button.dataset.caseTable,
      button.dataset.caseId,
      button.dataset.caseStatus,
      panel
    ));
  });
}

function ownerCaseMarkup(panel, item) {
  if (panel === 'audit') {
    return `<div class="owner-list-row"><div><b>${escapeHtml(item.action || 'Action')}</b><small>${escapeHtml(item.reason || item.status || '')}</small></div><small>${new Date(item.created_at).toLocaleString()}</small></div>`;
  }
  const suggestion = panel === 'submissions';
  const heading = suggestion ? (item.proposed_name || 'Opening suggestion') : (item.report_type || 'Issue report');
  const type = suggestion ? item.submission_type : item.report_type;
  const details = item.notes || item.details || item.reason || '';
  const pgn = item.proposed_pgn || '';
  const approve = suggestion ? 'approved' : 'resolved';
  const reject = suggestion ? 'rejected' : 'dismissed';
  const table = suggestion ? 'opening_submissions' : 'reports';
  const screenshotUrl = !suggestion ? (item._screenshot_url || '') : '';
  return `<div class="owner-list-row community-case">
    <div class="community-case-main">
      <b>${escapeHtml(heading)}</b>
      <div class="community-case-meta"><span>${escapeHtml(type || 'other')}</span><span>${escapeHtml(item.status || '')}</span>${!suggestion && item.severity ? `<span>${escapeHtml(item.severity)}</span>` : ''}</div>
      ${details ? `<p>${escapeHtml(details)}</p>` : ''}
      ${!suggestion && item.page_url ? `<div class="report-context-grid"><span><b>Page</b>${escapeHtml(item.page_url)}</span><span><b>Viewport</b>${escapeHtml(item.viewport || '—')}</span><span><b>Opening</b>${escapeHtml(item.opening_name || item.target_id || '—')}</span><span><b>Move</b>${escapeHtml(String(item.move_number || '—'))}</span></div>` : ''}
      ${!suggestion && item.fen ? `<code>FEN: ${escapeHtml(item.fen)}</code>` : ''}
      ${!suggestion && item.pgn ? `<details class="report-pgn"><summary>View attached PGN</summary><code>${escapeHtml(item.pgn)}</code></details>` : ''}
      ${screenshotUrl ? `<a class="report-screenshot-link" href="${escapeHtml(screenshotUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(screenshotUrl)}" alt="Attached issue screenshot"><span>Open full screenshot ↗</span></a>` : ''}
      ${pgn ? `<code>${escapeHtml(pgn)}</code>` : ''}
      <div class="community-case-actions">
        <button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="under_review">Reviewing</button>
        ${suggestion ? '' : `<button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="under_review">Needs info</button>`}
        <button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="${approve}">${suggestion ? 'Approve' : 'Fixed'}</button>
        <button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="${reject}">${suggestion ? 'Reject' : 'Close'}</button>
      </div>
    </div>
    <small>${item.created_at ? new Date(item.created_at).toLocaleString() : ''}</small>
  </div>`;
}

async function updateCommunityCase(table, id, status, panel) {
  if (!id) return toast('This case has no ID.');
  const { error } = await sb.from(table).update({ status }).eq('id', id);
  if (error) return toast(readableError(error));
  toast(`Case marked ${status.replace('_',' ')}.`);
  loadOwnerPanel(panel);
}

function analyticsStat(value,label){return `<div class="analytics-stat"><b>${Number(value||0).toLocaleString()}</b><span>${label}</span></div>`}
function ownerError(error){$('owner-panel').innerHTML=`<div class="empty-state"><div>⚠</div><b>Owner tool failed</b><span>${escapeHtml(readableError(error))}</span></div>`}

async function ownerSearchUsers() {
  const query = $('owner-user-search').value.trim();
  if (!query) return;
  const out = $('owner-user-results');
  out.innerHTML = 'Searching…';
  const { data, error } = await sb.rpc('owner_search_users',{ search_text: query });
  if (error) return out.innerHTML = escapeHtml(readableError(error));
  out.innerHTML = (data || []).map(u => `
    <div class="user-card"><div class="user-card-head"><div><b>${escapeHtml(u.ign)}</b><span>@${escapeHtml(u.username)}</span></div><div class="role-badge ${u.role==='owner'?'owner':''}">${roleLabel(u.role)}</div></div>
    <p>${Number(u.xp||0).toLocaleString()} XP · ${Number(u.opening_mastery||0).toLocaleString()} mastery · ${u.is_suspended?'Suspended':'Active'}</p></div>
  `).join('') || 'No users found.';
}

async function loadOwnerAnnouncements() {
  const list = $('owner-announcement-list');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading announcements…</b></div>';
  const { data, error } = await sb.rpc('owner_list_announcements');
  if (error) {
    list.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load announcements</b><span>${escapeHtml(readableError(error))}</span></div>`;
    return;
  }
  list.innerHTML = (data || []).map(item => `
    <article class="announcement-manager-row" data-announcement-id="${escapeHtml(String(item.id))}">
      <div>
        <h3>${escapeHtml(item.title || 'Untitled')}</h3>
        <p>${escapeHtml(item.body || '')}</p>
        <div class="announcement-manager-meta">
          <span>${item.is_pinned ? '📌 Pinned' : 'Not pinned'}</span>
          <span>${item.is_active ? 'Live' : 'Hidden'}</span>
          <span>${item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
        </div>
      </div>
      <div class="announcement-manager-actions">
        <button class="button secondary" data-announcement-action="edit">Edit</button>
        <button class="button secondary" data-announcement-action="pin">${item.is_pinned ? 'Unpin' : 'Pin'}</button>
        <button class="button secondary" data-announcement-action="active">${item.is_active ? 'Hide' : 'Show'}</button>
        <button class="button secondary" data-announcement-action="delete">Delete</button>
      </div>
    </article>`).join('') || '<div class="empty-state"><div>📣</div><b>No announcements yet</b></div>';

  list.querySelectorAll('[data-announcement-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-announcement-id]');
      const item = (data || []).find(entry => String(entry.id) === row?.dataset.announcementId);
      if (!item) return;
      const action = button.dataset.announcementAction;
      if (action === 'edit') {
        const title = prompt('Announcement title', item.title || '');
        if (title === null) return;
        const body = prompt('Announcement message', item.body || '');
        if (body === null) return;
        if (!title.trim() || !body.trim()) return toast('Title and message are required.');
        const { error } = await sb.rpc('owner_update_announcement', {
          announcement_id: item.id,
          announcement_title: title.trim().slice(0, 60),
          announcement_body: body.trim().slice(0, 500),
          pin_announcement: item.is_pinned,
          activate_announcement: item.is_active
        });
        if (error) return toast(readableError(error));
        toast('Announcement updated.');
      } else if (action === 'delete') {
        if (!confirm(`Delete “${item.title}”?`)) return;
        const { error } = await sb.rpc('owner_delete_announcement', { announcement_id: item.id });
        if (error) return toast(readableError(error));
        toast('Announcement deleted.');
      } else {
        const { error } = await sb.rpc('owner_update_announcement', {
          announcement_id: item.id,
          announcement_title: item.title,
          announcement_body: item.body,
          pin_announcement: action === 'pin' ? !item.is_pinned : item.is_pinned,
          activate_announcement: action === 'active' ? !item.is_active : item.is_active
        });
        if (error) return toast(readableError(error));
        toast(action === 'pin' ? (item.is_pinned ? 'Announcement unpinned.' : 'Announcement pinned.') : (item.is_active ? 'Announcement hidden.' : 'Announcement shown.'));
      }
      await loadOwnerAnnouncements();
      await loadAnnouncement();
    });
  });
}

async function publishAnnouncement() {
  const title = $('owner-announcement-title').value.trim();
  const body = $('owner-announcement-body').value.trim();
  if (!title || !body) return toast('Add a title and message.');
  const { error } = await sb.rpc('publish_announcement',{
    announcement_title:title,
    announcement_body:body,
    pin_announcement:$('owner-announcement-pin').checked
  });
  if (error) return toast(readableError(error));
  toast('Announcement published.');
  $('owner-announcement-title').value = '';
  $('owner-announcement-body').value = '';
  $('owner-announcement-title-count').textContent = '0';
  $('owner-announcement-body-count').textContent = '0';
  await loadOwnerAnnouncements();
  await loadAnnouncement();
}


const OPENING_TSV_URLS = [
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/b.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/c.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/d.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/e.tsv'
];

const BOZO_CLOUD_OPENINGS = [
  {
    eco:'A09',
    name:'Réti Opening: Polish Grob Attack',
    variation:'Bozo Main Line',
    pgn:'1. Nf3 d5 2. b4 Nf6 3. Bb2 g6 4. h3 Bg7 5. g4 Qd6 6. a3 c5 7. g5 Nh5 8. Bxg7 Nxg7 9. bxc5 Qxc5 10. e3 O-O 11. d4 Qc7 12. Nbd2 Be6 13. h4 Nd7 14. Qb1 Bg4 15. Bd3 e5 16. Nxe5 Nxe5 17. dxe5 Qxe5 18. O-O Bh3 19. Re1 f6 20. f4 Qe6 21. Qd1 Bg4 22. Nf3 Qd6 23. gxf6 Qxf6 24. Be2 Rad8 25. Qd4 Qe7 26. Ng5 Bxe2 27. Rxe2 Nf5 28. Qd3 Nxh4 29. Rh2 Rf5 30. Kh1 h6 31. Rg1 hxg5 32. Rxh4 gxh4 33. Rxg6+ Kh7 34. Qxf5 Qe4+ 35. Qxe4 dxe4 36. Re6 Rd2 37. c4 Re2 38. Rxe4',
    source_type:'bozo',
    repertoire_side:'white',
    notes:'A BOZO custom Réti system that develops into a Polish-Grob pawn expansion.',
    author_explanations: {
      "1": "This move develops our knight to control e5 allowing for b4 and bb2 hitting g7 without an easy central pawn expansion from black to block the diagonal which leads to black playing Nf6 where we then go for h3 g4.",
      "2": "This move aims to expand into the center, allowing the queen to come out on the d file and play for e6 or c5.",
      "3": "This move prepares a flank fianchetto for our bishop, which will land on the b2 square next move, given black cannot easily play e5 to cut off the diagonal reaching to g7 where if taken by white’s bishop the black rook on h8 would become undefended.",
      "4": "This move aims to defend the aforementioned diagonal from white’s bishop on b2 while developing a knight towards the center, defending d5 if black plans to bring the queen out.",
      "5": "As stated before, this move looks to apply pressure on the long diagonal, which is currently guarded by black’s knight on f6, our next few moves will look to weaken the knight and force it to move.",
      "6": "This move aims to fianchetto black’s bishop and prepare for a king side castle which would then anchor black’s knight and prevent white from creating doubled pawns (*note - doubled pawns on the kingside aren't always a bad thing depending on where the opponent has castled and how active your rook on that side of the board is, many counterattacks succeed because of doubled pawns that open a file for attack.)",
      "7": "This move aims to anchor a g4 push so that we can then play g5 and kick away the knight, while also creating a luft for our king if we plan to king side castle.",
      "8": "Fianchettos the black bishop and prepares to king side castle.",
      "9": "As previously stated, this move aims to play g5 eventually and kick out the black knight.",
      "10": "This move temporarily disrupts white’s plan of attack as the b4 pawn is now hanging.",
      "11": "This defends our b4 pawn allowing us to play g5 without having to worry about losing a pawn later on. As for why we didn’t play g5 immediately as the threat on black’s knight would be greater than their threat on our pawn, that is just how I prefer to play the opening, if you wish to play g5 and play out that sequence and then a3, more power to you, I just find that defending b4 first is a more flexible option.",
      "12": "Black aims to further threaten the b4 pawn and expand into the center.",
      "13": "This is where the main idea of this opening finally shines, as we kick out the black knight and aim to trade bishops, making the black structure seem a bit incoherent.",
      "14": "This guards black’s bishop, aiming to recapture after white trades.",
      "15": "Trading off black’s strong bishop allows white to not have to worry about repositioning their own bishop later on as black continues to expand into the center.",
      "16": "Recaptures.",
      "17": "Since our queenside expansion has served its purpose, we capture one of blacks central pawns, weakening their control over the board.",
      "18": "Recaptures.",
      "19": "Aims to develop our bishop and eventually castle, this move also opens up our queen.",
      "20": "Black castles, aiming to place a rook on e8 and play for e5 to gain more central control.",
      "21": "This move aims to gain central control and attack black’s queen, while building a potential outpost for our knight to go to e5.",
      "22": "Black retreats the queen and repositions it to target our kingside.",
      "23": "Develops our knight and plans to replace the f3 knight once it goes to e5.",
      "24": "Develops the bishop and prevents us from immediately playing c4 to challenge black’s center.",
      "25": "This move aims to strengthen the g5 pawn and potentially play for h5 in the future to strike at black’s kingside.",
      "26": "Black further completes their development and prepares to play e5 once their bishop relocates to strike at our center.",
      "27": "This move aims to target the open b-file and potentially capture on b7 after black initiates trades in the center, however we would need to castle before acting on this plan so that our rook on a1 isn’t unprotected.",
      "28": "Black relocates their bishop and aims to either play e5 immediately or trade off their bad bishop for our active knight.",
      "29": "We develop our bishop to both target black’s kingside should our plan to play h5 come into fruition and allows us to castle king side after trading off in the center.",
      "30": "Black initiates a sequence of trades in the center to move into the endgame.",
      "31": "Trading sequence.",
      "32": "Trading sequence.",
      "33": "Trading sequence.",
      "34": "Trading sequence.",
      "35": "We king side castle, which may seem a bit unorthodox given we played a pawn storm on this side of the board earlier on, but black has no real way to threaten a checkmate currently as we traded off their dark squared bishop and their knight would take multiple moves to reposition itself in a meaningful way.",
      "36": "Black plays a one move threat on our rook.",
      "37": "Retreats our rook to a safe square while defending e4 so that we can later play f4 and kick away black’s queen.",
      "38": "Black aims to weaken our kingside and infiltrate with the queen after an exchange of pawns.",
      "39": "Kicks away the black queen and further strengthens g5.",
      "40": "Black retreats their queen and aims to infiltrate on g4.",
      "41": "This move prevents black from play Qg4+ without trading off queens.",
      "42": "Black makes a threat onto our queen.",
      "43": "We both activate our knight onto a better square and defend our queen, and while this also may seem a bit counterintuitive as we walk into a pin, but the worst black can really do is just trade off our knight for their bishop, which just kills off their attack.",
      "44": "Black just plays a waiting move as they don’t really have any initiative in the current position.",
      "45": "This move both aims to open up black’s king and allow us to reposition our knight to g5 later on.",
      "46": "Recapturing with the queen creates a battery on the f-file and discourages us from playing e4.",
      "47": "This move breaks the pin on our knight to our queen, giving both pieces freedom of mobility to reposition and attack black’s weakened king side.",
      "48": "Black repositions their inactive rook and aims to potentially play d4 and initiate a trading sequence that could leave our f4 pawn vulnerable.",
      "49": "Stops black from playing d4 and aims to trade queens and reposition our knight upon recapturing.",
      "50": "Black retreats their queen.",
      "51": "We bring our knight into the attack and look to trade off black’s active bishop, allowing us to position our rook on h2 upon recapturing to further coordinate with our attack.",
      "52": "Trading sequence.",
      "53": "Trading sequence, our rook is now more active on the 2nd rank and can reposition to h2 to pressure black’s king.",
      "54": "Black forks our queen and h4 pawn.",
      "55": "We retreat our queen.",
      "56": "Black takes our undefended pawn.",
      "57": "We attack black’s undefended knight.",
      "58": "Black plays a rather tricky move, and if we simply take their hanging knight they sack their rook for our knight, and upon our pawn recapture the take our pawn with their queen, delivering both a check and threat onto our hanging rook on h4 should we just take their hanging knight.",
      "59": "Slide our king out of the way to both avoid black’s trick and allow our rook on a1 to get into the game on g1.",
      "60": "Black attacks our knight.",
      "61": "We play a trick of our own, as the following sequence will not only result in an equal trade, but also result in us having a severe threat on the black king.",
      "62": "This begins the sequence after Rg1.",
      "63": "This continues the sequence after Rg1.",
      "64": "This continues the sequence after Rg1.",
      "65": "This continues the sequence after Rg1.",
      "66": "This continues the sequence after Rg1.",
      "67": "After this sequence black only has 1 move to not lose on the spot.",
      "68": "This is black’s ONLY move here, as any other move would result in a discovered check to win black’s queen.",
      "69": "We trade queens.",
      "70": "We trade queens.",
      "71": "We target black’s weak e4 pawn.",
      "72": "Black attacks our c2 pawn.",
      "73": "We advance our pawn to defend it from black’s rook.",
      "74": "Black attacks our e3 pawn and aims to advance their h pawn down the board.",
      "75": "We capture black’s hanging pawn."
}
  },
  {
    eco:'A00',
    name:"Polish Opening: King's Indian, Polish Grob Attack",
    variation:'Main Line',
    pgn:'1. b4 Nf6 2. Bb2 g6 3. g4 Bg7 4. g5 Nh5 5. Bxg7 Nxg7 6. c4 O-O 7. Qb3',
    source_type:'bozo',
    repertoire_side:'white',
    notes:'A BOZO custom variation combining the Polish setup with a Grob-style g-pawn expansion.'
  },
  {
    eco:'A00',
    name:"Polish Opening: King's Indian, Polish Grob Attack",
    variation:'h5 Counterstrike',
    pgn:'1. b4 Nf6 2. Bb2 g6 3. g4 Bg7 4. g5 Nh5 5. Bxg7 Nxg7 6. c4 h5 7. gxh6 Rxh6 8. Qb3',
    source_type:'bozo',
    repertoire_side:'white',
    notes:'A BOZO custom branch where Black challenges the advanced g-pawn with ...h5.'
  }
];

function parseOpeningTsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split('\t');
  const ecoIndex = header.indexOf('eco');
  const nameIndex = header.indexOf('name');
  const pgnIndex = header.indexOf('pgn');

  return lines.map(line => {
    const cols = line.split('\t');
    return {
      eco: cols[ecoIndex] || null,
      name: cols[nameIndex] || 'Unnamed Opening',
      pgn: cols[pgnIndex] || '',
      source_type: 'official',
      variation: null,
      notes: null
    };
  }).filter(row => row.pgn);
}

function openingId(row) {
  const raw = `${row.eco}|${row.name}|${row.variation || ''}|${row.pgn}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const slug = row.name.toLowerCase()
    .replace(/[’']/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'')
    .slice(0,58);
  return `${row.source_type === 'bozo' ? 'bozo' : 'eco'}-${slug}-${(hash >>> 0).toString(36)}`;
}

async function importOpeningLibrary() {
  if (state.role !== 'owner') return toast('Only the Owner can import the canonical library.');

  const button = $('start-opening-import');
  const status = $('opening-import-status');
  const bar = $('opening-import-progress-bar');
  button.disabled = true;

  try {
    status.textContent = 'Downloading opening data…';
    bar.style.width = '4%';

    const chunks = [];
    for (let i = 0; i < OPENING_TSV_URLS.length; i++) {
      const response = await fetch(OPENING_TSV_URLS[i], { cache:'no-store' });
      if (!response.ok) throw new Error(`Opening source ${response.status}`);
      chunks.push(...parseOpeningTsv(await response.text()));
      bar.style.width = `${8 + ((i + 1) / OPENING_TSV_URLS.length) * 22}%`;
      status.textContent = `Downloaded ECO volume ${i + 1} of ${OPENING_TSV_URLS.length}…`;
    }

    const seen = new Set();
    const rows = [...BOZO_CLOUD_OPENINGS, ...chunks].map(row => ({
      id: openingId(row),
      eco: row.eco,
      name: row.name,
      variation: row.variation,
      pgn: row.pgn,
      source_type: row.source_type,
      status: 'published',
      notes: row.notes,
      metadata: {
        imported_from: row.source_type === 'official'
          ? 'lichess-org/chess-openings'
          : 'bozos-opening-trainer',
        imported_at: new Date().toISOString(),
        author_explanations: row.author_explanations || null,
        repertoire_side: row.repertoire_side || null
      }
    })).filter(row => {
      const key = `${row.name}|${row.variation || ''}|${row.pgn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const batchSize = 150;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const { error } = await sb.rpc('owner_import_openings', { opening_rows: batch });
      if (error) throw error;

      const completed = Math.min(start + batch.length, rows.length);
      const pct = 30 + (completed / rows.length) * 70;
      bar.style.width = `${pct}%`;
      status.textContent = `Imported ${completed.toLocaleString()} of ${rows.length.toLocaleString()} openings…`;
    }

    bar.style.width = '100%';
    status.innerHTML = `<b>Import complete.</b> ${rows.length.toLocaleString()} published openings are now available to both web and Android.`;
    toast('Opening library imported');
  } catch (error) {
    status.innerHTML = `<b>Import stopped:</b> ${escapeHtml(readableError(error))}`;
    toast(readableError(error));
  } finally {
    button.disabled = false;
  }
}



let friendFilter = 'accepted';
let webFriends = [];

function renderFriends() {
  const signedIn = Boolean(state.session?.user);
  $('friends-guest').hidden = signedIn;
  $('friends-user').hidden = !signedIn;
  if (signedIn) loadWebFriends();
}

$$('[data-friend-filter]').forEach(button => {
  button.addEventListener('click', () => {
    friendFilter = button.dataset.friendFilter;
    $$('[data-friend-filter]').forEach(b => b.classList.toggle('active', b === button));
    paintWebFriends();
  });
});

$('add-web-friend-button').addEventListener('click', () => {
  $('add-web-friend-modal').hidden = false;
  $('web-friend-status').textContent = '';
  $('web-friend-username').value = '';
});
$('close-add-web-friend').addEventListener('click', () => $('add-web-friend-modal').hidden = true);
$('send-web-friend-request').addEventListener('click', sendWebFriendRequest);

async function loadWebFriends() {
  const { data, error } = await sb.rpc('my_friends');
  if (error) {
    $('web-friends-list').innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }
  webFriends = data || [];
  paintWebFriends();
}

function filteredWebFriends() {
  if (friendFilter === 'accepted') return webFriends.filter(f => f.status === 'accepted');
  if (friendFilter === 'incoming') return webFriends.filter(f => f.status === 'pending' && f.direction === 'incoming');
  return webFriends.filter(f => f.status === 'pending' && f.direction === 'outgoing');
}

function paintWebFriends() {
  const rows = filteredWebFriends();
  const target = $('web-friends-list');
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state"><div>👥</div><b>No ${friendFilter} connections</b><span>Add someone by their BOZO username.</span></div>`;
    return;
  }

  target.innerHTML = rows.map(friend => `
    <article class="friend-card">
      <img src="${escapeHtml(friend.avatar_url || './assets/bozo-mascot.webp')}" alt="">
      <div class="friend-card-copy">
        <span>${escapeHtml(friend.opening_personality || 'Player')}</span>
        <h3>${escapeHtml(friend.ign || 'Player')}</h3>
        <p>@${escapeHtml(friend.username)}</p>
        ${friend.bio ? `<small>${escapeHtml(friend.bio)}</small>` : ''}
      </div>
      <div class="friend-card-actions">
        ${friend.status === 'accepted' ? `
          <button class="button primary" onclick="openFriendProfile('${escapeHtml(friend.username).replace(/'/g,"\'")}')">View profile</button>
          <button class="button secondary" onclick="challengeWebFriend('${escapeHtml(friend.username).replace(/'/g,"\'")}')">Challenge</button>
          <button class="button secondary" onclick="removeWebFriend('${friend.friendship_id}')">Remove</button>
        ` : friend.direction === 'incoming' ? `
          <button class="button primary" onclick="respondWebFriend('${friend.friendship_id}',true)">Accept</button>
          <button class="button secondary" onclick="respondWebFriend('${friend.friendship_id}',false)">Decline</button>
        ` : `<span class="friend-pending">Request sent</span>`}
      </div>
    </article>
  `).join('');
}

async function sendWebFriendRequest() {
  const username = $('web-friend-username').value.trim();
  if (!username) return $('web-friend-status').textContent = 'Enter a username.';
  $('web-friend-status').textContent = 'Sending…';
  const { error } = await sb.rpc('send_friend_request', { target_username: username });
  if (error) return $('web-friend-status').textContent = readableError(error);
  $('add-web-friend-modal').hidden = true;
  toast('Friend request sent');
  friendFilter = 'outgoing';
  await loadWebFriends();
}

async function respondWebFriend(id, accept) {
  const { error } = await sb.rpc('respond_friend_request', {
    friendship_id: id,
    accept_request: accept
  });
  if (error) return toast(readableError(error));
  if (accept) await logActivity('friend_added', {});
  toast(accept ? 'Friend added' : 'Request declined');
  await loadWebFriends();
}

async function removeWebFriend(id) {
  if (!confirm('Remove this friend?')) return;
  const { error } = await sb.rpc('remove_friend', { friendship_id: id });
  if (error) return toast(readableError(error));
  toast('Friend removed');
  await loadWebFriends();
}

function challengeWebFriend(username) {
  route('challenges');
  setTimeout(() => {
    $('new-challenge-button').click();
    $('duel-opponent').value = '@' + username;
  }, 80);
}

async function openFriendProfile(username) {
  const friend = webFriends.find(item => item.username === username && item.status === 'accepted');
  if (!friend) return toast('That friend profile could not be loaded.');

  const modal = $('friend-profile-modal');
  modal.hidden = false;
  modal.querySelector('.friend-profile-modal')?.classList.add('friend-profile-loading');

  $('friend-profile-avatar').src = friend.avatar_url || './assets/bozo-mascot.webp';
  $('friend-profile-avatar').onerror = () => { $('friend-profile-avatar').src = './assets/bozo-mascot.webp'; };
  $('friend-profile-personality').textContent = friend.opening_personality || 'Player';
  $('friend-profile-ign').textContent = friend.ign || 'Player';
  $('friend-profile-username').textContent = '@' + (friend.username || 'username');
  $('friend-profile-bio').textContent = friend.bio?.trim() || 'This player has not added a bio yet.';
  $('friend-profile-white-opening').textContent = 'Loading…';
  $('friend-profile-black-e4-opening').textContent = 'Loading…';
  $('friend-profile-black-d4-opening').textContent = 'Loading…';
  $('friend-profile-challenge').dataset.username = friend.username || '';
  $('friend-profile-openings-studied').textContent = '—';
  $('friend-profile-reviews').textContent = '—';
  $('friend-profile-suggestions').textContent = '—';
  $('friend-profile-member-since').textContent = '—';
  $('friend-profile-activity').innerHTML = '<div class="empty-state mini"><span>Loading activity…</span></div>';

  const [{ data, error }, { data: socialData, error: socialError }] = await Promise.all([
    sb.rpc('get_friend_profile', { target_username: username }),
    sb.rpc('get_friend_activity_summary', { target_username: username })
  ]);
  const profile = Array.isArray(data) ? data[0] : data;
  if (error) {
    console.warn('Could not load extended friend profile:', error);
    $('friend-profile-white-opening').textContent = friend.favorite_white_opening || 'Not selected';
    $('friend-profile-black-e4-opening').textContent = friend.favorite_black_e4_opening || 'Not selected';
    $('friend-profile-black-d4-opening').textContent = friend.favorite_black_d4_opening || 'Not selected';
  } else {
    const detail = profile || {};
    $('friend-profile-avatar').src = detail.avatar_url || friend.avatar_url || './assets/bozo-mascot.webp';
    $('friend-profile-personality').textContent = detail.opening_personality || friend.opening_personality || 'Player';
    $('friend-profile-ign').textContent = detail.ign || friend.ign || 'Player';
    $('friend-profile-username').textContent = '@' + (detail.username || friend.username || 'username');
    $('friend-profile-bio').textContent = detail.bio?.trim() || friend.bio?.trim() || 'This player has not added a bio yet.';
    $('friend-profile-white-opening').textContent = detail.favorite_white_opening || 'Not selected';
    $('friend-profile-black-e4-opening').textContent = detail.favorite_black_e4_opening || 'Not selected';
    $('friend-profile-black-d4-opening').textContent = detail.favorite_black_d4_opening || 'Not selected';
  }
  if (socialError) {
    console.warn('Could not load friend activity summary:', socialError);
    $('friend-profile-activity').innerHTML = '<div class="empty-state mini"><span>Stats unavailable until the BOZO 2.7 migration is installed.</span></div>';
  } else {
    const social = Array.isArray(socialData) ? socialData[0] : socialData;
    $('friend-profile-openings-studied').textContent = Number(social?.openings_studied || 0).toLocaleString();
    $('friend-profile-reviews').textContent = Number(social?.games_reviewed || 0).toLocaleString();
    $('friend-profile-suggestions').textContent = Number(social?.accepted_suggestions || 0).toLocaleString();
    const memberSinceValue = social?.member_since || profile?.created_at || friend?.created_at;
    const memberSinceDate = memberSinceValue ? new Date(memberSinceValue) : null;
    $('friend-profile-member-since').textContent = memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : '—';
    $('friend-profile-activity').innerHTML = activityMarkup(social?.recent_activity || [], 'This player has not shared any recent BOZO activity.');
  }
  modal.querySelector('.friend-profile-modal')?.classList.remove('friend-profile-loading');
}

function closeFriendProfile() {
  $('friend-profile-modal').hidden = true;
}

$('close-friend-profile')?.addEventListener('click', closeFriendProfile);
$('friend-profile-close-button')?.addEventListener('click', closeFriendProfile);
$('friend-profile-modal')?.addEventListener('click', event => {
  if (event.target.id === 'friend-profile-modal') closeFriendProfile();
});
$('friend-profile-challenge')?.addEventListener('click', () => {
  const username = $('friend-profile-challenge').dataset.username;
  closeFriendProfile();
  if (username) challengeWebFriend(username);
});


function groupMovesByTurn(moves = []) {
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      turn: Math.floor(index / 2) + 1,
      white: moves[index] || '',
      black: moves[index + 1] || ''
    });
  }
  return rows;
}


function duelMoveSan(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';

  return String(
    entry.san ??
    entry.move_san ??
    entry.move ??
    entry.notation ??
    ''
  );
}

function normalizeDuelMoveHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history.map(duelMoveSan).filter(Boolean);
}

function duelStateSignature(duel) {
  if (!duel) return '';
  return JSON.stringify({
    status: duel.status,
    turn_user_id: duel.turn_user_id,
    result: duel.result,
    resulting_fen: duel.resulting_fen || duel.current_fen || duel.fen || '',
    moves: normalizeDuelMoveHistory(duel.move_history),
    white_time_ms: duel.white_time_ms,
    black_time_ms: duel.black_time_ms,
    clock_started_at: duel.clock_started_at,
    draw_offer_by: duel.draw_offer_by,
    draw_offer_at: duel.draw_offer_at
  });
}


function renderDuelMoveRows(moves = []) {
  const normalizedMoves = normalizeDuelMoveHistory(moves);
  return groupMovesByTurn(normalizedMoves).map(row => `
    <div class="grouped-move-row duel-history-row">
      <span class="move-number">${row.turn}.</span>
      <span>${escapeHtml(row.white)}</span>
      <span>${escapeHtml(row.black)}</span>
    </div>
  `).join('');
}

function renderGroupedMoveRows(moves = [], currentPly = moves.length) {
  return groupMovesByTurn(moves).map(row => {
    const whitePly = (row.turn - 1) * 2 + 1;
    const blackPly = whitePly + 1;
    return `
      <div class="grouped-move-row">
        <span class="move-number">${row.turn}.</span>
        <button class="${whitePly <= currentPly ? 'played' : ''} ${whitePly === currentPly ? 'current' : ''}"
                onclick="setStudyPly(${whitePly})">${escapeHtml(row.white)}</button>
        <button class="${row.black && blackPly <= currentPly ? 'played' : ''} ${blackPly === currentPly ? 'current' : ''}"
                ${row.black ? `onclick="setStudyPly(${blackPly})"` : 'disabled'}>${escapeHtml(row.black)}</button>
      </div>
    `;
  }).join('');
}

let studyOpening = null;
let studySideOverride = null;
let studyGame = null;
let studyMoves = [];
let studyPly = 0;
let studyOrientation = 'white';

$('close-study-modal').addEventListener('click', closeStudy);
$('study-start').addEventListener('click', () => setStudyPly(0));
$('study-prev').addEventListener('click', () => setStudyPly(studyPly - 1));
$('study-next').addEventListener('click', () => setStudyPly(studyPly + 1));
$('study-end').addEventListener('click', () => setStudyPly(studyMoves.length));
$('study-flip').addEventListener('click', () => {
  studyOrientation = studyOrientation === 'white' ? 'black' : 'white';
  paintStudy();
  if (lastCoachExplanation) {
    drawCoachAnnotations(
      lastCoachExplanation.arrows || [],
      lastCoachExplanation.highlights || []
    );
  }
});

$('ask-coach-button').addEventListener('click', askCurrentStudyMove);
$('clear-coach-button').addEventListener('click', clearCoach);
$('coach-question').addEventListener('keydown', event => {
  if (event.key === 'Enter') askCurrentStudyMove();
});

function matchingBozoOpeningDefinition(opening) {
  if (!opening) return null;
  return BOZO_CLOUD_OPENINGS.find(item =>
    item.eco === opening.eco &&
    item.name === opening.name &&
    (item.variation || 'Main Line') === (opening.variation || 'Main Line')
  ) || null;
}

function studyRepertoireSide() {
  if (studySideOverride === 'white') return 'White';
  if (studySideOverride === 'black') return 'Black';
  if (!studyOpening) return 'Neutral';
  const definition = matchingBozoOpeningDefinition(studyOpening);
  const raw = definition?.repertoire_side
    || studyOpening?.metadata?.repertoire_side
    || studyOpening?.metadata?.repertoireSide
    || studyOpening?.metadata?.side
    || '';
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'white' || normalized === 'w') return 'White';
  if (normalized === 'black' || normalized === 'b') return 'Black';
  return 'Neutral';
}

function studyMoveSide(ply = studyPly) {
  if (!ply) return 'Neutral';
  return ply % 2 === 1 ? 'White' : 'Black';
}

function studyAuthorExplanation(ply = studyPly) {
  if (!studyOpening || !ply) return '';
  const definition = matchingBozoOpeningDefinition(studyOpening);
  const explanations = definition?.author_explanations || studyOpening?.metadata?.author_explanations || {};
  return explanations?.[String(ply)] || explanations?.[ply] || '';
}

function updateStudyAuthorExplanation() {
  const panel = document.getElementById('study-author-explanation');
  const text = document.getElementById('study-author-explanation-text');
  const move = document.getElementById('study-author-explanation-move');
  if (!panel || !text || !move) return;

  const explanation = studyAuthorExplanation();
  if (!studyPly || !explanation) {
    panel.hidden = true;
    text.textContent = '';
    move.textContent = '';
    return;
  }

  const san = studyMoves[studyPly - 1] || '';
  move.textContent = `${Math.ceil(studyPly / 2)}${studyPly % 2 ? '.' : '...'} ${san}`;
  text.textContent = explanation;
  panel.hidden = false;
}

async function openStudyOpening(openingId, options = {}) {
  const { data, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn,notes,metadata')
    .eq('id', openingId)
    .maybeSingle();

  if (error || !data) return toast(readableError(error || new Error('Opening not found')));

  studyOpening = data;
  studySideOverride = ['white','black'].includes(String(options.repertoireSide || '').toLowerCase())
    ? String(options.repertoireSide).toLowerCase()
    : null;
  window.BozoMastery?.startSession?.(data, 0);
  studyGame = new Chess();
  const parser = new Chess();
  const loaded = parser.load_pgn(data.pgn, { sloppy: true });
  if (!loaded) return toast('This line could not be loaded on the study board.');

  studyMoves = parser.history();
  studyPly = 0;
  studyOrientation = ['white','black'].includes(String(options.orientation || '').toLowerCase())
    ? String(options.orientation).toLowerCase()
    : (studySideOverride || 'white');
  $('study-title').textContent = data.name;
  $('study-subtitle').textContent = `${data.variation || 'Main Line'} · ${data.eco || 'ECO —'}`;
  $('study-pgn').textContent = data.pgn;
  $('study-modal').hidden = false;
  clearCoach();
  updateStudyAuthorExplanation();
  paintStudy();
  requestAnimationFrame(() => paintStudy());
  setTimeout(() => paintStudy(), 80);
}

function closeStudy() {
  $('study-modal').hidden = true;
  studySideOverride = null;
}

function setStudyPly(nextPly) {
  const previousStudyPly = studyPly;
  studyPly = Math.max(0, Math.min(studyMoves.length, nextPly));
  window.BozoMastery?.recordStudyPly?.(studyOpening, studyPly, studyMoves.length, previousStudyPly);
  if (studyOpening && studyMoves.length && studyPly === studyMoves.length && previousStudyPly < studyMoves.length) {
    logActivity('opening_studied', { opening_id: studyOpening.id, opening: studyOpening.name, variation: studyOpening.variation || 'Main Line' });
  }
  studyGame = new Chess();
  for (let i = 0; i < studyPly; i++) {
    studyGame.move(studyMoves[i], { sloppy: true });
  }
  clearCoachAnnotations();
  updateCoachMoveLabel();
  updateStudyAuthorExplanation();
  paintStudy();
}

function paintStudy() {
  const boardElement = document.getElementById('study-board');
  if (!boardElement) {
    console.error('Opening Library study board element is missing.');
    return;
  }

  if (!studyGame) {
    studyGame = new Chess();
  }

  try {
    const orientation = studyOrientation === 'black' ? 'black' : 'white';
    const boardMatrix = studyGame.board();
    // chess.js board()[0] is rank 8 and board()[7] is rank 1.
    // White therefore reads the matrix in its native order; Black reverses it.
    const rankIndexes = orientation === 'white'
      ? [0,1,2,3,4,5,6,7]
      : [7,6,5,4,3,2,1,0];
    const fileIndexes = orientation === 'white'
      ? [0,1,2,3,4,5,6,7]
      : [7,6,5,4,3,2,1,0];

    const fragment = document.createDocumentFragment();

    for (const rowIndex of rankIndexes) {
      for (const columnIndex of fileIndexes) {
        const piece = boardMatrix[rowIndex][columnIndex];
        const square = document.createElement('div');
        square.className = 'opening-study-square';

        if (piece) {
          const color = piece.color === 'w' ? 'white' : 'black';
          square.dataset.pieceColor = color;
          const pieceId = `${piece.color}${piece.type.toUpperCase()}`;
          square.innerHTML = webPiece(pieceId);
        }

        fragment.appendChild(square);
      }
    }

    boardElement.replaceChildren(fragment);

    const progress = document.getElementById('study-progress');
    if (progress) {
      progress.textContent = studyPly === 0
        ? 'Start position'
        : `${studyPly}/${studyMoves.length} plies`;
    }

    const moveList = document.getElementById('study-move-list');
    if (moveList) moveList.innerHTML = renderGroupedMoveRows(studyMoves, studyPly);

    const previous = document.getElementById('study-prev');
    const startButton = document.getElementById('study-start');
    const next = document.getElementById('study-next');
    const endButton = document.getElementById('study-end');
    if (previous) previous.disabled = studyPly === 0;
    if (startButton) startButton.disabled = studyPly === 0;
    if (next) next.disabled = studyPly === studyMoves.length;
    if (endButton) endButton.disabled = studyPly === studyMoves.length;

    updateCoachMoveLabel();
    window.BozoMastery?.paintStudyPanel?.(studyOpening, studyPly, studyMoves.length);
  } catch (error) {
    console.error('Opening Library study board render failed:', error);
    boardElement.innerHTML =
      '<div class="study-board-error">The position could not be rendered. Open the browser console and send the red error shown there.</div>';
  }
}


let lastCoachExplanation = null;

const COACH_PIECE_NAMES = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };

function parseFenBoard(fen) {
  const board = {};
  const ranks = String(fen || '').split(' ')[0].split('/');
  ranks.forEach((rank, rankIndex) => {
    let file = 0;
    for (const token of rank) {
      if (/\d/.test(token)) { file += Number(token); continue; }
      const square = `${'abcdefgh'[file]}${8-rankIndex}`;
      board[square] = { type: token.toLowerCase(), color: token === token.toUpperCase() ? 'w' : 'b' };
      file += 1;
    }
  });
  return board;
}

function squareCoords(square) { return ['abcdefgh'.indexOf(square[0]), Number(square[1]) - 1]; }
function coordsSquare(file, rank) { return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? `${'abcdefgh'[file]}${rank+1}` : null; }

function attackedSquaresForPiece(square, piece, board) {
  const [file, rank] = squareCoords(square);
  const out = [];
  const add = (f,r) => { const sq = coordsSquare(f,r); if (sq) out.push(sq); };
  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? 1 : -1;
    add(file-1, rank+direction); add(file+1, rank+direction);
  } else if (piece.type === 'n') {
    [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(([df,dr]) => add(file+df,rank+dr));
  } else if (piece.type === 'k') {
    for (let df=-1; df<=1; df++) for (let dr=-1; dr<=1; dr++) if (df || dr) add(file+df,rank+dr);
  } else {
    const directions = piece.type === 'b' ? [[1,1],[1,-1],[-1,1],[-1,-1]]
      : piece.type === 'r' ? [[1,0],[-1,0],[0,1],[0,-1]]
      : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    directions.forEach(([df,dr]) => {
      let f=file+df, r=rank+dr;
      while (coordsSquare(f,r)) {
        const sq=coordsSquare(f,r); out.push(sq);
        if (board[sq]) break;
        f+=df; r+=dr;
      }
    });
  }
  return out;
}

function verifiedCoachFacts(fen, previousFen, playedMove) {
  try {
  const board = parseFenBoard(fen);
  const attacked = { w: [], b: [] };
  Object.entries(board).forEach(([from, piece]) => {
    attackedSquaresForPiece(from, piece, board).forEach(to => {
      const target = board[to];
      if (target && target.color !== piece.color) {
        attacked[target.color].push({
          attacker: `${piece.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[piece.type]} on ${from}`,
          target: `${target.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[target.type]} on ${to}`
        });
      }
    });
  });
  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose:true });
  const captures = legalMoves.filter(move => move.flags?.includes('c') || move.flags?.includes('e')).map(move => `${move.san} captures on ${move.to}`);
  const sideToMove = String(fen || '').split(' ')[1] === 'b' ? 'Black' : 'White';

  // Build an explicit, machine-checkable inventory of the CURRENT board. This is
  // deliberately redundant with FEN: the edge function receives both so it does
  // not have to "remember" where a piece used to be several moves ago.
  const pieceMap = Object.entries(board).reduce((acc, [square, piece]) => {
    acc[square] = `${piece.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[piece.type]}`;
    return acc;
  }, {});
  const whitePieces = Object.entries(pieceMap).filter(([,label]) => label.startsWith('White')).map(([sq,label]) => `${label} on ${sq}`);
  const blackPieces = Object.entries(pieceMap).filter(([,label]) => label.startsWith('Black')).map(([sq,label]) => `${label} on ${sq}`);
  const boardStateText = [...whitePieces, ...blackPieces].join('; ');

  // Verify what the selected move ACTUALLY did by replaying it from previousFen.
  // This gives the coach exact from/to/capture information instead of asking the
  // model to infer it from notation and history.
  let moveFacts = null;
  try {
    if (previousFen && playedMove) {
      const before = new Chess(previousFen);
      const verbose = before.move(playedMove, { sloppy: true });
      if (verbose) {
        moveFacts = {
          san: verbose.san || playedMove,
          color: verbose.color === 'w' ? 'White' : 'Black',
          piece: COACH_PIECE_NAMES[verbose.piece] || verbose.piece,
          from: verbose.from,
          to: verbose.to,
          captured: verbose.captured ? (COACH_PIECE_NAMES[verbose.captured] || verbose.captured) : null,
          promotion: verbose.promotion ? (COACH_PIECE_NAMES[verbose.promotion] || verbose.promotion) : null,
          isCapture: Boolean(verbose.captured),
          isCastle: /O-O/.test(verbose.san || playedMove),
          resultingFen: before.fen()
        };
      }
    }
  } catch (moveError) {
    console.warn('Could not verify selected coach move:', moveError);
  }

  return {
    playedMove: playedMove || '',
    sideToMove,
    inCheck: typeof game.in_check === 'function' ? game.in_check() : false,
    legalCaptureCount: captures.length,
    legalCaptures: captures.slice(0, 20),
    attackedWhitePieces: attacked.w.map(item => item.target),
    attackedBlackPieces: attacked.b.map(item => item.target),
    attackRelations: [...attacked.w, ...attacked.b].slice(0, 40),
    pieceMap,
    whitePieces,
    blackPieces,
    boardStateText,
    moveFacts,
    currentFen: fen || '',
    groundingRules: [
      'Treat currentFen and pieceMap as the source of truth for the CURRENT position.',
      'Never describe a piece as being on a square unless pieceMap contains that exact piece and square.',
      'Do not refer to a pawn by an old square from moveHistory. For example, if a pawn moved g4-g5, it is now the g5 pawn, not the g4 pawn.',
      'Use moveFacts as the source of truth for what the selected move moved, captured, or castled.',
      'Only state that a piece is attacked, pinned, trapped, forked, hanging, or won when the verified facts explicitly support it.',
      'Do not infer an immediate attack from a generic opening idea.',
      'When tactical verification is absent, explain development, central control, king safety, pawn structure, or long-term plans instead.',
      'Use cautious language for plans and future possibilities.'
    ],
    previousFen: previousFen || ''
  };
  } catch (error) {
    console.warn('Could not calculate verified coach facts:', error);
    return { playedMove: playedMove || '', sideToMove: '', inCheck:false, legalCaptureCount:0, legalCaptures:[], attackedWhitePieces:[], attackedBlackPieces:[], attackRelations:[], pieceMap:{}, whitePieces:[], blackPieces:[], boardStateText:'', moveFacts:null, currentFen:fen || '', groundingRules:['Do not make tactical claims unless directly verified from the board.'], previousFen: previousFen || '' };
  }
}

function textClaimsUnsupportedAttack(text, facts) {
  if (!text || !/attack(?:s|ed|ing)?|threaten(?:s|ed|ing)?|fork(?:s|ed|ing)?|pin(?:s|ned|ning)?|hang(?:s|ing)?/i.test(text)) return false;
  const whiteTargets = (facts.attackedWhitePieces || []).join(' ').toLowerCase();
  const blackTargets = (facts.attackedBlackPieces || []).join(' ').toLowerCase();
  const checks = [
    [/white(?:'s)?\s+bishop|white bishop/i, whiteTargets.includes('white bishop')],
    [/black(?:'s)?\s+bishop|black bishop/i, blackTargets.includes('black bishop')],
    [/white(?:'s)?\s+knight|white knight/i, whiteTargets.includes('white knight')],
    [/black(?:'s)?\s+knight|black knight/i, blackTargets.includes('black knight')],
    [/white(?:'s)?\s+queen|white queen/i, whiteTargets.includes('white queen')],
    [/black(?:'s)?\s+queen|black queen/i, blackTargets.includes('black queen')],
    [/white(?:'s)?\s+rook|white rook/i, whiteTargets.includes('white rook')],
    [/black(?:'s)?\s+rook|black rook/i, blackTargets.includes('black rook')]
  ];
  return checks.some(([pattern, supported]) => pattern.test(text) && !supported);
}

function textClaimsImpossibleBoardReference(text, facts) {
  if (!text || !facts?.pieceMap) return false;
  const pieceMap = facts.pieceMap || {};
  const lower = String(text).toLowerCase();

  // Catch explicit current-square claims. Curly apostrophes and optional hyphens
  // are supported because model prose often varies typographically.
  const patterns = [
    /\b(white|black)(?:['’]s)?\s+([a-h][1-8])[-\s]+(pawn|knight|bishop|rook|queen|king)\b/gi,
    /\b(white|black)(?:['’]s)?\s+(pawn|knight|bishop|rook|queen|king)\s+(?:on|at)\s+([a-h][1-8])\b/gi,
    /\bthe\s+(white|black)\s+(pawn|knight|bishop|rook|queen|king)\s+(?:on|at)\s+([a-h][1-8])\b/gi
  ];

  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];
    let match;
    while ((match = pattern.exec(lower))) {
      let color, square, piece;
      if (index === 0) { color = match[1]; square = match[2]; piece = match[3]; }
      else { color = match[1]; piece = match[2]; square = match[3]; }
      const expected = `${color === 'white' ? 'White' : 'Black'} ${piece}`;
      if (pieceMap[square] !== expected) return true;
    }
  }

  // Catch colorless forms such as "g4 pawn", "g4-pawn", or "pawn on g4".
  const squarePiece = /\b([a-h][1-8])[-\s]+(pawn|knight|bishop|rook|queen|king)\b/gi;
  let match;
  while ((match = squarePiece.exec(lower))) {
    const [, square, piece] = match;
    const actual = pieceMap[square];
    if (!actual || !actual.toLowerCase().endsWith(` ${piece}`)) return true;
  }

  const pieceOnSquare = /\b(pawn|knight|bishop|rook|queen|king)\s+(?:on|at)\s+([a-h][1-8])\b/gi;
  while ((match = pieceOnSquare.exec(lower))) {
    const [, piece, square] = match;
    const actual = pieceMap[square];
    if (!actual || !actual.toLowerCase().endsWith(` ${piece}`)) return true;
  }

  return false;
}

function coachSentenceIsGrounded(text, facts) {
  return !textClaimsImpossibleBoardReference(text, facts) && !textClaimsUnsupportedAttack(text, facts);
}

function sanitizeCoachExplanation(explanation, facts) {
  if (!explanation || typeof explanation !== 'object') return explanation;
  const cleanText = value => {
    if (typeof value !== 'string') return value;
    const sentences = value
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => coachSentenceIsGrounded(sentence, facts));
    return sentences.join(' ').trim() || 'The coach removed an unsupported board claim from this explanation. Ask again for a position-grounded explanation.';
  };
  const output = Array.isArray(explanation) ? explanation.map(item => typeof item === 'string' ? cleanText(item) : sanitizeCoachExplanation(item, facts)) : {};
  if (!Array.isArray(explanation)) Object.entries(explanation).forEach(([key,value]) => {
    output[key] = typeof value === 'string' ? cleanText(value)
      : Array.isArray(value) ? value.map(item => typeof item === 'string' ? cleanText(item) : sanitizeCoachExplanation(item, facts))
      : value && typeof value === 'object' ? sanitizeCoachExplanation(value, facts) : value;
  });
  output.groundingVerified = true;
  return output;
}

function updateCoachMoveLabel() {
  const label = $('coach-move-label');
  if (!label) return;
  label.textContent = studyPly > 0
    ? `${Math.ceil(studyPly / 2)}${studyPly % 2 ? '.' : '...'} ${studyMoves[studyPly - 1]}`
    : 'Choose a move';
}

function clearCoachAnnotations() {
  const svg = $('study-arrow-layer');
  if (svg) svg.innerHTML = '';
  lastCoachExplanation = null;
}

function clearCoach() {
  clearCoachAnnotations();
  const answer = $('coach-answer');
  const question = $('coach-question');
  if (answer) {
    answer.innerHTML =
      'Select a move in the line, then ask BOZO Coach why it is played.';
  }
  if (question) question.value = '';
  updateCoachMoveLabel();
}

async function askCurrentStudyMove() {
  const answer = $('coach-answer');
  const button = $('ask-coach-button');

  if (!state.session?.user) {
    answer.textContent = 'Sign in before using BOZO Coach.';
    return;
  }

  if (!studyOpening || !studyGame || studyPly === 0) {
    answer.textContent = 'Choose a move from the move list first.';
    return;
  }

  const replayBefore = new Chess();
  for (let index = 0; index < studyPly - 1; index++) {
    replayBefore.move(studyMoves[index], { sloppy: true });
  }

  const question = $('coach-question').value.trim();
  const playedMove = studyMoves[studyPly - 1];
  const coachFacts = verifiedCoachFacts(studyGame.fen(), replayBefore.fen(), playedMove);

  button.disabled = true;
  button.textContent = 'BOZO Coach is thinking…';
  answer.innerHTML = '<div class="coach-thinking">Analyzing the position and opening idea…</div>';
  clearCoachAnnotations();

  try {
    const { data, error } = await sb.functions.invoke('explain-move', {
      body: {
        fen: studyGame.fen(),
        previousFen: replayBefore.fen(),
        playedMove,
        moveNumber: Math.ceil(studyPly / 2),
        opening: studyOpening.name,
        variation: studyOpening.variation || 'Main Line',
        question: question || 'Why is this move played?',
        mode: 'study',
        gameStatus: 'study',
        moveHistory: studyMoves.slice(0, studyPly),
        authorExplanation: studyAuthorExplanation(studyPly),
        authoritativeOpeningNote: studyAuthorExplanation(studyPly),
        repertoireSide: studyRepertoireSide(),
        moveSide: studyMoveSide(studyPly),
        verifiedBoardFacts: coachFacts,
        strictGrounding: true
      }
    });

    if (error) {
      let message = error.message || 'BOZO Coach could not respond.';
      try {
        const context = await error.context?.json?.();
        if (context?.error) message = context.error;
      } catch (_) {}
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    if (!data?.explanation) throw new Error('BOZO Coach returned no explanation.');

    const groundedExplanation = sanitizeCoachExplanation(data.explanation, coachFacts);
    lastCoachExplanation = groundedExplanation;
    renderCoachExplanation(groundedExplanation);
  } catch (error) {
    answer.innerHTML = `<div class="coach-error">${escapeHtml(
      error?.message || 'BOZO Coach could not respond.'
    )}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Explain this move';
  }
}

function renderCoachExplanation(explanation) {
  const purposes = Array.isArray(explanation.purpose)
    ? explanation.purpose.filter(Boolean)
    : [];

  $('coach-answer').innerHTML = `
    <p class="coach-summary">${escapeHtml(explanation.summary || '')}</p>

    ${purposes.length ? `
      <div class="coach-section">
        <b>What it accomplishes</b>
        <ul>
          ${purposes.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${explanation.watchFor ? `
      <div class="coach-warning">
        <b>Watch for:</b>
        <span>${escapeHtml(explanation.watchFor)}</span>
      </div>
    ` : ''}

    ${explanation.suggestedQuestion ? `
      <button class="coach-follow-up"
              data-coach-question="${escapeHtml(explanation.suggestedQuestion)}">
        ${escapeHtml(explanation.suggestedQuestion)}
      </button>
    ` : ''}
    <div class="coach-grounding-note">Piece locations and tactical claims are checked against the current board. Unsupported or stale claims are omitted.</div>
  `;

  const followUp = $('coach-answer').querySelector('[data-coach-question]');
  if (followUp) {
    followUp.addEventListener('click', () => {
      $('coach-question').value = followUp.dataset.coachQuestion;
      askCurrentStudyMove();
    });
  }

  drawCoachAnnotations(
    explanation.arrows || [],
    explanation.highlights || []
  );
}

function squareCenter(square, orientation = 'white') {
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  const displayedFile = orientation === 'white' ? fileIndex : 7 - fileIndex;
  const displayedRank = orientation === 'white' ? 7 - rankIndex : rankIndex;

  return {
    x: displayedFile * 100 + 50,
    y: displayedRank * 100 + 50
  };
}

function validSquare(square) {
  return typeof square === 'string' && /^[a-h][1-8]$/.test(square);
}

function drawCoachAnnotations(arrows = [], highlights = []) {
  const svg = $('study-arrow-layer');
  if (!svg) return;

  const colors = {
    green: '#78c850',
    yellow: '#f6c945',
    red: '#ef5350',
    blue: '#42a5f5',
    purple: '#a855f7'
  };

  const markerDefinitions = Object.entries(colors).map(([name, color]) => `
    <marker id="coach-arrow-${name}"
            markerWidth="8"
            markerHeight="8"
            refX="6.5"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth">
      <path d="M0,0 L8,4 L0,8 Z" fill="${color}"></path>
    </marker>
  `).join('');

  const highlightMarkup = highlights
    .filter(item => validSquare(item.square))
    .slice(0, 4)
    .map(item => {
      const center = squareCenter(item.square, studyOrientation);
      const color = colors[item.color] || colors.purple;
      return `
        <rect x="${center.x - 48}"
              y="${center.y - 48}"
              width="96"
              height="96"
              rx="10"
              fill="${color}"
              opacity=".25">
          <title>${escapeHtml(item.label || '')}</title>
        </rect>
      `;
    }).join('');

  const arrowMarkup = arrows
    .filter(item => validSquare(item.from) && validSquare(item.to))
    .slice(0, 4)
    .map(item => {
      const from = squareCenter(item.from, studyOrientation);
      const to = squareCenter(item.to, studyOrientation);
      const colorName = colors[item.color] ? item.color : 'purple';
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const shorten = 23;
      const endX = to.x - (dx / length) * shorten;
      const endY = to.y - (dy / length) * shorten;

      return `
        <line x1="${from.x}"
              y1="${from.y}"
              x2="${endX}"
              y2="${endY}"
              stroke="${colors[colorName]}"
              stroke-width="14"
              stroke-linecap="round"
              opacity=".86"
              marker-end="url(#coach-arrow-${colorName})">
          <title>${escapeHtml(item.label || '')}</title>
        </line>
      `;
    }).join('');

  svg.innerHTML = `
    <defs>${markerDefinitions}</defs>
    ${highlightMarkup}
    ${arrowMarkup}
  `;
}


const FriendDuelClock = (() => {
  let timer = null;
  let duelId = null;
  let activeColor = 'white';
  let whiteMs = 10 * 60 * 1000;
  let blackMs = 10 * 60 * 1000;
  let lastTick = 0;
  let running = false;

  function format(ms) {
    const safe = Math.max(0, ms);
    const totalSeconds = Math.ceil(safe / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function isHumanFriendDuel(duel) {
    if (!duel) return false;
    const hasTwoHumans = Boolean(
      duel.challenger_id &&
      (duel.opponent_id || duel.challenged_id || duel.accepted_by)
    );
    const botFlag = duel.is_bot === true ||
      duel.opponent_type === 'bot' ||
      duel.mode === 'bot' ||
      duel.game_type === 'bot';
    return hasTwoHumans && !botFlag;
  }

  function paint() {
    const wrap = document.getElementById('friend-duel-clocks');
    if (!wrap) return;
    wrap.querySelectorAll('.player-clock-card').forEach(card => {
      card.classList.toggle('active', card.dataset.color === activeColor && running);
    });
    const white = document.getElementById('friend-clock-white');
    const black = document.getElementById('friend-clock-black');
    if (white) white.textContent = format(whiteMs);
    if (black) black.textContent = format(blackMs);
  }

  function tick() {
    if (!running) return;
    const now = Date.now();
    const elapsed = now - lastTick;
    lastTick = now;
    if (activeColor === 'white') whiteMs -= elapsed;
    else blackMs -= elapsed;
    if (whiteMs <= 0 || blackMs <= 0) {
      running = false;
      stopTimer();
      window.dispatchEvent(new CustomEvent('bozo-clock-expired', {
        detail: { color: whiteMs <= 0 ? 'white' : 'black', duelId }
      }));
    }
    paint();
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start(duel) {
    const wrap = document.getElementById('friend-duel-clocks');
    if (!isHumanFriendDuel(duel)) {
      stop();
      if (wrap) wrap.hidden = true;
      return;
    }

    duelId = duel.id;
    whiteMs = Number(duel.white_time_ms ?? duel.white_clock_ms ?? 600000);
    blackMs = Number(duel.black_time_ms ?? duel.black_clock_ms ?? 600000);
    activeColor = duel.turn_color || duel.active_color || 'white';
    running = !['completed','resigned','drawn','aborted'].includes(duel.status);
    lastTick = Date.now();

    if (wrap) wrap.hidden = false;
    const whiteName = document.getElementById('friend-clock-white-name');
    const blackName = document.getElementById('friend-clock-black-name');
    if (whiteName) whiteName.textContent = duel.white_name || 'White';
    if (blackName) blackName.textContent = duel.black_name || 'Black';

    stopTimer();
    if (running) timer = setInterval(tick, 250);
    paint();
  }

  function onMove(nextColor, serverState = {}) {
    tick();
    activeColor = nextColor;
    if (Number.isFinite(serverState.white_time_ms)) whiteMs = serverState.white_time_ms;
    if (Number.isFinite(serverState.black_time_ms)) blackMs = serverState.black_time_ms;
    lastTick = Date.now();
    paint();
  }

  function stop() {
    running = false;
    stopTimer();
    const wrap = document.getElementById('friend-duel-clocks');
    if (wrap) wrap.hidden = true;
  }

  return { start, onMove, stop, isHumanFriendDuel };
})();


/* ============================================================
   GAME REVIEW — STOCKFISH + BOZO COACH
   ============================================================ */

const REVIEW_STOCKFISH_JS = './assets/stockfish-18-lite-single.js';
const REVIEW_STOCKFISH_WASM = './assets/stockfish-18-lite-single.wasm';
const REVIEW_MATE_SCORE = 100000;

let reviewEngine = null;
let reviewEngineReady = null;
let reviewEngineSearch = null;
let reviewData = null;
let reviewStepIndex = 0;
let reviewOrientation = 'white';
let reviewCoachExplanation = null;
let reviewOpeningCatalog = null;

function prepareReviewPage() {
  const label = $('review-engine-state');
  if (label && reviewEngineReady) label.textContent = 'Stockfish ready';
}

$$('[data-review-input]').forEach(button => {
  button.addEventListener('click', () => {
    $$('[data-review-input]').forEach(item => item.classList.toggle('active', item === button));
    $('review-paste-panel').hidden = button.dataset.reviewInput !== 'paste';
    $('review-upload-panel').hidden = button.dataset.reviewInput !== 'upload';
  });
});

$('review-pgn-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  $('review-file-name').textContent = file ? file.name : 'No file selected';
  if (!file) return;
  try {
    $('review-pgn-input').value = await file.text();
  } catch (error) {
    $('review-import-message').textContent = 'The selected file could not be read.';
  }
});

$('start-game-review').addEventListener('click', startGameReview);
$('review-recommendation-button')?.addEventListener('click', event => {
  const id = event.currentTarget.dataset.openingId;
  if (id) openStudyById(id);
});
$('review-start').addEventListener('click', () => setReviewStep(0));
$('review-prev').addEventListener('click', () => setReviewStep(reviewStepIndex - 1));
$('review-next').addEventListener('click', () => setReviewStep(reviewStepIndex + 1));
$('review-end').addEventListener('click', () => setReviewStep(reviewData?.rows.length || 0));
$('review-flip').addEventListener('click', () => {
  reviewOrientation = reviewOrientation === 'white' ? 'black' : 'white';
  $('review-eval-top-label').textContent =
    reviewOrientation === 'white' ? 'Black' : 'White';
  $('review-eval-bottom-label').textContent =
    reviewOrientation === 'white' ? 'White' : 'Black';
  paintGameReview();
  if (reviewCoachExplanation) drawReviewCoachAnnotations(
    reviewCoachExplanation.arrows || [],
    reviewCoachExplanation.highlights || []
  );
});
$('ask-review-coach').addEventListener('click', askReviewCoach);
$('clear-review-coach').addEventListener('click', clearReviewCoach);
$('review-coach-question').addEventListener('keydown', event => {
  if (event.key === 'Enter') askReviewCoach();
});

function parseReviewPgn(pgn) {
  const game = new Chess();
  const loaded = game.load_pgn(pgn, { sloppy: true });
  if (!loaded) throw new Error('This PGN could not be parsed. Check that the move text is complete.');
  const history = game.history({ verbose: true });
  if (!history.length) throw new Error('No playable moves were found in this PGN.');

  const headers = typeof game.header === 'function' ? game.header() : {};
  return {
    headers,
    sans: history.map(move => move.san)
  };
}

function reviewCleanSan(move) {
  return String(move || '').replace(/[+#?!]/g, '');
}

async function loadReviewOpeningCatalog() {
  if (reviewOpeningCatalog) return reviewOpeningCatalog;
  const { data, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn')
    .eq('status', 'published')
    .limit(10000);
  if (error) throw error;

  reviewOpeningCatalog = (data || []).map(opening => {
    const parser = new Chess();
    const okay = parser.load_pgn(opening.pgn || '', { sloppy: true });
    return {
      ...opening,
      sans: okay ? parser.history().map(reviewCleanSan) : []
    };
  }).filter(opening => opening.sans.length);

  return reviewOpeningCatalog;
}

async function detectReviewOpening(gameSans) {
  const catalog = await loadReviewOpeningCatalog();
  const cleanGame = gameSans.map(reviewCleanSan);
  let best = null;
  let depth = 0;

  for (const opening of catalog) {
    let matched = 0;
    while (
      matched < opening.sans.length &&
      matched < cleanGame.length &&
      opening.sans[matched] === cleanGame[matched]
    ) matched++;

    if (matched > depth) {
      depth = matched;
      best = opening;
    }
  }

  return { opening: best, depth };
}

class ReviewStockfish {
  constructor() {
    this.worker = null;
    this.listeners = new Set();
    this.readyResolvers = [];
    this.bestResolvers = [];
    this.failure = null;
    this.searching = false;

    // One Stockfish worker cannot safely answer overlapping searches.
    // Review, the evaluation bar, and BOZO Bot all use this queue so
    // every request finishes before the next one begins.
    this.analysisQueue = Promise.resolve();
  }

  fail(error) {
    if (this.failure) return;
    this.failure = error;
    while (this.bestResolvers.length) {
      const pending = this.bestResolvers.shift();
      pending.unsubscribe();
      pending.reject(error);
    }
  }

  send(command) {
    if (!this.worker) throw new Error('Stockfish is not initialized.');
    this.worker.postMessage(command);
  }

  onMessage(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  waitFor(text, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Stockfish timed out waiting for ${text}.`));
      }, timeout);
      const unsubscribe = this.onMessage(message => {
        if (message === text || message.includes(text)) {
          clearTimeout(timer);
          unsubscribe();
          resolve(message);
        }
      });
    });
  }

  async initialize() {
    if (this.worker) return;
    const scriptUrl = new URL(REVIEW_STOCKFISH_JS, document.baseURI);
    this.worker = new Worker(scriptUrl.href);
    this.worker.addEventListener('message', event => this.handle(String(event.data)));
    this.worker.addEventListener('error', event => {
      this.fail(new Error(event?.message || 'Stockfish worker failed to load.'));
    });
    this.worker.addEventListener('messageerror', () => {
      this.fail(new Error('Stockfish returned an unreadable worker message.'));
    });

    // Register each listener BEFORE sending its command. Stockfish can answer
    // immediately, and the old order occasionally missed uciok/readyok.
    const uciReady = this.waitFor('uciok', 30000);
    this.send('uci');
    await uciReady;

        this.send('setoption name Hash value 32');
    this.send('setoption name MultiPV value 1');

    const engineReady = this.waitFor('readyok', 30000);
    this.send('isready');
    await engineReady;
  }

  handle(message) {
    this.listeners.forEach(listener => listener(message));
    if (message.startsWith('bestmove ')) {
      this.searching = false;
      const pending = this.bestResolvers.shift();
      if (pending) {
        pending.unsubscribe();
        pending.resolve(message.split(/\s+/)[1] || null);
      }
    }
  }

  analyze(fen, depth) {
    const run = () => this._analyze(fen, depth);

    // Continue the queue even if the previous search failed.
    const request = this.analysisQueue.then(run, run);
    this.analysisQueue = request.catch(() => undefined);
    return request;
  }

  async _analyze(fen, depth) {
    await this.initialize();
    if (this.failure) throw this.failure;

    this.send(`position fen ${fen}`);
    this.searching = true;

    let cp = null;
    let mate = null;
    let depthSeen = -1;
    let pv = [];

    const unsubscribeInfo = this.onMessage(message => {
      if (!message.startsWith('info ') || /\b(lowerbound|upperbound)\b/.test(message)) return;
      const depthMatch = message.match(/\bdepth (\d+)/);
      const currentDepth = depthMatch ? Number(depthMatch[1]) : depthSeen;
      if (currentDepth < depthSeen) return;
      depthSeen = currentDepth;

      const cpMatch = message.match(/\bscore cp (-?\d+)/);
      const mateMatch = message.match(/\bscore mate (-?\d+)/);
      const pvMatch = message.match(/\bpv (.+)$/);

      if (cpMatch) {
        cp = Number(cpMatch[1]);
        mate = null;
      }
      if (mateMatch) {
        mate = Number(mateMatch[1]);
        cp = null;
      }
      if (pvMatch) pv = pvMatch[1].trim().split(/\s+/);
    });

    const searchTimeout = Math.max(20000, Number(depth || 10) * 2500);

    const bestMove = await new Promise((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;

        try {
          this.send('stop');
        } catch (_) {}

        const pendingIndex = this.bestResolvers.findIndex(
          item => item.resolve === wrappedResolve
        );
        if (pendingIndex >= 0) this.bestResolvers.splice(pendingIndex, 1);

        unsubscribeInfo();
        this.searching = false;
        reject(new Error(
          `Stockfish analysis timed out at depth ${depth}.`
        ));
      }, searchTimeout);

      const wrappedResolve = move => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(move);
      };

      const wrappedReject = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };

      const unsubscribe = () => unsubscribeInfo();
      this.bestResolvers.push({
        resolve: wrappedResolve,
        reject: wrappedReject,
        unsubscribe
      });

      this.send(`go depth ${depth}`);
    });

    unsubscribeInfo();
    return { cp, mate, bestMove, pv, depthSeen };
  }

  async newGame() {
    await this.initialize();

    const ready = this.waitFor('readyok', 30000);
    this.send('ucinewgame');
    this.send('isready');
    await ready;
  }

  terminate() {
    try {
      if (this.searching && this.worker) this.worker.postMessage('stop');
    } catch (_) {}

    try {
      this.worker?.terminate();
    } catch (_) {}

    this.worker = null;
    this.failure = null;
    this.searching = false;
    this.listeners.clear();
    this.bestResolvers = [];
    this.analysisQueue = Promise.resolve();
  }
}

async function getReviewEngine() {
  if (reviewEngineReady) return reviewEngineReady;
  reviewEngineReady = (async () => {
    $('review-engine-state').textContent = 'Loading Stockfish…';
    reviewEngine = new ReviewStockfish();
    await reviewEngine.initialize();
    $('review-engine-state').textContent = 'Stockfish 18 ready';
    return reviewEngine;
  })().catch(error => {
    try {
      reviewEngine?.terminate();
    } catch (_) {}
    reviewEngineReady = null;
    reviewEngine = null;
    $('review-engine-state').textContent = 'Engine failed';
    throw error;
  });
  return reviewEngineReady;
}

function resetManagedStockfish() {
  try {
    reviewEngine?.terminate();
  } catch (_) {}

  try {
    if (webBotMoveEngine && webBotMoveEngine !== reviewEngine) {
      webBotMoveEngine.terminate();
    }
  } catch (_) {}

  reviewEngine = null;
  reviewEngineReady = null;
  webBotMoveEngine = null;

  const label = $('review-engine-state');
  if (label) label.textContent = 'Engine will restart';
}

async function getWebBotMoveEngine() {
  // One managed Stockfish worker is shared by BOZO Bot and Review.
  // The evaluation bar stays paused during bot play.
  return getReviewEngine();
}

function whiteReviewEval(result, turn) {
  let cp;
  if (result.mate != null) {
    cp = result.mate > 0
      ? REVIEW_MATE_SCORE - Math.abs(result.mate)
      : -REVIEW_MATE_SCORE + Math.abs(result.mate);
  } else {
    cp = result.cp || 0;
  }
  return turn === 'w' ? cp : -cp;
}

function reviewWinPercent(whiteCp) {
  const cp = Math.max(-1000, Math.min(1000, whiteCp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function reviewMoveAccuracy(winLoss) {
  const accuracy = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

function classifyReviewLoss(loss, isBook) {
  if (isBook) return { label: 'Book', cls: 'book' };
  if (loss <= 0) return { label: 'Best', cls: 'best' };
  if (loss <= 20) return { label: 'Excellent', cls: 'excellent' };
  if (loss <= 50) return { label: 'Good', cls: 'good' };
  if (loss <= 100) return { label: 'Inaccuracy', cls: 'inaccuracy' };
  if (loss <= 200) return { label: 'Mistake', cls: 'mistake' };
  return { label: 'Blunder', cls: 'blunder' };
}

function reviewUciToSan(fen, uci) {
  if (!uci || uci === '(none)') return '—';
  const game = new Chess(fen);
  const move = game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] || 'q'
  });
  return move?.san || uci;
}

function reviewPvToSan(fen, uciMoves = [], maximumMoves = 6) {
  const game = new Chess(fen);
  const sans = [];

  for (const uci of (uciMoves || []).slice(0, maximumMoves)) {
    if (!uci || uci.length < 4) break;

    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || 'q'
    });

    if (!move) break;
    sans.push(move.san);
  }

  return sans;
}

function reviewBestMovePosition(fen, bestMoveSan) {
  if (!fen || !bestMoveSan || bestMoveSan === '—') return '';
  const game = new Chess(fen);
  const move = game.move(bestMoveSan, { sloppy: true });
  return move ? game.fen() : '';
}

function reviewGamePhase(ply, totalPlies, fen = '') {
  if (ply <= 20) return 'opening';

  const boardPart = String(fen || '').split(' ')[0];
  const queens = (boardPart.match(/[qQ]/g) || []).length;
  const rooks = (boardPart.match(/[rR]/g) || []).length;
  const minors = (boardPart.match(/[nNbB]/g) || []).length;

  if (queens === 0 && (rooks <= 2 || minors <= 2)) return 'endgame';
  if (ply >= Math.max(40, totalPlies * 0.72)) return 'late middlegame';
  return 'middlegame';
}

function reviewMoveWindow(rows, selectedIndex, beforeCount = 6, afterCount = 6) {
  const start = Math.max(0, selectedIndex - beforeCount);
  const end = Math.min(rows.length, selectedIndex + afterCount + 1);

  return rows.slice(start, end).map((row, localIndex) => ({
    ply: row.ply,
    moveNumber: Math.ceil(row.ply / 2),
    side: row.ply % 2 === 1 ? 'White' : 'Black',
    san: row.san,
    classification: row.label,
    isSelected: start + localIndex === selectedIndex
  }));
}

function reviewHistoryToMoveText(history = []) {
  const output = [];
  for (let index = 0; index < history.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    const white = history[index] || '';
    const black = history[index + 1] || '';
    output.push(`${moveNumber}. ${white}${black ? ` ${black}` : ''}`);
  }
  return output.join(' ');
}

function reviewPlanContinuityPrompt(row, priorMoves, laterMoves) {
  return [
    `Recent moves before the selected move: ${priorMoves.join(' ') || 'not supplied'}.`,
    `The game continued after it with: ${laterMoves.join(' ') || 'not supplied'}.`,
    `Explain whether ${row.san} continued the player's previous plan, changed plans, or abandoned it.`,
    `Explain whether that change was justified by the position.`
  ].join(' ');
}

async function computeWebsiteReview(sans, depth, maxPlies, bookDepth, onProgress) {
  const engine = await getReviewEngine();
  const game = new Chess();
  const plies = sans.slice(0, maxPlies);
  const initialFen = game.fen();

  let analysis = await engine.analyze(initialFen, depth);
  let evalBefore = whiteReviewEval(analysis, game.turn());
  let engineBestBefore = reviewUciToSan(initialFen, analysis.bestMove);
  let pvBefore = analysis.pv || [];
  const rows = [];

  for (let index = 0; index < plies.length; index++) {
    const previousFen = game.fen();
    const mover = game.turn();
    const played = game.move(plies[index], { sloppy: true });
    if (!played) break;

    const fen = game.fen();
    analysis = await engine.analyze(fen, depth);
    const evalAfter = whiteReviewEval(analysis, game.turn());

    const rawLoss = mover === 'w'
      ? evalBefore - evalAfter
      : evalAfter - evalBefore;
    const engineLoss = Math.max(0, Math.round(rawLoss));
    const isBook = index < bookDepth;
    const classification = classifyReviewLoss(engineLoss, isBook);

    const winBefore = reviewWinPercent(evalBefore);
    const winAfter = reviewWinPercent(evalAfter);
    const moverBefore = mover === 'w' ? winBefore : 100 - winBefore;
    const moverAfter = mover === 'w' ? winAfter : 100 - winAfter;
    const accuracy = isBook ? 100 : reviewMoveAccuracy(moverBefore - moverAfter);

    rows.push({
      ply: index + 1,
      mover,
      san: played.san,
      from: played.from,
      to: played.to,
      previousFen,
      fen,
      whiteCp: evalAfter,
      mate: analysis.mate,
      engineLoss: isBook ? 0 : engineLoss,
      rawEngineLoss: engineLoss,
      accuracy,
      label: classification.label,
      cls: classification.cls,
      isBook,
      engineBest: engineBestBefore,
      bestMoveFen: reviewBestMovePosition(previousFen, engineBestBefore),
      principalVariation: pvBefore.slice(0, 8),
      principalVariationSan: reviewPvToSan(previousFen, pvBefore, 6),
      wasTop: reviewCleanSan(engineBestBefore) === reviewCleanSan(played.san)
    });

    evalBefore = evalAfter;
    engineBestBefore = reviewUciToSan(fen, analysis.bestMove);
    pvBefore = analysis.pv || [];
    onProgress?.(index + 1, plies.length);
  }

  return {
    initialFen,
    initialEval: whiteReviewEval(await engine.analyze(initialFen, depth), 'w'),
    rows
  };
}

function reviewAverage(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function reviewAccuracyFor(rows) {
  const value = reviewAverage(rows.map(row => row.accuracy));
  return value == null ? null : Math.round(value * 10) / 10;
}

async function startGameReview() {
  const message = $('review-import-message');
  const button = $('start-game-review');
  const pgn = $('review-pgn-input').value.trim();

  message.textContent = '';
  if (!pgn) {
    message.textContent = 'Paste or upload a PGN first.';
    return;
  }

  let parsed;
  try {
    parsed = parseReviewPgn(pgn);
  } catch (error) {
    message.textContent = error.message;
    return;
  }

  button.disabled = true;
  button.textContent = 'Analyzing…';
  $('review-progress-wrap').hidden = false;
  $('review-results').hidden = true;

  try {
    let engine;

    try {
      engine = await getReviewEngine();
      await engine.newGame();
    } catch (firstEngineError) {
      console.warn('Restarting Stockfish before review:', firstEngineError);
      resetManagedStockfish();
      engine = await getReviewEngine();
      await engine.newGame();
    }

    const openingMatch = await detectReviewOpening(parsed.sans);
    const depth = Number($('review-depth').value);
    const maxPlies = Number($('review-max-plies').value);

    reviewData = await computeWebsiteReview(
      parsed.sans,
      depth,
      maxPlies,
      openingMatch.depth,
      (done, total) => {
        const percentage = Math.round(done / total * 100);
        $('review-progress-label').textContent =
          `Stockfish depth ${depth} · analyzing move ${done} of ${total}`;
        $('review-progress-percent').textContent = `${percentage}%`;
        $('review-progress-bar').style.width = `${percentage}%`;
      }
    );

    reviewData.headers = parsed.headers;
    reviewData.openingMatch = openingMatch;
    reviewStepIndex = 0;
    reviewOrientation = 'white';

    renderReviewSummary();
    renderReviewMoveList();
    clearReviewCoach();
    paintGameReview();
    $('review-results').hidden = false;
    const matchedOpening = openingMatch?.opening || openingMatch?.data || openingMatch;
    const recommendation = $('review-opening-recommendation');
    if (recommendation && matchedOpening?.id) {
      recommendation.hidden = false;
      $('review-recommendation-title').textContent = matchedOpening.name || 'Study the detected opening';
      $('review-recommendation-copy').textContent = `BOZO recognized ${matchedOpening.name || 'this opening'} in your game. Review the line while the positions are still fresh.`;
      $('review-recommendation-button').dataset.openingId = matchedOpening.id;
    } else if (recommendation) recommendation.hidden = true;
    await logActivity('game_reviewed', { opening_id: matchedOpening?.id || null, opening: matchedOpening?.name || 'Unknown opening', accuracy: reviewAccuracyFor(reviewData.rows) });
    $('review-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);

    if (/Stockfish|worker|uciok|readyok|timed out/i.test(error?.message || '')) {
      resetManagedStockfish();
      $('review-engine-state').textContent = 'Engine reset · try again';
    }

    message.textContent = error?.message || 'Game review failed.';
  } finally {
    button.disabled = false;
    button.textContent = 'Analyze game';
    $('review-progress-wrap').hidden = true;
  }
}

function renderReviewSummary() {
  const rows = reviewData.rows;
  const openingRows = rows.filter(row => row.ply <= 16);
  const overall = reviewAccuracyFor(rows);
  const openingAccuracy = reviewAccuracyFor(openingRows);
  const turning = [...rows].sort((a, b) => b.rawEngineLoss - a.rawEngineLoss)[0];

  $('review-opening-accuracy').textContent =
    openingAccuracy == null ? '—' : `${openingAccuracy}%`;
  $('review-overall-accuracy').textContent =
    overall == null ? '—' : `${overall}%`;

  const match = reviewData.openingMatch;
  $('review-opening-name').textContent = match.opening
    ? match.opening.name
    : 'Unknown opening';
  $('review-book-depth').textContent =
    `${match.depth} matched book ${match.depth === 1 ? 'ply' : 'plies'}`;

  if (turning) {
    $('review-turning-point').textContent =
      `${Math.ceil(turning.ply / 2)}${turning.mover === 'w' ? '.' : '...'} ${turning.san}`;
    $('review-turning-detail').textContent =
      `${turning.label} · ${turning.rawEngineLoss}cp swing`;
  }
}

function renderReviewMoveList() {
  const rows = reviewData.rows;
  const grouped = [];

  for (let index = 0; index < rows.length; index += 2) {
    grouped.push({
      turn: index / 2 + 1,
      white: rows[index],
      black: rows[index + 1]
    });
  }

  $('game-review-moves').innerHTML = grouped.map(group => `
    <div class="review-move-row">
      <span>${group.turn}.</span>
      ${reviewMoveButton(group.white)}
      ${reviewMoveButton(group.black)}
    </div>
  `).join('');

  $$('[data-review-step]').forEach(button => {
    button.addEventListener('click', () => setReviewStep(Number(button.dataset.reviewStep)));
  });
}

function reviewMoveButton(row) {
  if (!row) return '<button disabled></button>';
  return `
    <button data-review-step="${row.ply}"
            class="review-move-button review-${row.cls}">
      <b>${escapeHtml(row.san)}</b>
      <small>${escapeHtml(row.label)}</small>
    </button>
  `;
}

function setReviewStep(step) {
  if (!reviewData) return;
  reviewStepIndex = Math.max(0, Math.min(reviewData.rows.length, step));
  clearReviewCoachAnnotations();
  updateReviewSelectedMove();
  paintGameReview();
}

function paintGameReview() {
  if (!reviewData) return;

  const fen = reviewStepIndex === 0
    ? reviewData.initialFen
    : reviewData.rows[reviewStepIndex - 1].fen;
  const board = fenBoard(fen);
  const ranks = reviewOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = reviewOrientation === 'white'
    ? ['a','b','c','d','e','f','g','h']
    : ['h','g','f','e','d','c','b','a'];

  const selected = reviewStepIndex === 0 ? null : reviewData.rows[reviewStepIndex - 1];

  $('game-review-board').innerHTML = ranks.flatMap(rank =>
    files.map(file => {
      const row = 8 - rank;
      const col = file.charCodeAt(0) - 97;
      const square = `${file}${rank}`;
      const last = selected && (square === selected.from || square === selected.to);
      const symbol = board[row][col];
      const color = symbol
        ? (symbol === symbol.toUpperCase() ? 'white' : 'black')
        : '';
      return `<div class="${last ? 'review-last-square' : ''}"
                   data-piece-color="${color}">${webPiece(symbol)}</div>`;
    })
  ).join('');

  $$('[data-review-step]').forEach(button =>
    button.classList.toggle('active', Number(button.dataset.reviewStep) === reviewStepIndex)
  );

  paintReviewEvaluation(selected?.whiteCp || 0, selected?.mate);
  updateReviewSelectedMove();

  $('review-start').disabled = reviewStepIndex === 0;
  $('review-prev').disabled = reviewStepIndex === 0;
  $('review-next').disabled = reviewStepIndex === reviewData.rows.length;
  $('review-end').disabled = reviewStepIndex === reviewData.rows.length;
}

function formatReviewEval(cp, mate) {
  if (mate != null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`;
}

function reviewPositionDescription(cp = 0, mate = null) {
  if (mate != null) {
    return mate > 0
      ? `White has a forced mate in ${Math.abs(mate)}`
      : `Black has a forced mate in ${Math.abs(mate)}`;
  }

  const absolute = Math.abs(cp);
  const side = cp > 0 ? 'White' : cp < 0 ? 'Black' : '';

  if (absolute < 25) return 'Equal';
  if (absolute < 75) return `${side} is slightly better`;
  if (absolute < 160) return `${side} has a clear edge`;
  if (absolute < 300) return `${side} is much better`;
  return `${side} is winning`;
}

function paintReviewEvaluation(cp = 0, mate = null) {
  const bounded = mate != null
    ? (mate > 0 ? 1000 : -1000)
    : Math.max(-1000, Math.min(1000, cp));

  // Logistic scaling keeps small advantages visible without allowing a
  // large score to completely erase one side of the bar.
  const whitePercent = Math.max(
    4,
    Math.min(96, 100 / (1 + Math.exp(-bounded / 170)))
  );
  const blackPercent = 100 - whitePercent;
  const description = reviewPositionDescription(cp, mate);

  $('review-eval-white-zone').style.height = `${whitePercent}%`;
  $('review-eval-black-zone').style.height = `${blackPercent}%`;
  $('review-vertical-eval').setAttribute('aria-label', description);
  $('review-vertical-eval').title = description;
}

function updateReviewSelectedMove() {
  const row = reviewStepIndex === 0 ? null : reviewData?.rows[reviewStepIndex - 1];

  if (!row) {
    $('review-selected-move').textContent = 'Starting position';
    $('review-classification').textContent = '—';
    $('review-classification').className = 'review-classification';
    $('review-selected-summary').textContent =
      'Choose a move to inspect its evaluation and alternatives.';
    $('review-move-eval').textContent = 'Equal';
    $('review-move-accuracy').textContent = '—';
    $('review-move-loss').textContent = '—';
    $('review-engine-best').textContent = '—';
    $('review-coach-move-label').textContent = 'Choose a move';
    return;
  }

  const moveLabel = `${Math.ceil(row.ply / 2)}${row.mover === 'w' ? '.' : '...'} ${row.san}`;
  $('review-selected-move').textContent = moveLabel;
  $('review-classification').textContent = row.label;
  $('review-classification').className = `review-classification review-${row.cls}`;
  $('review-selected-summary').textContent = row.isBook
    ? 'This move matched the published opening database.'
    : row.wasTop
      ? 'The played move matched Stockfish’s first choice.'
      : `Stockfish preferred ${row.engineBest}.`;
  $('review-move-eval').textContent = reviewPositionDescription(row.whiteCp, row.mate);
  $('review-move-accuracy').textContent = `${Math.round(row.accuracy * 10) / 10}%`;
  $('review-move-loss').textContent = `${row.rawEngineLoss}cp`;
  $('review-engine-best').textContent = row.engineBest || '—';
  $('review-coach-move-label').textContent = moveLabel;
}

function clearReviewCoachAnnotations() {
  $('game-review-arrow-layer').innerHTML = '';
  reviewCoachExplanation = null;
}

function clearReviewCoach() {
  clearReviewCoachAnnotations();
  $('review-coach-answer').textContent =
    'Select an analyzed move, then ask why it worked or failed.';
  $('review-coach-question').value = '';
}

async function askReviewCoach() {
  const row = reviewStepIndex === 0 ? null : reviewData?.rows[reviewStepIndex - 1];
  const answer = $('review-coach-answer');
  const button = $('ask-review-coach');

  if (!state.session?.user) {
    answer.textContent = 'Sign in before using BOZO Coach.';
    return;
  }
  if (!row) {
    answer.textContent = 'Select an analyzed move first.';
    return;
  }

  button.disabled = true;
  button.textContent = 'BOZO Coach is thinking…';
  answer.innerHTML = '<div class="coach-thinking">Turning the engine result into a useful explanation…</div>';
  clearReviewCoachAnnotations();

  try {
    const question = $('review-coach-question').value.trim();
    const opening = reviewData.openingMatch?.opening;
    const selectedIndex = reviewStepIndex - 1;
    const contextBeforeMoves = reviewData.rows
      .slice(Math.max(0, selectedIndex - 10), selectedIndex)
      .map(item => item.san);
    const actualContinuation = reviewData.rows
      .slice(selectedIndex + 1, selectedIndex + 9)
      .map(item => item.san);
    const contextWindow = reviewMoveWindow(
      reviewData.rows,
      selectedIndex,
      6,
      6
    );
    const gamePhase = reviewGamePhase(
      row.ply,
      reviewData.rows.length,
      row.fen
    );
    const reviewCoachFacts = verifiedCoachFacts(row.fen, row.previousFen, row.san);

    const { data, error } = await sb.functions.invoke('explain-move', {
      body: {
        mode: 'game_review',
        gameStatus: 'completed',
        fen: row.fen,
        previousFen: row.previousFen,
        playedMove: row.san,
        moveNumber: Math.ceil(row.ply / 2),
        opening: opening?.name || 'Unknown opening',
        variation: opening?.variation || 'Imported game',
        gamePhase,
        selectedSide: row.ply % 2 === 1 ? 'White' : 'Black',
        selectedMoveNumber: Math.ceil(row.ply / 2),
        contextWindow,
        contextBeforeMoves,
        contextBeforeText: reviewHistoryToMoveText(contextBeforeMoves),
        actualContinuation,
        planContinuityPrompt: reviewPlanContinuityPrompt(
          row,
          contextBeforeMoves,
          actualContinuation
        ),
        question: question ||
          `Compare ${row.san} with ${row.engineBest}. Explain how the preceding moves led to this decision, what changed afterward, and give me a practical plan.`,
        moveHistory: reviewData.rows.slice(0, row.ply).map(item => item.san),
        evaluationBefore: reviewStepIndex > 1
          ? reviewData.rows[reviewStepIndex - 2].whiteCp
          : 0,
        evaluationAfter: row.whiteCp,
        evaluationUnit: 'centipawns from White perspective',
        bestMove: row.engineBest,
        bestMoveFen: row.bestMoveFen,
        principalVariation: row.principalVariation,
        principalVariationSan: row.principalVariationSan,
        playedPositionDescription: reviewPositionDescription(row.whiteCp, row.mate),
        classification: row.label,
        centipawnLoss: row.rawEngineLoss,
        moveAccuracy: Math.round(row.accuracy * 10) / 10,
        openingAccuracy: reviewAccuracyFor(
          reviewData.rows.filter(item => item.ply <= 16)
        ),
        overallAccuracy: reviewAccuracyFor(reviewData.rows),
        verifiedBoardFacts: reviewCoachFacts,
        strictGrounding: true
      }
    });

    if (error) {
      let message = error.message || 'BOZO Coach could not respond.';
      try {
        const context = await error.context?.json?.();
        if (context?.error) message = context.error;
      } catch (_) {}
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    if (!data?.explanation) throw new Error('BOZO Coach returned no explanation.');

    const groundedExplanation = sanitizeCoachExplanation(data.explanation, reviewCoachFacts);
    reviewCoachExplanation = groundedExplanation;
    renderReviewCoachExplanation(groundedExplanation);
  } catch (error) {
    answer.innerHTML = `<div class="coach-error">${escapeHtml(
      error?.message || 'BOZO Coach could not respond.'
    )}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Compare and explain';
  }
}

function renderReviewCoachExplanation(explanation) {
  const purposes = Array.isArray(explanation.purpose)
    ? explanation.purpose.filter(Boolean)
    : [];
  const practicalPlan = Array.isArray(explanation.practicalPlan)
    ? explanation.practicalPlan.filter(Boolean)
    : [];

  $('review-coach-answer').innerHTML = `
    <p class="coach-summary">${escapeHtml(explanation.summary || '')}</p>

    ${explanation.howWeGotHere ? `
      <div class="coach-narrative coach-before-story">
        <b>How we got here</b>
        <p>${escapeHtml(explanation.howWeGotHere)}</p>
      </div>
    ` : ''}

    ${explanation.whatChanged ? `
      <div class="coach-narrative coach-after-story">
        <b>What changed after this move</b>
        <p>${escapeHtml(explanation.whatChanged)}</p>
      </div>
    ` : ''}

    ${explanation.planContinuity ? `
      <div class="coach-plan-continuity">
        <span>Plan check</span>
        <p>${escapeHtml(explanation.planContinuity)}</p>
      </div>
    ` : ''}

    ${explanation.comparison ? `
      <div class="coach-comparison">
        <b>Move comparison</b>
        <p>${escapeHtml(explanation.comparison)}</p>
      </div>
    ` : ''}

    <div class="coach-two-moves">
      ${explanation.playedMoveIdea ? `
        <div>
          <span>Your move</span>
          <p>${escapeHtml(explanation.playedMoveIdea)}</p>
        </div>
      ` : ''}
      ${explanation.betterMoveIdea ? `
        <div>
          <span>Better move</span>
          <p>${escapeHtml(explanation.betterMoveIdea)}</p>
        </div>
      ` : ''}
    </div>

    ${practicalPlan.length ? `
      <div class="coach-section coach-practical-plan">
        <b>Practical plan</b>
        <ol>${practicalPlan.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
      </div>
    ` : ''}

    ${purposes.length ? `
      <div class="coach-section">
        <b>Key ideas</b>
        <ul>${purposes.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    ` : ''}

    ${explanation.watchFor ? `
      <div class="coach-warning">
        <b>Watch for:</b>
        <span>${escapeHtml(explanation.watchFor)}</span>
      </div>
    ` : ''}

    ${explanation.suggestedQuestion ? `
      <button class="coach-follow-up"
              data-review-follow-up="${escapeHtml(explanation.suggestedQuestion)}">
        ${escapeHtml(explanation.suggestedQuestion)}
      </button>
    ` : ''}
    <div class="coach-grounding-note">Piece locations and tactical claims are checked against the current board. Unsupported or stale claims are omitted.</div>
  `;

  const followUp = $('review-coach-answer').querySelector('[data-review-follow-up]');
  if (followUp) {
    followUp.addEventListener('click', () => {
      $('review-coach-question').value = followUp.dataset.reviewFollowUp;
      askReviewCoach();
    });
  }

  drawReviewCoachAnnotations(
    explanation.arrows || [],
    explanation.highlights || []
  );
}

function reviewSquareCenter(square) {
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  return {
    x: (reviewOrientation === 'white' ? fileIndex : 7 - fileIndex) * 100 + 50,
    y: (reviewOrientation === 'white' ? 7 - rankIndex : rankIndex) * 100 + 50
  };
}

function drawReviewCoachAnnotations(arrows = [], highlights = []) {
  const svg = $('game-review-arrow-layer');
  const colors = {
    green: '#78c850',
    yellow: '#f6c945',
    red: '#ef5350',
    blue: '#42a5f5',
    purple: '#a855f7'
  };

  const markers = Object.entries(colors).map(([name, color]) => `
    <marker id="review-arrow-${name}"
            markerWidth="8" markerHeight="8"
            refX="6.5" refY="4"
            orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,4 L0,8 Z" fill="${color}"></path>
    </marker>
  `).join('');

  const squares = highlights
    .filter(item => validSquare(item.square))
    .slice(0, 4)
    .map(item => {
      const center = reviewSquareCenter(item.square);
      return `<rect x="${center.x - 48}" y="${center.y - 48}"
                    width="96" height="96" rx="10"
                    fill="${colors[item.color] || colors.purple}"
                    opacity=".25"></rect>`;
    }).join('');

  const lines = arrows
    .filter(item => validSquare(item.from) && validSquare(item.to))
    .slice(0, 4)
    .map(item => {
      const from = reviewSquareCenter(item.from);
      const to = reviewSquareCenter(item.to);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const endX = to.x - dx / length * 23;
      const endY = to.y - dy / length * 23;
      const name = colors[item.color] ? item.color : 'purple';

      return `<line x1="${from.x}" y1="${from.y}"
                    x2="${endX}" y2="${endY}"
                    stroke="${colors[name]}"
                    stroke-width="14"
                    stroke-linecap="round"
                    opacity=".86"
                    marker-end="url(#review-arrow-${name})"></line>`;
    }).join('');

  svg.innerHTML = `<defs>${markers}</defs>${squares}${lines}`;
}


/* ============================================================
   BOZO BOT — OPENING-LOCKED PRACTICE + STOCKFISH FREE PLAY
   ============================================================ */

const BOT_STRENGTHS = {
  beginner: { label: 'Beginner', depth: 5, randomness: 0.24 },
  casual: { label: 'Casual', depth: 7, randomness: 0.08 },
  club: { label: 'Club', depth: 11, randomness: 0 },
  advanced: { label: 'Advanced', depth: 14, randomness: 0 },
  master: { label: 'BOZO Master', depth: 17, randomness: 0 }
};

let webBotSession = null;
let webBotSelectedSquare = null;
let webBotAnalysisToken = 0;
let webBotMoveEngine = null;
let webBotTurnWatchdog = null;
let webBotTurnMonitor = null;
let webBotMovePromise = null;
let botUserArrows = [];
let botArrowStart = null;
let botRightMouseDown = false;

async function startWebBotGameFromSetup() {
  const openingId = $('duel-opening-id').value;
  if (!openingId) {
    $('duel-create-status').textContent = 'Choose a cloud opening line first.';
    return;
  }

  const button = $('send-opening-duel');
  button.disabled = true;
  button.textContent = 'Loading line…';
  $('duel-create-status').textContent = '';

  try {
    const { data: opening, error } = await sb.from('openings')
      .select('id,eco,name,variation,pgn')
      .eq('id', openingId)
      .single();

    if (error) throw error;

    const parser = new Chess();
    const loaded = parser.load_pgn(opening.pgn || '', { sloppy: true });
    if (!loaded) throw new Error('The selected opening line contains invalid move text.');

    const bookSans = parser.history();
    if (!bookSans.length) throw new Error('The selected line contains no moves.');

    const strengthKey = $('bot-strength').value;
    const strength = BOT_STRENGTHS[strengthKey] || BOT_STRENGTHS.club;
    const playerColor = $('duel-color').value === 'black' ? 'b' : 'w';
    const requestedBookPlies = Number($('duel-required-plies').value);
    const requiredBookPlies = Math.min(requestedBookPlies, bookSans.length);

    webBotSession = {
      opening,
      game: new Chess(),
      bookSans,
      requiredBookPlies,
      playerColor,
      strengthKey,
      strength,
      phase: 'book',
      status: 'active',
      resultReason: '',
      moves: [],
      selected: null,
      lastMove: null,
      botThinking: false,
      startedAt: Date.now()
    };

    $('challenge-create-modal').hidden = true;
    $('bot-game-modal').hidden = false;
    $('bot-game-title').textContent =
      `${opening.name}${opening.variation ? ': ' + opening.variation : ''}`;
    $('bot-game-subtitle').textContent =
      `${opening.eco || 'ECO —'} · ${Math.ceil(requiredBookPlies / 2)} required book moves`;
    $('bot-book-name').textContent =
      `${opening.name}${opening.variation ? ': ' + opening.variation : ''}`;
    $('bot-book-pgn').textContent = opening.pgn || '';
    $('bot-player-color-label').textContent = playerColor === 'w' ? 'White' : 'Black';
    $('bot-strength-label').textContent = strength.label;
    $('bot-review-button').hidden = true;
    botUserArrows = [];
    webBotSelectedSquare = null;

    paintWebBotGame();
    updateWebBotStatus();
    startWebBotTurnMonitor();
    $('bot-eval-label').textContent = 'Paused';
    $('bot-eval-white').style.width = '50%';

    if (!webBotIsPlayerTurn()) {
      requestWebBotMove('game-start');
    }
  } catch (error) {
    console.error(error);
    $('duel-create-status').textContent =
      error?.message || 'BOZO Bot could not start.';
  } finally {
    button.disabled = false;
    button.textContent = 'Start training game';
  }
}

function closeWebBotGame() {
  clearTimeout(webBotTurnWatchdog);
  webBotTurnWatchdog = null;
  stopWebBotTurnMonitor();
  webBotMovePromise = null;
  $('bot-game-modal').hidden = true;
  webBotAnalysisToken++;
  webBotSession = null;
  webBotSelectedSquare = null;
  botUserArrows = [];

  resetManagedStockfish();
}

function webBotIsPlayerTurn() {
  return Boolean(
    webBotSession &&
    webBotSession.game.turn() === webBotSession.playerColor
  );
}

function webBotBookMoveAtPly(ply = webBotSession?.game.history().length || 0) {
  return webBotSession?.bookSans?.[ply] || null;
}

function webBotStillMatchesBook() {
  if (!webBotSession) return false;
  const history = webBotSession.game.history().map(reviewCleanSan);
  return history.every((move, index) =>
    reviewCleanSan(webBotSession.bookSans[index]) === move
  );
}

function webBotBookPhaseActive() {
  if (!webBotSession) return false;
  const ply = webBotSession.game.history().length;
  return (
    ply < webBotSession.requiredBookPlies &&
    ply < webBotSession.bookSans.length &&
    webBotStillMatchesBook()
  );
}

function updateWebBotPhase() {
  if (!webBotSession || webBotSession.status !== 'active') return;
  webBotSession.phase = webBotBookPhaseActive() ? 'book' : 'freeplay';
}

function paintWebBotGame() {
  if (!webBotSession) return;

  const game = webBotSession.game;
  const board = fenBoard(game.fen());
  const orientation = webBotSession.playerColor === 'w' ? 'white' : 'black';
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === 'white'
    ? ['a','b','c','d','e','f','g','h']
    : ['h','g','f','e','d','c','b','a'];

  const legalTargets = webBotSelectedSquare
    ? game.moves({ square: webBotSelectedSquare, verbose: true }).map(move => move.to)
    : [];

  $('web-bot-board').innerHTML = ranks.flatMap(rank =>
    files.map(file => {
      const square = `${file}${rank}`;
      const row = 8 - rank;
      const col = file.charCodeAt(0) - 97;
      const symbol = board[row][col];
      const pieceColor = symbol
        ? (symbol === symbol.toUpperCase() ? 'white' : 'black')
        : '';
      const classes = [];
      if (webBotSession.lastMove &&
          (square === webBotSession.lastMove.from || square === webBotSession.lastMove.to)) {
        classes.push('bot-last-square');
      }
      if (square === webBotSelectedSquare) classes.push('bot-selected-square');
      if (legalTargets.includes(square)) classes.push('bot-legal-square');

      return `<button type="button"
                      class="${classes.join(' ')}"
                      data-bot-square="${square}"
                      data-piece-color="${pieceColor}">
                ${webPiece(symbol)}
              </button>`;
    })
  ).join('');

  $$('[data-bot-square]').forEach(button => {
    button.addEventListener('click', () => handleWebBotSquare(button.dataset.botSquare));
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (!botRightMouseDown) toggleBotSquareHighlight(button.dataset.botSquare);
    });
    button.addEventListener('mousedown', event => {
      if (event.button !== 2) return;
      event.preventDefault();
      botRightMouseDown = true;
      botArrowStart = button.dataset.botSquare;
    });
    button.addEventListener('mouseup', event => {
      if (event.button !== 2 || !botArrowStart) return;
      event.preventDefault();
      const end = button.dataset.botSquare;
      if (end !== botArrowStart) addBotUserArrow(botArrowStart, end);
      botArrowStart = null;
      setTimeout(() => { botRightMouseDown = false; }, 0);
    });
  });

  paintBotUserAnnotations();
  renderWebBotMoveList();
}

function handleWebBotSquare(square) {
  if (!webBotSession ||
      webBotSession.status !== 'active' ||
      webBotSession.botThinking ||
      !webBotIsPlayerTurn()) return;

  const game = webBotSession.game;
  const piece = game.get(square);

  if (!webBotSelectedSquare) {
    if (piece && piece.color === webBotSession.playerColor) {
      webBotSelectedSquare = square;
      paintWebBotGame();
    }
    return;
  }

  if (piece && piece.color === webBotSession.playerColor) {
    webBotSelectedSquare = square;
    paintWebBotGame();
    return;
  }

  const from = webBotSelectedSquare;
  webBotSelectedSquare = null;
  const legal = game.moves({ square: from, verbose: true });
  const candidate = legal.find(move => move.to === square);

  if (!candidate) {
    paintWebBotGame();
    toast('That move is not legal.');
    return;
  }

  const currentPly = game.history().length;
  const expectedSan = webBotBookMoveAtPly(currentPly);

  if (webBotBookPhaseActive() &&
      reviewCleanSan(candidate.san) !== reviewCleanSan(expectedSan)) {
    paintWebBotGame();
    $('bot-game-message').innerHTML =
      `Stay in the selected line. The book move is <b>${escapeHtml(expectedSan)}</b>.`;
    toast(`Book move: ${expectedSan}`);
    return;
  }

  const played = game.move({
    from,
    to: square,
    promotion: candidate.promotion || 'q'
  });

  if (!played) {
    paintWebBotGame();
    toast('That move could not be played.');
    return;
  }

  webBotSession.lastMove = played;
  webBotSession.moves = game.history();
  updateWebBotPhase();
  paintWebBotGame();
  updateWebBotStatus();

  if (checkWebBotGameOver()) {
    updateWebBotEvaluation();
    return;
  }

  requestWebBotMove('player-moved');
}

function startWebBotTurnMonitor() {
  stopWebBotTurnMonitor();

  webBotTurnMonitor = setInterval(() => {
    if (!webBotSession ||
        webBotSession.status !== 'active' ||
        webBotIsPlayerTurn()) return;

    requestWebBotMove('turn-monitor');
  }, 350);
}

function stopWebBotTurnMonitor() {
  if (webBotTurnMonitor) clearInterval(webBotTurnMonitor);
  webBotTurnMonitor = null;
}

function requestWebBotMove(reason = 'requested') {
  if (!webBotSession ||
      webBotSession.status !== 'active' ||
      webBotIsPlayerTurn()) {
    return Promise.resolve(null);
  }

  if (webBotMovePromise) return webBotMovePromise;

  const session = webBotSession;
  session.botThinking = true;
  session.botThinkReason = reason;
  updateWebBotStatus();

  webBotMovePromise = playWebBotMove()
    .catch(error => {
      console.error('BOZO Bot move request failed:', error);
      if (webBotSession === session) {
        session.botThinking = false;
        $('bot-game-message').textContent =
          error?.message || 'BOZO Bot could not move.';
      }
      return null;
    })
    .finally(() => {
      webBotMovePromise = null;

      if (webBotSession === session &&
          session.status === 'active' &&
          !webBotIsPlayerTurn()) {
        setTimeout(() => requestWebBotMove('post-search-recovery'), 250);
      }
    });

  return webBotMovePromise;
}

function withBotTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Stockfish did not answer within ${Math.round(milliseconds / 1000)} seconds.`)),
        milliseconds
      )
    )
  ]);
}

function botMaterialValue(piece) {
  return ({ p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 })[piece] || 0;
}

function fallbackMoveSafety(game, move) {
  const clone = new Chess(game.fen());
  const played = clone.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion || 'q'
  });

  if (!played) return -100000;

  let worstReplyLoss = 0;
  const replies = clone.moves({ verbose: true });

  for (const reply of replies) {
    let loss = 0;

    if (reply.captured) {
      loss += botMaterialValue(reply.captured);
    }

    // Strongly penalize replies that capture the piece just moved.
    if (reply.to === move.to && reply.captured) {
      loss += botMaterialValue(move.piece) * 0.9;
    }

    if (reply.san.includes('#')) loss += 20000;
    else if (reply.san.includes('+')) loss += 90;

    worstReplyLoss = Math.max(worstReplyLoss, loss);
  }

  return -worstReplyLoss;
}

function chooseFallbackBotMove(game, strength) {
  const legalMoves = game.moves({ verbose: true });
  if (!legalMoves.length) return null;

  const scored = legalMoves.map(move => {
    let score = fallbackMoveSafety(game, move);

    // Immediate material gains.
    if (move.captured) score += botMaterialValue(move.captured);

    // Useful chess priorities.
    if (move.san.includes('#')) score += 50000;
    else if (move.san.includes('+')) score += 120;
    if (move.flags?.includes('k') || move.flags?.includes('q')) score += 90;
    if (move.piece === 'n' || move.piece === 'b') score += 24;
    if (['d4','d5','e4','e5','c4','c5','f4','f5'].includes(move.to)) score += 18;

    // Discourage undeveloping pieces and early queen wandering.
    const startingSquares = ['a1','b1','c1','d1','e1','f1','g1','h1',
                             'a8','b8','c8','d8','e8','f8','g8','h8'];
    if (startingSquares.includes(move.to) && !startingSquares.includes(move.from)) {
      score -= 35;
    }
    if (move.piece === 'q' && game.history().length < 16) score -= 25;

    // Only weak levels receive meaningful randomness.
    score += (strength.randomness || 0) * Math.random() * 80;

    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const choiceWindow =
    strength.depth <= 5 ? Math.min(4, scored.length) :
    strength.depth <= 7 ? Math.min(2, scored.length) :
    1;

  return scored[Math.floor(Math.random() * choiceWindow)]?.move || scored[0].move;
}

async function playWebBotMove() {
  if (!webBotSession ||
      webBotSession.status !== 'active' ||
      webBotIsPlayerTurn()) return null;

  const session = webBotSession;
  const game = session.game;
  let played = null;

  // This flag describes only the current bot move.
  session.usedFallback = false;

  try {
    const currentPly = game.history().length;
    const expectedSan = webBotBookMoveAtPly(currentPly);

    if (webBotBookPhaseActive() && expectedSan) {
      played = game.move(expectedSan, { sloppy: true });
      if (!played) throw new Error(`Invalid book move: ${expectedSan}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      updateWebBotPhase();
      $('bot-turn-badge').textContent = 'BOZO Bot thinking…';
      $('bot-game-message').textContent =
        `Stockfish is calculating at depth ${session.strength.depth}.`;

      let result = null;
      const searchTimeout = Math.max(14000, session.strength.depth * 1500);

      for (let attempt = 1; attempt <= 2 && !result; attempt++) {
        try {
          const engine = await getWebBotMoveEngine();
          result = await withBotTimeout(
            engine.analyze(game.fen(), session.strength.depth),
            searchTimeout
          );
        } catch (engineError) {
          console.warn(`BOZO Bot Stockfish attempt ${attempt} failed:`, engineError);
          resetManagedStockfish();

          if (attempt === 1) {
            $('bot-game-message').textContent =
              'Restarting Stockfish and recalculating…';
          }
        }
      }

      if (webBotSession !== session || session.status !== 'active') return null;

      let chosenUci = result?.bestMove || null;

      if (chosenUci &&
          session.strength.randomness > 0 &&
          Math.random() < session.strength.randomness) {
        const random = chooseFallbackBotMove(game, session.strength);
        if (random) {
          chosenUci = `${random.from}${random.to}${random.promotion || ''}`;
        }
      }

      if (chosenUci) {
        played = game.move({
          from: chosenUci.slice(0, 2),
          to: chosenUci.slice(2, 4),
          promotion: chosenUci.slice(4, 5) || 'q'
        });
      }

      if (!played) {
        const fallback = chooseFallbackBotMove(game, session.strength);
        if (!fallback) throw new Error('BOZO Bot has no legal move.');
        played = game.move({
          from: fallback.from,
          to: fallback.to,
          promotion: fallback.promotion || 'q'
        });
        session.usedFallback = true;
        console.warn('BOZO Bot used its emergency fallback move.');
      }
    }

    session.lastMove = played;
    session.moves = game.history();
    updateWebBotPhase();
    session.botThinking = false;
    paintWebBotGame();
    updateWebBotStatus();

    const gameEnded = checkWebBotGameOver();
    $('bot-eval-label').textContent =
      session.usedFallback ? 'Fallback' : 'Engine';
    if (gameEnded) return played;
  } catch (error) {
    console.error('BOZO Bot error:', error);
    $('bot-game-message').textContent =
      error?.message || 'BOZO Bot could not move.';
    throw error;
  } finally {
    if (webBotSession === session) {
      session.botThinking = false;
      updateWebBotStatus();
    }
  }

  return played;
}

function checkWebBotGameOver() {
  if (!webBotSession) return true;
  const game = webBotSession.game;
  if (!game.game_over()) return false;

  webBotSession.status = 'completed';
  stopWebBotTurnMonitor();

  if (game.in_checkmate()) {
    const loser = game.turn();
    webBotSession.resultReason =
      loser === webBotSession.playerColor
        ? 'Checkmate. BOZO Bot wins.'
        : 'Checkmate. You defeated BOZO Bot!';
  } else if (game.in_stalemate()) {
    webBotSession.resultReason = 'Draw by stalemate.';
  } else if (game.in_threefold_repetition()) {
    webBotSession.resultReason = 'Draw by threefold repetition.';
  } else if (game.insufficient_material()) {
    webBotSession.resultReason = 'Draw by insufficient material.';
  } else {
    webBotSession.resultReason = 'The game ended in a draw.';
  }

  $('bot-review-button').hidden = false;
  updateWebBotStatus();
  paintWebBotGame();
  return true;
}

function updateWebBotStatus() {
  if (!webBotSession) return;

  const session = webBotSession;
  const game = session.game;
  const playerTurn = webBotIsPlayerTurn();

  if (session.status === 'completed') {
    $('bot-turn-badge').textContent = 'Game complete';
    $('bot-phase-label').textContent = 'Finished';
    $('bot-game-message').textContent = session.resultReason;
    return;
  }

  $('bot-phase-label').textContent =
    session.phase === 'book' ? 'Book phase' : 'Free play';

  if (session.botThinking) {
    $('bot-turn-badge').textContent = 'BOZO Bot thinking…';
    $('bot-game-message').textContent =
      session.phase === 'book'
        ? 'BOZO Bot is following the selected line.'
        : `Stockfish is thinking at depth ${session.strength.depth}.`;
    return;
  }

  $('bot-turn-badge').textContent = playerTurn ? 'Your move' : 'BOZO Bot';
  if (playerTurn) {
    const expected = webBotBookPhaseActive()
      ? webBotBookMoveAtPly(game.history().length)
      : null;
    $('bot-game-message').innerHTML = expected
      ? `Play the selected book move. <span class="bot-hidden-hint">Hint available after an incorrect attempt.</span>`
      : 'Any legal move is allowed. The opening lesson is complete.';
  } else {
    $('bot-game-message').textContent =
      session.phase === 'book'
        ? 'BOZO Bot will answer with the stored book move.'
        : session.usedFallback
          ? 'The last move used the emergency safety fallback.'
          : 'BOZO Bot will choose a Stockfish move.';

    // Recovery is handled by the permanent turn monitor.
  }
}

function renderWebBotMoveList() {
  if (!webBotSession) return;
  $('bot-move-list').innerHTML = renderDuelMoveRows(webBotSession.game.history());
}

async function updateWebBotEvaluation() {
  if (!webBotSession) return;
  $('bot-eval-white').style.width = '50%';
  $('bot-eval-label').textContent =
    webBotSession.botThinking ? 'Thinking' : 'Paused';
}

function resignWebBotGame() {
  if (!webBotSession || webBotSession.status !== 'active') return;
  webBotSession.status = 'completed';
  stopWebBotTurnMonitor();
  webBotSession.resultReason = 'You resigned. BOZO Bot wins.';
  $('bot-review-button').hidden = false;
  updateWebBotStatus();
}

function restartWebBotGame() {
  if (!webBotSession) return;
  const setup = {
    opening: webBotSession.opening,
    bookSans: webBotSession.bookSans,
    requiredBookPlies: webBotSession.requiredBookPlies,
    playerColor: webBotSession.playerColor,
    strengthKey: webBotSession.strengthKey,
    strength: webBotSession.strength
  };

  webBotSession = {
    ...setup,
    game: new Chess(),
    phase: 'book',
    status: 'active',
    resultReason: '',
    moves: [],
    selected: null,
    lastMove: null,
    botThinking: false,
    startedAt: Date.now()
  };

  webBotSelectedSquare = null;
  botUserArrows = [];
  $('bot-review-button').hidden = true;
  resetManagedStockfish();
  paintWebBotGame();
  updateWebBotStatus();
  startWebBotTurnMonitor();
  $('bot-eval-label').textContent = 'Paused';
  $('bot-eval-white').style.width = '50%';

  if (!webBotIsPlayerTurn()) requestWebBotMove('restart');
}

function reviewWebBotGame() {
  if (!webBotSession) return;
  const pgn = webBotSession.game.pgn();
  closeWebBotGame();
  route('review');

  setTimeout(() => {
    $('review-pgn-input').value = pgn;
    $('review-import-message').textContent =
      'BOZO Bot game loaded. Choose the analysis settings and click Analyze game.';
    $('review-pgn-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

$('close-bot-game').addEventListener('click', closeWebBotGame);
$('bot-resign-button').addEventListener('click', resignWebBotGame);
$('bot-restart-button').addEventListener('click', restartWebBotGame);
$('bot-review-button').addEventListener('click', reviewWebBotGame);
$('clear-bot-arrows').addEventListener('click', () => {
  botUserArrows = [];
  paintBotUserAnnotations();
});

function botSquareCenter(square) {
  const orientation = webBotSession?.playerColor === 'b' ? 'black' : 'white';
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  return {
    x: (orientation === 'white' ? fileIndex : 7 - fileIndex) * 100 + 50,
    y: (orientation === 'white' ? 7 - rankIndex : rankIndex) * 100 + 50
  };
}

function addBotUserArrow(from, to) {
  const existing = botUserArrows.findIndex(item =>
    item.type === 'arrow' && item.from === from && item.to === to
  );
  if (existing >= 0) botUserArrows.splice(existing, 1);
  else botUserArrows.push({ type: 'arrow', from, to });
  paintBotUserAnnotations();
}

function toggleBotSquareHighlight(square) {
  const existing = botUserArrows.findIndex(item =>
    item.type === 'square' && item.square === square
  );
  if (existing >= 0) botUserArrows.splice(existing, 1);
  else botUserArrows.push({ type: 'square', square });
  paintBotUserAnnotations();
}

function paintBotUserAnnotations() {
  const svg = $('bot-user-arrow-layer');
  if (!svg || !webBotSession) return;

  const marker = `
    <marker id="bot-user-arrow-head"
            markerWidth="8" markerHeight="8"
            refX="6.5" refY="4"
            orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,4 L0,8 Z" fill="#f6c945"></path>
    </marker>`;

  const markup = botUserArrows.map(item => {
    if (item.type === 'square') {
      const center = botSquareCenter(item.square);
      return `<rect x="${center.x - 48}" y="${center.y - 48}"
                    width="96" height="96" rx="10"
                    fill="#f6c945" opacity=".28"></rect>`;
    }

    const from = botSquareCenter(item.from);
    const to = botSquareCenter(item.to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const endX = to.x - dx / length * 23;
    const endY = to.y - dy / length * 23;

    return `<line x1="${from.x}" y1="${from.y}"
                  x2="${endX}" y2="${endY}"
                  stroke="#f6c945"
                  stroke-width="14"
                  stroke-linecap="round"
                  opacity=".82"
                  marker-end="url(#bot-user-arrow-head)"></line>`;
  }).join('');

  svg.innerHTML = `<defs>${marker}</defs>${markup}`;
}

let challengeFilter = 'active';
let webChallengeRows = [];
let activeWebDuel = null;
let webDuelGame = null;
let selectedWebSquare = null;
let duelRealtimeChannel = null;
let duelPollingTimer = null;
let duelRefreshInFlight = false;
let duelLastSignature = '';
let duelUserAnnotations = [];
let duelArrowStart = null;
let duelRightMouseDown = false;
let duelClockTimer = null;
let duelClockSnapshot = null;

function renderChallenges() {
  const signedIn = Boolean(state.session?.user);
  $('challenges-guest').hidden = signedIn;
  $('challenges-user').hidden = !signedIn;
  if (signedIn) loadChallenges();
}

$$('[data-challenge-filter]').forEach(button => {
  button.addEventListener('click', () => {
    challengeFilter = button.dataset.challengeFilter;
    $$('[data-challenge-filter]').forEach(b => b.classList.toggle('active', b === button));
    paintChallengeList();
  });
});

let newGameMode = 'friend';

function openNewGameSetup(mode = 'friend') {
  newGameMode = mode;
  $('challenge-create-modal').hidden = false;
  $('duel-opening-results').innerHTML = '';
  $('duel-opening-id').value = '';
  $('duel-create-status').textContent = '';
  $$('[data-new-game-mode]').forEach(button =>
    button.classList.toggle('active', button.dataset.newGameMode === mode)
  );
  $('friend-game-fields').hidden = mode !== 'friend';
  $('bot-game-fields').hidden = mode !== 'bot';
  $('send-opening-duel').textContent =
    mode === 'bot' ? 'Start training game' : 'Send challenge';
}

$('new-challenge-button').addEventListener('click', () => openNewGameSetup('friend'));
$('new-bot-game-button').addEventListener('click', () => openNewGameSetup('bot'));

$$('[data-new-game-mode]').forEach(button => {
  button.addEventListener('click', () => openNewGameSetup(button.dataset.newGameMode));
});

$('close-challenge-create').addEventListener('click', () => $('challenge-create-modal').hidden = true);
$('close-challenge-game').addEventListener('click', closeWebDuel);
$('duel-refresh-button').addEventListener('click', async () => {
  if (!activeWebDuel?.id) return;
  const changed = await refreshOpenWebDuel(activeWebDuel.id, { force: true });
  toast(changed ? 'Board refreshed' : 'Board is already current');
});
$('duel-offer-draw-button')?.addEventListener('click', offerWebDuelDraw);
$('duel-accept-draw')?.addEventListener('click', () => respondWebDuelDraw(true));
$('duel-decline-draw')?.addEventListener('click', () => respondWebDuelDraw(false));
$('duel-resign-button').addEventListener('click', resignWebDuel);

let openingSearchTimer;
$('duel-opening-search').addEventListener('input', () => {
  clearTimeout(openingSearchTimer);
  openingSearchTimer = setTimeout(searchDuelOpenings, 260);
});
$('send-opening-duel').addEventListener('click', () => {
  if (newGameMode === 'bot') startWebBotGameFromSetup();
  else sendWebChallenge();
});

async function searchDuelOpenings() {
  const query = $('duel-opening-search').value.trim();
  if (query.length < 2) return $('duel-opening-results').innerHTML = '';
  const { data, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn')
    .eq('status','published')
    .or(`name.ilike.%${query}%,variation.ilike.%${query}%,eco.ilike.%${query}%`)
    .order('name').limit(20);
  if (error) return $('duel-opening-results').textContent = readableError(error);
  $('duel-opening-results').innerHTML = (data || []).map(o => `
    <button data-duel-opening-id="${o.id}">
      <b>${escapeHtml(o.name)}</b>
      <span>${escapeHtml(o.variation || 'Main Line')} · ${escapeHtml(o.eco || 'ECO —')}</span>
      <code>${escapeHtml((o.pgn || '').slice(0,120))}</code>
    </button>`).join('');
  $('duel-opening-results').querySelectorAll('button').forEach((button, i) => {
    button.addEventListener('click', () => {
      const opening = data[i];
      $('duel-opening-id').value = opening.id;
      $('duel-opening-search').value = `${opening.name}${opening.variation ? ': ' + opening.variation : ''}`;
      $('duel-opening-results').innerHTML = '';
    });
  });
}

async function sendWebChallenge() {
  const openingId = $('duel-opening-id').value;
  const opponent = $('duel-opponent').value.trim();
  if (!opponent || !openingId) {
    $('duel-create-status').textContent = 'Choose an opponent and a cloud opening line.';
    return;
  }
  $('duel-create-status').textContent = 'Sending…';
  const { error } = await sb.rpc('create_opening_challenge', {
    opponent_username: opponent,
    selected_opening_id: openingId,
    selected_color: $('duel-color').value,
    selected_required_plies: Number($('duel-required-plies').value),
    selected_time_control: 'correspondence'
  });
  if (error) return $('duel-create-status').textContent = readableError(error);
  $('challenge-create-modal').hidden = true;
  toast('Opening Duel sent');
  challengeFilter = 'sent';
  await loadChallenges();
}

async function loadChallenges() {
  const { data, error } = await sb.rpc('my_opening_challenges');
  if (error) {
    $('web-challenge-list').innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }
  webChallengeRows = data || [];
  paintChallengeList();
}

function challengeOpponentName(c) {
  const me = state.session.user.id;
  return c.challenger_id === me
    ? `${c.opponent_ign} (@${c.opponent_username})`
    : `${c.challenger_ign} (@${c.challenger_username})`;
}

function challengeColor(c) {
  const me = state.session.user.id;
  const challengerIsWhite = c.challenger_color === 'white';
  const iAmChallenger = c.challenger_id === me;
  return (challengerIsWhite === iAmChallenger) ? 'White' : 'Black';
}

function filteredChallenges() {
  const uid = state.session.user.id;
  return webChallengeRows.filter(c => {
    if (challengeFilter === 'active') return c.status === 'active';
    if (challengeFilter === 'incoming') return c.status === 'pending' && c.opponent_id === uid;
    if (challengeFilter === 'sent') return c.status === 'pending' && c.challenger_id === uid;
    return ['completed','declined','cancelled'].includes(c.status);
  });
}

function paintChallengeList() {
  const rows = filteredChallenges();
  const target = $('web-challenge-list');
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state"><div>⚔</div><b>No ${challengeFilter} duels</b><span>Challenge someone to an exact opening or sideline.</span></div>`;
    return;
  }
  target.innerHTML = rows.map(c => {
    const incoming = c.status === 'pending' && c.opponent_id === state.session.user.id;
    const sent = c.status === 'pending' && c.challenger_id === state.session.user.id;
    const active = c.status === 'active';
    const moveCount = (c.move_history || []).length;
    return `<article class="web-duel-card">
      <div class="web-duel-card-head">
        <div><span>${escapeHtml(c.variation_name || 'Main Line')}</span><h3>${escapeHtml(c.opening_name)}</h3></div>
        <div class="duel-status ${c.status}">${escapeHtml(c.status)}</div>
      </div>
      <p>vs ${escapeHtml(challengeOpponentName(c))} · You play ${challengeColor(c)}</p>
      <div class="duel-progress"><i style="width:${Math.min(100,(moveCount/c.required_plies)*100)}%"></i></div>
      <small>${moveCount}/${c.required_plies} required book plies completed</small>
      <div class="duel-card-actions">
        ${incoming ? `<button class="button primary" onclick="respondWebChallenge('${c.id}',true)">Accept</button><button class="button secondary" onclick="respondWebChallenge('${c.id}',false)">Decline</button>` : ''}
        ${sent ? `<button class="button secondary" onclick="cancelWebChallenge('${c.id}')">Cancel</button>` : ''}
        ${active ? `<button class="button primary" onclick="openWebDuel('${c.id}')">Open board</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

async function respondWebChallenge(id, accept) {
  const { error } = await sb.rpc('respond_opening_challenge',{challenge_id:id,accept_challenge:accept});
  if (error) return toast(readableError(error));
  toast(accept ? 'Challenge accepted' : 'Challenge declined');
  await loadChallenges();
}
async function cancelWebChallenge(id) {
  const { error } = await sb.rpc('cancel_opening_challenge',{challenge_id:id});
  if (error) return toast(readableError(error));
  toast('Challenge cancelled');
  await loadChallenges();
}

async function fetchWebDuel(id) {
  if (duelRefreshInFlight) return null;
  duelRefreshInFlight = true;

  try {
    const { data, error } = await sb.rpc('my_opening_challenges');
    if (error) throw error;

    const duel = (data || []).find(challenge => challenge.id === id) || null;
    if (!duel) return null;

    // Clock columns were added after the original challenge RPC. Read them
    // directly and merge them without changing the existing RPC contract.
    const { data: clockRow, error: clockError } = await sb
      .from('opening_challenges')
      .select('white_time_ms,black_time_ms,clock_started_at,draw_offer_by,draw_offer_at,updated_at')
      .eq('id', id)
      .maybeSingle();

    if (!clockError && clockRow) Object.assign(duel, clockRow);
    return duel;
  } finally {
    duelRefreshInFlight = false;
  }
}

function replayWebDuelPosition(duel) {
  const game = new Chess();
  const moves = normalizeDuelMoveHistory(duel?.move_history);

  for (const san of moves) {
    const result = game.move(san, { sloppy: true });
    if (!result) {
      console.warn('Could not replay duel move:', san);
      break;
    }
  }

  return game;
}

async function refreshOpenWebDuel(id, { force = false } = {}) {
  const duel = await fetchWebDuel(id);
  if (!duel) {
    if (force) toast('Duel not found');
    return false;
  }

  const signature = duelStateSignature(duel);
  if (!force && signature === duelLastSignature) return false;

  activeWebDuel = duel;
  webDuelGame = replayWebDuelPosition(duel);
  duelLastSignature = signature;
  selectedWebSquare = null;

  $('duel-game-title').textContent = duel.opening_name;
  $('duel-game-subtitle').textContent =
    `${duel.variation_name || 'Main Line'} · vs ${challengeOpponentName(duel)}`;
  $('duel-book-name').textContent = duel.variation_name || 'Main Line';
  $('duel-book-pgn').textContent = duel.line_pgn || '';

  paintWebDuel();
  checkAndFinishWebDuelRules().catch(error =>
    console.warn('Automatic draw check failed:', error)
  );
  return true;
}

function startWebDuelPolling(id) {
  stopWebDuelPolling();

  duelPollingTimer = setInterval(() => {
    if ($('challenge-game-modal').hidden) return;
    refreshOpenWebDuel(id).catch(error =>
      console.warn('Duel polling refresh failed:', error)
    );
  }, 1200);
}

function stopWebDuelPolling() {
  if (duelPollingTimer) clearInterval(duelPollingTimer);
  duelPollingTimer = null;
}

async function openWebDuel(id) {
  $('challenge-game-modal').hidden = false;

  const loaded = await refreshOpenWebDuel(id, { force: true });
  if (!loaded) {
    $('challenge-game-modal').hidden = true;
    return;
  }

  if (duelRealtimeChannel) {
    sb.removeChannel(duelRealtimeChannel);
    duelRealtimeChannel = null;
  }

  duelRealtimeChannel = sb.channel(`duel-${id}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'opening_challenges',
        filter: `id=eq.${id}`
      },
      () => {
        refreshOpenWebDuel(id, { force: true }).catch(error =>
          console.warn('Realtime duel refresh failed:', error)
        );
      }
    )
    .subscribe(status => {
      console.info('Duel realtime status:', status);
    });

  startWebDuelPolling(id);
  startDuelClock();
}

function closeWebDuel() {
  $('challenge-game-modal').hidden = true;
  stopWebDuelPolling();
  stopDuelClock();
  duelLastSignature = '';
  duelUserAnnotations = [];
  duelArrowStart = null;

  if (duelRealtimeChannel) {
    sb.removeChannel(duelRealtimeChannel);
    duelRealtimeChannel = null;
  }
}

function duelSquareCenter(square) {
  const orientation = activeWebDuel ? myDuelColor(activeWebDuel) : 'white';
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  const displayFile = orientation === 'white' ? fileIndex : 7 - fileIndex;
  const displayRank = orientation === 'white' ? 7 - rankIndex : rankIndex;
  return {
    x: displayFile * 100 + 50,
    y: displayRank * 100 + 50
  };
}

function addDuelArrow(from, to) {
  const index = duelUserAnnotations.findIndex(item =>
    item.type === 'arrow' && item.from === from && item.to === to
  );
  if (index >= 0) duelUserAnnotations.splice(index, 1);
  else duelUserAnnotations.push({ type: 'arrow', from, to });
  paintDuelAnnotations();
}

function toggleDuelSquare(square) {
  const index = duelUserAnnotations.findIndex(item =>
    item.type === 'square' && item.square === square
  );
  if (index >= 0) duelUserAnnotations.splice(index, 1);
  else duelUserAnnotations.push({ type: 'square', square });
  paintDuelAnnotations();
}

function paintDuelAnnotations() {
  const svg = $('friend-duel-arrow-layer');
  if (!svg || !activeWebDuel) return;

  const marker = `
    <marker id="friend-duel-arrow-head"
            markerWidth="8" markerHeight="8"
            refX="6.5" refY="4"
            orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,4 L0,8 Z" fill="#f6c945"></path>
    </marker>`;

  const markup = duelUserAnnotations.map(item => {
    if (item.type === 'square') {
      const center = duelSquareCenter(item.square);
      return `<rect x="${center.x - 48}" y="${center.y - 48}"
                    width="96" height="96" rx="10"
                    fill="#f6c945" opacity=".28"></rect>`;
    }

    const from = duelSquareCenter(item.from);
    const to = duelSquareCenter(item.to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const endX = to.x - dx / length * 23;
    const endY = to.y - dy / length * 23;

    return `<line x1="${from.x}" y1="${from.y}"
                  x2="${endX}" y2="${endY}"
                  stroke="#f6c945"
                  stroke-width="14"
                  stroke-linecap="round"
                  opacity=".82"
                  marker-end="url(#friend-duel-arrow-head)"></line>`;
  }).join('');

  svg.innerHTML = `<defs>${marker}</defs>${markup}`;
}

function chessBoolean(game, names) {
  for (const name of names) {
    if (typeof game?.[name] === 'function') {
      try {
        if (game[name]()) return true;
      } catch (_) {}
    }
  }
  return false;
}

function duelThreefold(game) {
  return chessBoolean(game, [
    'isThreefoldRepetition',
    'inThreefoldRepetition',
    'in_threefold_repetition'
  ]);
}

function duelStalemate(game) {
  return chessBoolean(game, ['isStalemate', 'inStalemate', 'in_stalemate']);
}

function duelInsufficientMaterial(game) {
  return chessBoolean(game, [
    'isInsufficientMaterial',
    'insufficientMaterial',
    'insufficient_material'
  ]);
}

function duelGeneralDraw(game) {
  return chessBoolean(game, ['isDraw', 'inDraw', 'in_draw']);
}

function duelCheckmate(game) {
  return chessBoolean(game, ['isCheckmate', 'inCheckmate', 'in_checkmate']);
}

function duelHalfmoveClock(game) {
  const fen = game?.fen?.() || '';
  const fields = fen.split(' ');
  return Number(fields[4] || 0);
}

function duelFiftyMoveRule(game) {
  return duelHalfmoveClock(game) >= 100;
}

function duelAutomaticDrawReason(game) {
  if (duelThreefold(game)) return 'threefold repetition';
  if (duelFiftyMoveRule(game)) return 'fifty-move rule';
  if (duelStalemate(game)) return 'stalemate';
  if (duelInsufficientMaterial(game)) return 'insufficient material';

  // Some chess.js versions expose only a combined draw method.
  if (duelGeneralDraw(game) && !duelCheckmate(game)) return 'draw';
  return '';
}

function sideHasPossibleMatingMaterial(game, color) {
  const pieces = [];
  for (const file of ['a','b','c','d','e','f','g','h']) {
    for (let rank = 1; rank <= 8; rank++) {
      const piece = game.get(`${file}${rank}`);
      if (piece?.color === color && piece.type !== 'k') pieces.push(piece.type);
    }
  }

  if (pieces.some(type => type === 'q' || type === 'r' || type === 'p')) return true;
  const bishops = pieces.filter(type => type === 'b').length;
  const knights = pieces.filter(type => type === 'n').length;

  // This is intentionally conservative: combinations that can possibly
  // produce mate count as mating material.
  return bishops >= 2 || (bishops >= 1 && knights >= 1) || knights >= 2;
}

async function finishWebDuelAsDraw(reason) {
  if (!activeWebDuel || activeWebDuel.status !== 'active') return false;

  const { error } = await sb.rpc('finish_opening_challenge', {
    challenge_id: activeWebDuel.id,
    finish_reason: reason,
    game_result: '1/2-1/2'
  });

  if (error) {
    console.warn('Could not finish duel as draw:', error);
    return false;
  }

  activeWebDuel.status = 'completed';
  activeWebDuel.result = '1/2-1/2';
  activeWebDuel.draw_offer_by = null;
  activeWebDuel.draw_offer_at = null;
  stopDuelClock();
  paintWebDuel();
  toast(`Draw by ${reason}`);
  return true;
}

async function checkAndFinishWebDuelRules() {
  if (!activeWebDuel || activeWebDuel.status !== 'active' || !webDuelGame) return false;

  if (duelCheckmate(webDuelGame)) {
    const result = webDuelGame.turn() === 'w' ? '0-1' : '1-0';
    const { error } = await sb.rpc('finish_opening_challenge', {
      challenge_id: activeWebDuel.id,
      finish_reason: 'checkmate',
      game_result: result
    });
    if (!error) {
      activeWebDuel.status = 'completed';
      activeWebDuel.result = result;
      stopDuelClock();
      paintWebDuel();
      return true;
    }
    return false;
  }

  const drawReason = duelAutomaticDrawReason(webDuelGame);
  if (drawReason) return finishWebDuelAsDraw(drawReason);
  return false;
}

function paintDuelDrawOffer() {
  const panel = $('duel-draw-offer-panel');
  const offerButton = $('duel-offer-draw-button');
  if (!panel || !offerButton || !activeWebDuel) return;

  const uid = state.session?.user?.id;
  const offeredByMe = activeWebDuel.draw_offer_by === uid;
  const offeredByOpponent =
    Boolean(activeWebDuel.draw_offer_by) && activeWebDuel.draw_offer_by !== uid;

  panel.hidden = !activeWebDuel.draw_offer_by || activeWebDuel.status !== 'active';
  offerButton.disabled =
    activeWebDuel.status !== 'active' || Boolean(activeWebDuel.draw_offer_by);
  offerButton.textContent = offeredByMe ? 'Draw offered' : 'Offer draw';

  if (offeredByMe) {
    $('duel-draw-offer-title').textContent = 'Draw offer sent';
    $('duel-draw-offer-message').textContent =
      'Waiting for your opponent to accept or decline.';
    $('duel-draw-response-actions').hidden = true;
  } else if (offeredByOpponent) {
    $('duel-draw-offer-title').textContent = 'Your opponent offers a draw';
    $('duel-draw-offer-message').textContent =
      'Accept to finish the game as a draw, or decline to continue.';
    $('duel-draw-response-actions').hidden = false;
  }
}

async function offerWebDuelDraw() {
  if (!activeWebDuel || activeWebDuel.status !== 'active') return;
  const button = $('duel-offer-draw-button');
  button.disabled = true;

  const { data, error } = await sb.rpc('offer_opening_challenge_draw', {
    challenge_id: activeWebDuel.id
  });

  if (error) {
    button.disabled = false;
    return toast(readableError(error));
  }

  if (data) Object.assign(activeWebDuel, data);
  else {
    activeWebDuel.draw_offer_by = state.session.user.id;
    activeWebDuel.draw_offer_at = new Date().toISOString();
  }
  paintDuelDrawOffer();
  toast('Draw offered');
}

async function respondWebDuelDraw(accept) {
  if (!activeWebDuel || !activeWebDuel.draw_offer_by) return;

  const { data, error } = await sb.rpc('respond_opening_challenge_draw', {
    challenge_id: activeWebDuel.id,
    accept_draw: Boolean(accept)
  });

  if (error) return toast(readableError(error));

  if (accept) {
    if (data) Object.assign(activeWebDuel, data);
    activeWebDuel.status = 'completed';
    activeWebDuel.result = '1/2-1/2';
    stopDuelClock();
    paintWebDuel();
    toast('Draw agreed');
  } else {
    activeWebDuel.draw_offer_by = null;
    activeWebDuel.draw_offer_at = null;
    paintDuelDrawOffer();
    toast('Draw offer declined');
  }
}

function formatDuelClock(milliseconds) {
  const safe = Math.max(0, Number(milliseconds || 0));
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function duelColorForUser(duel, userId) {
  const challengerIsWhite = duel.challenger_color === 'white';
  if (userId === duel.challenger_id) return challengerIsWhite ? 'white' : 'black';
  if (userId === duel.opponent_id) return challengerIsWhite ? 'black' : 'white';
  return null;
}

function currentDuelClockValues() {
  if (!activeWebDuel) return { white: 600000, black: 600000 };

  let white = Number(activeWebDuel.white_time_ms ?? 600000);
  let black = Number(activeWebDuel.black_time_ms ?? 600000);

  if (activeWebDuel.status === 'active' &&
      activeWebDuel.clock_started_at &&
      activeWebDuel.turn_user_id) {
    const elapsed = Math.max(
      0,
      Date.now() - new Date(activeWebDuel.clock_started_at).getTime()
    );
    const activeColor = duelColorForUser(activeWebDuel, activeWebDuel.turn_user_id);
    if (activeColor === 'white') white -= elapsed;
    if (activeColor === 'black') black -= elapsed;
  }

  return { white: Math.max(0, white), black: Math.max(0, black) };
}

function paintDuelClock() {
  const panel = $('friend-duel-clocks');
  if (!panel || !activeWebDuel) return;

  panel.hidden = false;
  const values = currentDuelClockValues();
  $('friend-clock-white').textContent = formatDuelClock(values.white);
  $('friend-clock-black').textContent = formatDuelClock(values.black);

  const whiteUser = activeWebDuel.challenger_color === 'white'
    ? activeWebDuel.challenger_username
    : activeWebDuel.opponent_username;
  const blackUser = activeWebDuel.challenger_color === 'white'
    ? activeWebDuel.opponent_username
    : activeWebDuel.challenger_username;

  $('friend-clock-white-name').textContent = `White · ${whiteUser || ''}`;
  $('friend-clock-black-name').textContent = `Black · ${blackUser || ''}`;

  const activeColor = activeWebDuel.status === 'active'
    ? duelColorForUser(activeWebDuel, activeWebDuel.turn_user_id)
    : null;

  panel.querySelector('[data-color="white"]')
    ?.classList.toggle('active', activeColor === 'white');
  panel.querySelector('[data-color="black"]')
    ?.classList.toggle('active', activeColor === 'black');

  if ((values.white <= 0 || values.black <= 0) &&
      activeWebDuel.status === 'active') {
    const flaggingColor = values.white <= 0 ? 'white' : 'black';
    const winnerColor = flaggingColor === 'white' ? 'black' : 'white';
    const winnerChessColor = winnerColor === 'white' ? 'w' : 'b';

    $('duel-game-message').textContent =
      `${flaggingColor[0].toUpperCase() + flaggingColor.slice(1)} has run out of time.`;

    stopDuelClock();

    if (!sideHasPossibleMatingMaterial(webDuelGame, winnerChessColor)) {
      finishWebDuelAsDraw('timeout against insufficient mating material');
    } else {
      const result = winnerColor === 'white' ? '1-0' : '0-1';
      sb.rpc('finish_opening_challenge', {
        challenge_id: activeWebDuel.id,
        finish_reason: 'timeout',
        game_result: result
      }).then(({ error }) => {
        if (error) return console.warn('Could not finish timeout:', error);
        activeWebDuel.status = 'completed';
        activeWebDuel.result = result;
        paintWebDuel();
      });
    }
  }
}

function startDuelClock() {
  stopDuelClock();
  paintDuelClock();
  duelClockTimer = setInterval(paintDuelClock, 250);
}

function stopDuelClock() {
  if (duelClockTimer) clearInterval(duelClockTimer);
  duelClockTimer = null;
}

function webPiece(symbol) {
  const normalize = {
    P:'wP', R:'wR', N:'wN', B:'wB', Q:'wQ', K:'wK',
    p:'bP', r:'bR', n:'bN', b:'bB', q:'bQ', k:'bK',
    '♙':'wP', '♖':'wR', '♘':'wN', '♗':'wB', '♕':'wQ', '♔':'wK',
    '♟':'bP', '♜':'bR', '♞':'bN', '♝':'bB', '♛':'bQ', '♚':'bK',
    wP:'wP', wR:'wR', wN:'wN', wB:'wB', wQ:'wQ', wK:'wK',
    bP:'bP', bR:'bR', bN:'bN', bB:'bB', bQ:'bQ', bK:'bK'
  };

  const id = normalize[symbol];
  if (!id) return '';

  const color = id[0] === 'w' ? 'white' : 'black';
  const source = `./assets/pieces/bozo-custom/${id}.svg?v=2.7.10`;

  return `<img
    class="bozo-chess-piece bozo-chess-piece-${color}"
    src="${source}"
    onerror="this.onerror=null;this.src='./assets/pieces/bozo-classic/${id}.svg?v=2.7.10'"
    alt=""
    draggable="false"
    aria-hidden="true">`;
}

function fenBoard(fen) {
  const normalizedFen =
    !fen || fen === 'start' || fen === 'startpos'
      ? new Chess().fen()
      : fen;
  const boardPart = normalizedFen.split(' ')[0];
  return boardPart.split('/').map(rank => {
    const squares=[];
    for (const ch of rank) {
      if (/\d/.test(ch)) for(let i=0;i<Number(ch);i++) squares.push('');
      else squares.push(ch);
    }
    return squares;
  });
}

function myDuelColor(c) {
  return challengeColor(c).toLowerCase();
}

function paintWebDuel() {
  const c = activeWebDuel;
  const myTurn = c.turn_user_id === state.session.user.id;
  $('duel-turn-badge').textContent = c.status === 'completed'
    ? `Finished · ${c.result || ''}`
    : myTurn ? '● your turn' : 'waiting for opponent';
  const normalizedMoves = normalizeDuelMoveHistory(c.move_history);
  $('duel-game-message').textContent = myTurn
    ? (normalizedMoves.length < c.required_plies
        ? 'Book moves are enforced.'
        : 'The game is now out of book.')
    : 'Waiting for your opponent’s move…';

  const orientation = myDuelColor(c);
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
  const board = fenBoard(webDuelGame.fen());
  const html=[];
  for (const rankNum of ranks) {
    for (const file of files) {
      const row=8-rankNum, col=file.charCodeAt(0)-97;
      const square=`${file}${rankNum}`;
      const symbol=board[row][col];
      const piece=webDuelGame.get(square);
      html.push(`<button data-square="${square}"
                         data-piece-color="${piece?.color === 'b' ? 'black' : piece?.color === 'w' ? 'white' : ''}"
                         class="${selectedWebSquare===square?'selected':''}">
                   ${webPiece(symbol)}
                 </button>`);
    }
  }
  $('web-duel-board').innerHTML=html.join('');
  $('web-duel-board').querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => clickWebDuelSquare(button.dataset.square));
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (!duelRightMouseDown) toggleDuelSquare(button.dataset.square);
    });
    button.addEventListener('mousedown', event => {
      if (event.button !== 2) return;
      event.preventDefault();
      duelRightMouseDown = true;
      duelArrowStart = button.dataset.square;
    });
    button.addEventListener('mouseup', event => {
      if (event.button !== 2 || !duelArrowStart) return;
      event.preventDefault();
      const end = button.dataset.square;
      if (end !== duelArrowStart) addDuelArrow(duelArrowStart, end);
      duelArrowStart = null;
      setTimeout(() => { duelRightMouseDown = false; }, 0);
    });
  });

  paintDuelAnnotations();
  paintDuelClock();
  paintDuelDrawOffer();

  const moves = normalizeDuelMoveHistory(c.move_history);
  $('duel-move-list').innerHTML = renderDuelMoveRows(moves);
}

async function clickWebDuelSquare(square) {
  if (!activeWebDuel || activeWebDuel.status !== 'active') return;
  if (activeWebDuel.turn_user_id !== state.session.user.id) return toast('It is not your turn.');

  if (!selectedWebSquare) {
    const piece=webDuelGame.get(square);
    if (!piece || piece.color !== (myDuelColor(activeWebDuel)==='white'?'w':'b')) return;
    selectedWebSquare=square; paintWebDuel(); return;
  }

  let move=webDuelGame.move({from:selectedWebSquare,to:square,promotion:'q'});
  if (!move) {
    selectedWebSquare=null; paintWebDuel(); return;
  }

  const { data, error } = await sb.rpc('play_opening_challenge_move',{
    challenge_id:activeWebDuel.id,
    move_san:move.san,
    resulting_fen:webDuelGame.fen()
  });
  if (error) {
    webDuelGame.undo();
    selectedWebSquare=null;
    paintWebDuel();
    return toast(readableError(error));
  }
  activeWebDuel = data;
  duelLastSignature = duelStateSignature(data);
  selectedWebSquare = null;

  // Rebuild from the server response so both clients use the same canonical history.
  webDuelGame = replayWebDuelPosition(activeWebDuel);
  activeWebDuel.draw_offer_by = null;
  activeWebDuel.draw_offer_at = null;
  paintWebDuel();
  await checkAndFinishWebDuelRules();
  await refreshOpenWebDuel(activeWebDuel.id, { force: true });
}

async function resignWebDuel() {
  if (!activeWebDuel || !confirm('Resign this Opening Duel?')) return;
  const { error } = await sb.rpc('finish_opening_challenge',{
    challenge_id:activeWebDuel.id,finish_reason:'resign',game_result:null
  });
  if (error) return toast(readableError(error));
  closeWebDuel();
  await loadChallenges();
  toast('You resigned the duel');
}


window.addEventListener('focus', () => {
  if (activeWebDuel?.id && !$('challenge-game-modal').hidden) {
    refreshOpenWebDuel(activeWebDuel.id, { force: true }).catch(() => {});
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden &&
      activeWebDuel?.id &&
      !$('challenge-game-modal').hidden) {
    refreshOpenWebDuel(activeWebDuel.id, { force: true }).catch(() => {});
  }
});


/* ============================================================
   BOZO STUDIES — BRANCHING MOVE TREES
   ============================================================ */

let studyList = [];
let activeStudy = null;
let activeStudyChapter = null;
let studyNodes = [];
let studyNodeMap = new Map();
let selectedStudyNodeId = null;
let studySelectedSquare = null;
let studyBuilderOrientation = 'white';
let studySaveTimer = null;
let latestStudyCoachText = '';

function requireStudySession() {
  if (state.session?.user?.id) return true;
  openAuth('signin');
  return false;
}

async function renderStudies() {
  const signedOutPanel = $('studies-signed-out');
  const listView = $('studies-list-view');
  const editorView = $('study-editor-view');

  // A missing optional view must never interrupt authentication or routing.
  if (!signedOutPanel || !listView || !editorView) {
    console.warn('Studies interface is unavailable in this build.');
    return;
  }

  const signedIn = Boolean(state.session?.user?.id);
  signedOutPanel.hidden = signedIn;
  listView.hidden = !signedIn;
  editorView.hidden = true;

  if (!signedIn) return;

  $('studies-list-status').textContent = 'Loading your studies…';
  const { data, error } = await sb
    .from('studies')
    .select('id,title,description,visibility,created_at,updated_at')
    .eq('owner', state.session.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    $('studies-list-status').textContent = readableError(error);
    return;
  }

  studyList = data || [];
  $('studies-list-status').textContent =
    `${studyList.length} ${studyList.length === 1 ? 'study' : 'studies'}`;

  $('studies-grid').innerHTML = studyList.length
    ? studyList.map(study => `
        <article class="study-card" data-open-study="${study.id}">
          <div class="study-card-top">
            <span>${escapeHtml(study.visibility)}</span>
            <small>${new Date(study.updated_at || study.created_at).toLocaleDateString()}</small>
          </div>
          <h3>${escapeHtml(study.title)}</h3>
          <p>${escapeHtml(study.description || 'No description yet.')}</p>
          <button class="button secondary">Open study</button>
        </article>
      `).join('')
    : `
      <div class="empty-state studies-empty">
        <h2>Your first move tree starts here</h2>
        <p>Create a study from scratch or import a variation-rich PGN from Lichess.</p>
        <button class="button primary" id="empty-new-study">Create study</button>
      </div>
    `;

  $$('[data-open-study]').forEach(card =>
    card.addEventListener('click', () => openStudyEditor(card.dataset.openStudy))
  );
  $('empty-new-study')?.addEventListener('click', openNewStudyModal);
}

function openNewStudyModal() {
  if (!requireStudySession()) return;
  $('new-study-modal').hidden = false;
  $('new-study-status').textContent = '';
}

function openImportStudyModal() {
  if (!requireStudySession()) return;
  $('import-study-modal').hidden = false;
  $('import-study-status').textContent = '';
}

async function createStudyRecord({ title, description = '', visibility = 'private', chapterTitle = 'Chapter 1' }) {
  const userId = state.session?.user?.id;
  if (!userId) throw new Error('Sign in first.');

  const { data: study, error: studyError } = await sb
    .from('studies')
    .insert({
      owner: userId,
      title: title || 'Untitled Study',
      description,
      visibility
    })
    .select()
    .single();

  if (studyError) throw studyError;

  const { data: chapter, error: chapterError } = await sb
    .from('study_chapters')
    .insert({
      study_id: study.id,
      title: chapterTitle || 'Chapter 1',
      sort_order: 0,
      starting_fen: 'startpos'
    })
    .select()
    .single();

  if (chapterError) throw chapterError;

  const start = new Chess();
  const { data: root, error: rootError } = await sb
    .from('study_nodes')
    .insert({
      chapter_id: chapter.id,
      parent_id: null,
      ply: 0,
      san: null,
      uci: null,
      fen_before: start.fen(),
      fen_after: start.fen(),
      comment: '',
      is_main_line: true,
      sort_order: 0
    })
    .select()
    .single();

  if (rootError) throw rootError;

  return { study, chapter, root };
}

async function createNewStudy() {
  const button = $('create-study-submit');
  button.disabled = true;
  $('new-study-status').textContent = 'Creating…';

  try {
    const created = await createStudyRecord({
      title: $('new-study-title').value.trim(),
      description: $('new-study-description').value.trim(),
      visibility: $('new-study-visibility').value
    });
    $('new-study-modal').hidden = true;
    await openStudyEditor(created.study.id);
  } catch (error) {
    $('new-study-status').textContent = readableError(error);
  } finally {
    button.disabled = false;
  }
}

async function openStudyEditor(studyId) {
  const [{ data: study, error: studyError }, { data: chapters, error: chapterError }] =
    await Promise.all([
      sb.from('studies').select('*').eq('id', studyId).single(),
      sb.from('study_chapters').select('*').eq('study_id', studyId).order('sort_order').limit(1)
    ]);

  if (studyError) return toast(readableError(studyError));
  if (chapterError || !chapters?.length) return toast('This study has no chapter.');

  activeStudy = study;
  activeStudyChapter = chapters[0];

  const { data: nodes, error: nodesError } = await sb
    .from('study_nodes')
    .select('*')
    .eq('chapter_id', activeStudyChapter.id)
    .order('ply')
    .order('sort_order');

  if (nodesError) return toast(readableError(nodesError));

  studyNodes = nodes || [];

  // Older or partially-created studies may not contain a root node. Repair
  // them automatically instead of leaving the board blank.
  if (!studyNodes.some(node => !node.parent_id)) {
    const start = new Chess();
    const { data: repairedRoot, error: rootError } = await sb
      .from('study_nodes')
      .insert({
        chapter_id: activeStudyChapter.id,
        parent_id: null,
        ply: 0,
        san: null,
        uci: null,
        fen_before: start.fen(),
        fen_after: start.fen(),
        comment: '',
        nag: '',
        is_main_line: true,
        sort_order: 0
      })
      .select()
      .single();

    if (rootError) return toast(readableError(rootError));
    studyNodes.unshift(repairedRoot);
  }

  rebuildStudyNodeMap();
  const root = studyNodes.find(node => !node.parent_id);
  selectedStudyNodeId = root?.id || studyNodes[0]?.id || null;
  studySelectedSquare = null;

  $('studies-list-view').hidden = true;
  $('study-editor-view').hidden = false;
  $('study-title-input').value = activeStudy.title;
  $('study-chapter-title-input').value = activeStudyChapter.title;
  $('study-autosave-state').textContent = 'Saved';

  renderStudyEditor();
}

function rebuildStudyNodeMap() {
  studyNodeMap = new Map(studyNodes.map(node => [node.id, node]));
}

function selectedStudyNode() {
  return studyNodeMap.get(selectedStudyNodeId) || null;
}

function studyChildren(parentId) {
  return studyNodes
    .filter(node => node.parent_id === parentId)
    .sort((a, b) =>
      Number(b.is_main_line) - Number(a.is_main_line) ||
      Number(a.sort_order) - Number(b.sort_order) ||
      String(a.created_at).localeCompare(String(b.created_at))
    );
}

function studyPathTo(nodeId) {
  const path = [];
  let node = studyNodeMap.get(nodeId);
  while (node) {
    path.unshift(node);
    node = node.parent_id ? studyNodeMap.get(node.parent_id) : null;
  }
  return path;
}

function studyGameAtNode(nodeId) {
  const selected = studyNodeMap.get(nodeId);

  // Saved FEN is the canonical source. Replaying SAN remains a fallback for
  // imported legacy nodes.
  if (selected?.fen_after && selected.fen_after !== 'startpos') {
    try {
      return new Chess(selected.fen_after);
    } catch (error) {
      console.warn('Invalid saved study FEN; replaying moves instead.', error);
    }
  }

  const game = new Chess();
  const path = studyPathTo(nodeId).filter(node => node.san);
  for (const node of path) {
    if (!game.move(node.san, { sloppy: true })) {
      console.warn('Could not replay study node', node);
      break;
    }
  }
  return game;
}

function renderStudyEditor() {
  paintStudyBoard();
  renderStudyMoveTree();
  renderStudyInspector();
}

function paintStudyBoard() {
  const boardElement = $('study-builder-board');
  const node = selectedStudyNode();
  if (!boardElement) return;
  if (!node) {
    boardElement.innerHTML =
      '<div class="study-board-error">No starting position was found.</div>';
    return;
  }
  const game = studyGameAtNode(node.id);
  const board = fenBoard(game.fen());
  const ranks = studyBuilderOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = studyBuilderOrientation === 'white'
    ? ['a','b','c','d','e','f','g','h']
    : ['h','g','f','e','d','c','b','a'];

  const legalTargets = studySelectedSquare
    ? game.moves({ square: studySelectedSquare, verbose: true }).map(move => move.to)
    : [];

  boardElement.innerHTML = ranks.flatMap(rank =>
    files.map(file => {
      const square = `${file}${rank}`;
      const symbol = board[8 - rank][file.charCodeAt(0) - 97];
      const piece = game.get(square);
      const classes = [];
      if (square === studySelectedSquare) classes.push('study-selected-square');
      if (legalTargets.includes(square)) classes.push('study-legal-square');

      return `<button type="button"
                      data-study-square="${square}"
                      class="${classes.join(' ')}"
                      data-piece-color="${piece?.color || ''}">
                ${webPiece(symbol)}
              </button>`;
    })
  ).join('');

  $$('[data-study-square]').forEach(button =>
    button.addEventListener('click', () => handleStudySquare(button.dataset.studySquare))
  );

  const path = studyPathTo(node.id).filter(item => item.san);
  $('study-position-label').textContent = node.san
    ? `${Math.ceil(node.ply / 2)}${node.ply % 2 ? '.' : '...'} ${node.san}`
    : 'Starting position';
  $('study-fen-label').textContent = game.fen();
}

async function handleStudySquare(square) {
  const node = selectedStudyNode();
  if (!node || !activeStudyChapter) return;

  const game = studyGameAtNode(node.id);
  const piece = game.get(square);

  if (!studySelectedSquare) {
    if (piece && piece.color === game.turn()) {
      studySelectedSquare = square;
      paintStudyBoard();
    }
    return;
  }

  if (piece && piece.color === game.turn()) {
    studySelectedSquare = square;
    paintStudyBoard();
    return;
  }

  const from = studySelectedSquare;
  studySelectedSquare = null;
  const candidate = game.moves({ square: from, verbose: true }).find(move => move.to === square);
  if (!candidate) {
    paintStudyBoard();
    return toast('That move is not legal.');
  }

  const played = game.move({
    from,
    to: square,
    promotion: candidate.promotion || 'q'
  });
  if (!played) return;

  const existing = studyChildren(node.id).find(
    child => reviewCleanSan(child.san) === reviewCleanSan(played.san)
  );

  if (existing) {
    selectedStudyNodeId = existing.id;
    renderStudyEditor();
    return;
  }

  $('study-autosave-state').textContent = 'Saving move…';
  const siblings = studyChildren(node.id);
  const { data: inserted, error } = await sb
    .from('study_nodes')
    .insert({
      chapter_id: activeStudyChapter.id,
      parent_id: node.id,
      ply: node.ply + 1,
      san: played.san,
      uci: `${played.from}${played.to}${played.promotion || ''}`,
      fen_before: node.fen_after || studyGameAtNode(node.id).fen(),
      fen_after: game.fen(),
      comment: '',
      nag: '',
      is_main_line: siblings.length === 0,
      sort_order: siblings.length
    })
    .select()
    .single();

  if (error) {
    $('study-autosave-state').textContent = 'Save failed';
    return toast(readableError(error));
  }

  studyNodes.push(inserted);
  rebuildStudyNodeMap();
  selectedStudyNodeId = inserted.id;
  $('study-autosave-state').textContent = 'Saved';
  renderStudyEditor();
}

function renderStudyMoveTree() {
  const root = studyNodes.find(node => !node.parent_id);
  if (!root) {
    $('study-move-tree').innerHTML = '<p>No root position found.</p>';
    return;
  }

  const renderBranch = (parentId, depth = 0) => {
    const children = studyChildren(parentId);
    if (!children.length) return '';

    return `<div class="study-tree-level" style="--study-depth:${depth}">
      ${children.map((node, index) => `
        <div class="study-tree-node-wrap">
          <button class="study-tree-node ${node.id === selectedStudyNodeId ? 'active' : ''} ${node.is_main_line ? 'main-line' : 'variation'}"
                  data-study-node="${node.id}">
            <span>${Math.ceil(node.ply / 2)}${node.ply % 2 ? '.' : '...'}</span>
            <b>${escapeHtml(node.san || '')}</b>
            ${node.comment ? '<i title="Has note">●</i>' : ''}
          </button>
          ${renderBranch(node.id, depth + 1)}
        </div>
      `).join('')}
    </div>`;
  };

  $('study-move-tree').innerHTML = `
    <button class="study-tree-root ${root.id === selectedStudyNodeId ? 'active' : ''}"
            data-study-node="${root.id}">Starting position</button>
    ${renderBranch(root.id)}
  `;

  $$('[data-study-node]').forEach(button =>
    button.addEventListener('click', () => {
      selectedStudyNodeId = button.dataset.studyNode;
      studySelectedSquare = null;
      renderStudyEditor();
    })
  );
}

function renderStudyInspector() {
  const node = selectedStudyNode();
  if (!node) return;
  $('study-node-comment').value = node.comment || '';
  $('study-delete-variation').disabled = !node.parent_id;
  $('study-promote-button').disabled = !node.parent_id || node.is_main_line;
}

function scheduleStudyMetadataSave() {
  clearTimeout(studySaveTimer);
  $('study-autosave-state').textContent = 'Saving…';
  studySaveTimer = setTimeout(saveStudyMetadata, 500);
}

async function saveStudyMetadata() {
  if (!activeStudy || !activeStudyChapter) return;

  const title = $('study-title-input').value.trim() || 'Untitled Study';
  const chapterTitle = $('study-chapter-title-input').value.trim() || 'Chapter 1';

  const [{ error: studyError }, { error: chapterError }] = await Promise.all([
    sb.from('studies').update({ title }).eq('id', activeStudy.id),
    sb.from('study_chapters').update({ title: chapterTitle }).eq('id', activeStudyChapter.id)
  ]);

  if (studyError || chapterError) {
    $('study-autosave-state').textContent = 'Save failed';
    return;
  }

  activeStudy.title = title;
  activeStudyChapter.title = chapterTitle;
  $('study-autosave-state').textContent = 'Saved';
}

async function saveStudyNote() {
  const node = selectedStudyNode();
  if (!node) return;
  const comment = $('study-node-comment').value.trim();
  $('study-autosave-state').textContent = 'Saving note…';

  const { error } = await sb
    .from('study_nodes')
    .update({ comment })
    .eq('id', node.id);

  if (error) {
    $('study-autosave-state').textContent = 'Save failed';
    return toast(readableError(error));
  }

  node.comment = comment;
  $('study-autosave-state').textContent = 'Saved';
  renderStudyMoveTree();
}

async function promoteStudyVariation() {
  const node = selectedStudyNode();
  if (!node?.parent_id) return;

  $('study-autosave-state').textContent = 'Promoting…';
  const siblings = studyChildren(node.parent_id);
  const siblingIds = siblings.map(item => item.id);

  if (siblingIds.length) {
    const { error: clearError } = await sb
      .from('study_nodes')
      .update({ is_main_line: false })
      .in('id', siblingIds);
    if (clearError) return toast(readableError(clearError));
  }

  const { error } = await sb
    .from('study_nodes')
    .update({ is_main_line: true, sort_order: 0 })
    .eq('id', node.id);

  if (error) return toast(readableError(error));

  siblings.forEach(item => item.is_main_line = item.id === node.id);
  $('study-autosave-state').textContent = 'Saved';
  renderStudyMoveTree();
}

function collectStudyDescendants(nodeId) {
  const collected = [];
  const visit = id => {
    for (const child of studyChildren(id)) {
      collected.push(child.id);
      visit(child.id);
    }
  };
  visit(nodeId);
  return collected;
}

async function deleteStudyVariation() {
  const node = selectedStudyNode();
  if (!node?.parent_id) return;
  if (!confirm(`Delete ${node.san} and every continuation below it?`)) return;

  const parentId = node.parent_id;
  const { error } = await sb.from('study_nodes').delete().eq('id', node.id);
  if (error) return toast(readableError(error));

  const removed = new Set([node.id, ...collectStudyDescendants(node.id)]);
  studyNodes = studyNodes.filter(item => !removed.has(item.id));
  rebuildStudyNodeMap();
  selectedStudyNodeId = parentId;
  renderStudyEditor();
  toast('Variation deleted');
}

async function deleteActiveStudy() {
  if (!activeStudy || !confirm(`Delete "${activeStudy.title}" permanently?`)) return;
  const { error } = await sb.from('studies').delete().eq('id', activeStudy.id);
  if (error) return toast(readableError(error));
  activeStudy = null;
  activeStudyChapter = null;
  studyNodes = [];
  selectedStudyNodeId = null;
  await renderStudies();
  toast('Study deleted');
}

function tokenizeStudyPgn(pgn) {
  return String(pgn || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/;[^\n\r]*/g, ' ')
    .replace(/\{([^}]*)\}/g, ' {$1} ')
    .replace(/(\(|\))/g, ' $1 ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function parseStudyPgnTree(pgn) {
  const tokens = tokenizeStudyPgn(pgn);
  const root = { san: null, comment: '', children: [] };
  const positionStack = [];
  let current = root;
  let game = new Chess();
  let lastNode = root;
  let pendingComment = '';

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (token === '(') {
      const parent = lastNode.parent || root;
      positionStack.push({ current, gameFen: game.fen(), lastNode });
      current = parent;
      game = new Chess(parent.fenAfter || new Chess().fen());
      lastNode = parent;
      continue;
    }

    if (token === ')') {
      const saved = positionStack.pop();
      if (saved) {
        current = saved.current;
        game = new Chess(saved.gameFen);
        lastNode = saved.lastNode;
      }
      continue;
    }

    if (token.startsWith('{')) {
      pendingComment = token.replace(/^\{|\}$/g, '');
      while (!token.endsWith('}') && index + 1 < tokens.length) {
        index++;
        pendingComment += ` ${tokens[index].replace(/\}$/, '')}`;
        if (tokens[index].endsWith('}')) break;
      }
      if (lastNode !== root) lastNode.comment = pendingComment.trim();
      pendingComment = '';
      continue;
    }

    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    if (/^[!?]+$/.test(token)) {
      if (lastNode !== root) lastNode.nag = token;
      continue;
    }

    const before = game.fen();
    const move = game.move(token, { sloppy: true });
    if (!move) continue;

    let node = current.children.find(
      child => reviewCleanSan(child.san) === reviewCleanSan(move.san)
    );
    if (!node) {
      node = {
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion || ''}`,
        fenBefore: before,
        fenAfter: game.fen(),
        comment: pendingComment,
        nag: '',
        children: [],
        parent: current
      };
      current.children.push(node);
    }

    current = node;
    lastNode = node;
    pendingComment = '';
  }

  return root;
}

async function persistImportedTree(root, chapterId, rootId) {
  const queue = root.children.map((node, index) => ({
    node,
    parentId: rootId,
    ply: 1,
    main: index === 0,
    sortOrder: index
  }));

  while (queue.length) {
    const item = queue.shift();
    const { data: inserted, error } = await sb
      .from('study_nodes')
      .insert({
        chapter_id: chapterId,
        parent_id: item.parentId,
        ply: item.ply,
        san: item.node.san,
        uci: item.node.uci,
        fen_before: item.node.fenBefore,
        fen_after: item.node.fenAfter,
        comment: item.node.comment || '',
        nag: item.node.nag || '',
        is_main_line: item.main,
        sort_order: item.sortOrder
      })
      .select()
      .single();

    if (error) throw error;

    item.node.children.forEach((child, index) => queue.push({
      node: child,
      parentId: inserted.id,
      ply: item.ply + 1,
      main: index === 0,
      sortOrder: index
    }));
  }
}

async function importStudyPgn() {
  const pgn = $('import-study-pgn').value.trim();
  if (!pgn) {
    $('import-study-status').textContent = 'Paste a PGN first.';
    return;
  }

  const button = $('import-study-submit');
  button.disabled = true;
  $('import-study-status').textContent = 'Parsing variations…';

  try {
    const tree = parseStudyPgnTree(pgn);
    if (!tree.children.length) throw new Error('No legal moves were found in this PGN.');

    const created = await createStudyRecord({
      title: $('import-study-title').value.trim() || 'Imported Study',
      chapterTitle: $('import-chapter-title').value.trim() || 'Chapter 1'
    });

    $('import-study-status').textContent = 'Saving move tree…';
    await persistImportedTree(tree, created.chapter.id, created.root.id);
    $('import-study-modal').hidden = true;
    await openStudyEditor(created.study.id);
    toast('Study imported');
  } catch (error) {
    $('import-study-status').textContent = readableError(error);
  } finally {
    button.disabled = false;
  }
}

function studyNodePgn(node, moveNumber, side) {
  const prefix = side === 'w' ? `${moveNumber}. ` : `${moveNumber}... `;
  const comment = node.comment ? ` {${node.comment.replace(/[{}]/g, '')}}` : '';
  return `${prefix}${node.san}${node.nag || ''}${comment}`;
}

function exportStudyPgnText() {
  const root = studyNodes.find(node => !node.parent_id);
  if (!root) return '';

  const renderFrom = (parentId, moveNumber = 1, side = 'w') => {
    const children = studyChildren(parentId);
    if (!children.length) return '';

    const main = children.find(node => node.is_main_line) || children[0];
    const variations = children.filter(node => node.id !== main.id);

    let text = studyNodePgn(main, moveNumber, side);
    const nextMove = side === 'b' ? moveNumber + 1 : moveNumber;
    const nextSide = side === 'w' ? 'b' : 'w';

    for (const variation of variations) {
      const variationText =
        studyNodePgn(variation, moveNumber, side) +
        ' ' +
        renderFrom(variation.id, nextMove, nextSide);
      text += ` (${variationText.trim()})`;
    }

    const continuation = renderFrom(main.id, nextMove, nextSide);
    if (continuation) text += ` ${continuation}`;
    return text.trim();
  };

  return `[Event "${(activeStudy?.title || 'BOZO Study').replace(/"/g, "'")}"]
[Chapter "${(activeStudyChapter?.title || 'Chapter 1').replace(/"/g, "'")}"]
[Site "BOZO'S Opening Trainer"]

${renderFrom(root.id)} *`;
}

function exportActiveStudy() {
  const pgn = exportStudyPgnText();
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(activeStudy?.title || 'bozo-study').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pgn`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function askStudyCoach() {
  const node = selectedStudyNode();
  if (!node) return;
  const path = studyPathTo(node.id).filter(item => item.san);
  const siblings = node.parent_id
    ? studyChildren(node.parent_id).filter(item => item.id !== node.id)
    : [];
  const continuation = [];
  let cursor = node;
  for (let index = 0; index < 6; index++) {
    const next = studyChildren(cursor.id).find(item => item.is_main_line) || studyChildren(cursor.id)[0];
    if (!next) break;
    continuation.push(next.san);
    cursor = next;
  }

  const studyCoachFacts = verifiedCoachFacts(node.fen_after, node.fen_before, node.san || '');
  const button = $('ask-study-coach');
  button.disabled = true;
  button.textContent = 'Thinking…';
  $('study-coach-answer').textContent = 'BOZO is reading the branch…';

  try {
    const { data, error } = await sb.functions.invoke('explain-move', {
      body: {
        mode: 'study',
        gameStatus: 'study',
        move: node.san || 'Starting position',
        fen: node.fen_after,
        fenBefore: node.fen_before,
        question: $('study-coach-question').value.trim() ||
          'Explain why this move belongs in the study, compare its sibling variations, and give the practical plan.',
        opening: activeStudy?.title || 'Study',
        variation: activeStudyChapter?.title || 'Chapter',
        moveHistory: path.map(item => item.san),
        contextBeforeMoves: path.slice(-8).map(item => item.san),
        actualContinuation: continuation,
        siblingVariations: siblings.map(item => item.san),
        existingNote: node.comment || '',
        classification: 'Study move',
        verifiedBoardFacts: studyCoachFacts,
        strictGrounding: true
      }
    });
    if (error) throw error;

    const explanation = sanitizeCoachExplanation(data?.explanation || data, studyCoachFacts);
    latestStudyCoachText = [
      explanation?.summary,
      explanation?.howWeGotHere,
      explanation?.comparison,
      ...(explanation?.practicalPlan || [])
    ].filter(Boolean).join('\n\n');

    $('study-coach-answer').innerHTML = `
      <p>${escapeHtml(explanation?.summary || 'No explanation returned.')}</p>
      ${explanation?.howWeGotHere ? `<div><b>Context</b><p>${escapeHtml(explanation.howWeGotHere)}</p></div>` : ''}
      ${explanation?.comparison ? `<div><b>Variation comparison</b><p>${escapeHtml(explanation.comparison)}</p></div>` : ''}
      ${Array.isArray(explanation?.practicalPlan) ? `
        <div><b>Practical plan</b>
          <ol>${explanation.practicalPlan.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
        </div>` : ''}
      ${explanation?.watchFor ? `<div class="coach-warning"><b>Watch for:</b><span>${escapeHtml(explanation.watchFor)}</span></div>` : ''}
    `;
    $('save-coach-as-note').hidden = !latestStudyCoachText;
  } catch (error) {
    $('study-coach-answer').textContent = readableError(error);
  } finally {
    button.disabled = false;
    button.textContent = 'Ask BOZO Coach';
  }
}

async function saveCoachAsStudyNote() {
  if (!latestStudyCoachText) return;
  const existing = $('study-node-comment').value.trim();
  $('study-node-comment').value =
    [existing, `BOZO Coach:\n${latestStudyCoachText}`].filter(Boolean).join('\n\n');
  await saveStudyNote();
}

function setStudyInspectorTab(tab) {
  $$('[data-study-tab]').forEach(button =>
    button.classList.toggle('active', button.dataset.studyTab === tab)
  );
  $('study-notes-tab').hidden = tab !== 'notes';
  $('study-coach-tab').hidden = tab !== 'coach';
}

$('new-study-button')?.addEventListener('click', openNewStudyModal);
$('import-study-button')?.addEventListener('click', openImportStudyModal);
$('close-new-study-modal')?.addEventListener('click', () => { const modal = $('new-study-modal'); if (modal) modal.hidden = true; });
$('close-import-study-modal')?.addEventListener('click', () => { const modal = $('import-study-modal'); if (modal) modal.hidden = true; });
$('create-study-submit')?.addEventListener('click', createNewStudy);
$('import-study-submit')?.addEventListener('click', importStudyPgn);
$('close-study-editor')?.addEventListener('click', renderStudies);
$('study-title-input')?.addEventListener('input', scheduleStudyMetadataSave);
$('study-chapter-title-input')?.addEventListener('input', scheduleStudyMetadataSave);
$('study-save-note')?.addEventListener('click', saveStudyNote);
$('study-promote-button')?.addEventListener('click', promoteStudyVariation);
$('study-delete-variation')?.addEventListener('click', deleteStudyVariation);
$('study-delete-button')?.addEventListener('click', deleteActiveStudy);
$('study-export-button')?.addEventListener('click', exportActiveStudy);
$('study-start-button')?.addEventListener('click', () => {
  const root = studyNodes.find(node => !node.parent_id);
  if (root) {
    selectedStudyNodeId = root.id;
    studySelectedSquare = null;
    renderStudyEditor();
  }
});
$('study-previous-button')?.addEventListener('click', () => {
  const node = selectedStudyNode();
  if (node?.parent_id) {
    selectedStudyNodeId = node.parent_id;
    studySelectedSquare = null;
    renderStudyEditor();
  }
});
$('study-flip-button')?.addEventListener('click', () => {
  studyBuilderOrientation = studyBuilderOrientation === 'white' ? 'black' : 'white';
  paintStudyBoard();
});
$$('[data-study-tab]').forEach(button =>
  button.addEventListener('click', () => setStudyInspectorTab(button.dataset.studyTab))
);
$('ask-study-coach')?.addEventListener('click', askStudyCoach);
$('save-coach-as-note')?.addEventListener('click', saveCoachAsStudyNote);


/* ============================================================
   BOZO BOARD DISPLAY — CONSISTENT PIECES + RESPONSIVE SIZING
   ============================================================ */
const BOZO_BOARD_SIZES = ['compact', 'medium', 'large'];

function currentBozoBoardSize() {
  const saved = localStorage.getItem('bozo_board_size');
  return BOZO_BOARD_SIZES.includes(saved) ? saved : 'medium';
}

function applyBozoBoardSize(size) {
  const resolved = BOZO_BOARD_SIZES.includes(size) ? size : 'medium';
  document.documentElement.dataset.bozoBoardSize = resolved;
  localStorage.setItem('bozo_board_size', resolved);
  document.querySelectorAll('[data-bozo-board-size]').forEach(button => {
    button.classList.toggle('active', button.dataset.bozoBoardSize === resolved);
  });
  window.dispatchEvent(new Event('resize'));
}

function makeBozoBoardSizeControl() {
  const control = document.createElement('div');
  control.className = 'bozo-board-size-control';
  control.innerHTML = `
    <span>Board size</span>
    ${BOZO_BOARD_SIZES.map(size => `
      <button type="button" data-bozo-board-size="${size}">
        ${size[0].toUpperCase() + size.slice(1)}
      </button>`).join('')}
  `;
  control.querySelectorAll('[data-bozo-board-size]').forEach(button => {
    button.addEventListener('click', () => applyBozoBoardSize(button.dataset.bozoBoardSize));
  });
  return control;
}

function initializeBozoBoardDisplay() {
  applyBozoBoardSize(currentBozoBoardSize());
  const targets = [
    '#study-modal .study-board-shell',
    '#study-editor-view .study-board-shell',
    '#challenge-game-modal .friend-board-shell',
    '#bot-game-modal .bot-board-shell',
    '#view-review .review-board-frame'
  ];
  targets.forEach(selector => {
    const shell = document.querySelector(selector);
    if (!shell || shell.parentElement?.querySelector(':scope > .bozo-board-size-control')) return;
    shell.insertAdjacentElement('beforebegin', makeBozoBoardSizeControl());
  });
  applyBozoBoardSize(currentBozoBoardSize());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBozoBoardDisplay, { once:true });
} else {
  initializeBozoBoardDisplay();
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

sb.auth.onAuthStateChange(async (_event, session) => {
  state.session = session;
  await loadIdentity();
});

(async function init() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  await loadIdentity();
  queueMicrotask(() => route((location.hash || '#home').slice(1)));
})();


// BOZO v2.7.6 — public beta notice
function openPublicBetaModal() { $('public-beta-modal').hidden = false; }
function closePublicBetaModal() { $('public-beta-modal').hidden = true; }
$('public-beta-learn-more').addEventListener('click', openPublicBetaModal);
$('close-public-beta-modal').addEventListener('click', closePublicBetaModal);
$('public-beta-modal-close-button').addEventListener('click', closePublicBetaModal);
$('public-beta-modal').addEventListener('click', event => {
  if (event.target.id === 'public-beta-modal') closePublicBetaModal();
});
function openBetaIssueReport() {
  closePublicBetaModal();
  openCommunityFeedback('report');
}
$('public-beta-report').addEventListener('click', openBetaIssueReport);
$('public-beta-modal-report').addEventListener('click', openBetaIssueReport);


// WEB v2.9.0 — Recall Training Engine + Opening Puzzles
let trainOpening = null;
let trainGame = null;
let trainMoves = [];
let trainUserSide = 'white';
let trainPly = 0;
let trainSelectedSquare = null;
let trainAttemptsForPly = 0;
let trainStats = { userMoves: 0, firstTry: 0, mistakes: 0 };
let trainSearchTimer = null;

function trainingStorageKey(id) { return `bozo_training_v1_${id}`; }

function prepareTrainPage() {
  if (!$('train-session') || !$('train-picker')) return;
  if (!trainOpening) {
    $('train-picker').hidden = false;
    $('train-session').hidden = true;
    $('train-results').hidden = true;
  }
}

$('train-search-button')?.addEventListener('click', () => searchTrainOpenings($('train-opening-search').value));
$('train-opening-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') searchTrainOpenings(e.currentTarget.value); });
$('train-opening-search')?.addEventListener('input', e => {
  clearTimeout(trainSearchTimer);
  trainSearchTimer = setTimeout(() => { if (e.currentTarget.value.trim().length >= 2) searchTrainOpenings(e.currentTarget.value); }, 280);
});
$('train-new-line')?.addEventListener('click', () => resetCurrentTrainMode());
$('train-restart')?.addEventListener('click', () => beginTrainSession());
$('train-again')?.addEventListener('click', () => beginTrainSession());
$('train-study-line')?.addEventListener('click', () => { if (trainOpening) openStudyOpening(trainOpening.id, { repertoireSide: trainUserSide }); });
$('train-hint')?.addEventListener('click', showTrainHint);
$('train-show-answer')?.addEventListener('click', showTrainAnswer);

async function searchTrainOpenings(query = '') {
  const root = $('train-opening-results');
  if (!root) return;
  const text = query.trim();
  root.innerHTML = '<div class="empty-state"><div>⌛</div><b>Searching theory…</b></div>';
  let req = sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type').eq('status','published').limit(60);
  if (text) req = req.or(`name.ilike.%${text}%,variation.ilike.%${text}%,eco.ilike.%${text}%`);
  const { data, error } = await req.order('name');
  if (error) { root.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load openings</b><span>${escapeHtml(readableError(error))}</span></div>`; return; }
  const rows = (data || []).filter(row => row.pgn);
  if (!rows.length) { root.innerHTML = '<div class="empty-state"><div>♟</div><b>No matching lines</b><span>Try a broader opening name.</span></div>'; return; }
  root.innerHTML = rows.slice(0, 40).map(row => {
    const side = inferOpeningSide(row);
    return `<button class="train-opening-result" type="button" data-train-opening="${row.id}"><span><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.variation || 'Main Line')} · ${escapeHtml(row.eco || 'ECO —')}</small></span><em>${side === 'neutral' ? 'Choose side' : `Train ${side}`}</em></button>`;
  }).join('');
  root.querySelectorAll('[data-train-opening]').forEach(button => button.addEventListener('click', () => startTrainingOpening(button.dataset.trainOpening)));
}

async function startTrainingOpening(openingId) {
  route('train');
  const { data, error } = await sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type').eq('id', openingId).maybeSingle();
  if (error || !data) return toast(readableError(error || new Error('Opening not found')));
  const parser = new Chess();
  if (!parser.load_pgn(data.pgn, { sloppy: true })) return toast('This opening line could not be loaded.');
  trainOpening = data;
  trainMoves = parser.history();
  const inferred = inferOpeningSide(data);
  trainUserSide = inferred === 'black' ? 'black' : 'white';
  beginTrainSession();
}
window.startTrainingOpening = startTrainingOpening;

function beginTrainSession() {
  if (!trainOpening || !trainMoves.length) return;
  trainGame = new Chess();
  trainPly = 0;
  trainSelectedSquare = null;
  trainAttemptsForPly = 0;
  trainStats = { userMoves: 0, firstTry: 0, mistakes: 0 };
  $('train-picker').hidden = true;
  $('train-results').hidden = true;
  $('train-session').hidden = false;
  $('train-title').textContent = trainOpening.name;
  $('train-subtitle').textContent = `${trainOpening.variation || 'Main Line'} · ${trainOpening.eco || 'ECO —'} · training as ${trainUserSide}`;
  setTrainFeedback('neutral', 'Your move.', 'Find the repertoire move from memory.');
  advanceTrainOpponentMoves();
  paintTrainBoard();
  updateTrainUI();
}

function trainSideToMove() { return trainGame?.turn() === 'b' ? 'black' : 'white'; }
function isTrainUserTurn() { return trainSideToMove() === trainUserSide; }

function advanceTrainOpponentMoves() {
  while (trainPly < trainMoves.length && !isTrainUserTurn()) {
    const san = trainMoves[trainPly];
    const move = trainGame.move(san, { sloppy: true });
    if (!move) break;
    trainPly++;
  }
  if (trainPly >= trainMoves.length) finishTrainSession();
}

function paintTrainBoard() {
  const boardEl = $('train-board');
  if (!boardEl || !trainGame) return;
  const orientation = trainUserSide;
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
  const html = [];
  for (const rank of ranks) for (const file of files) {
    const square = `${file}${rank}`;
    const piece = trainGame.get(square);
    const symbol = piece ? `${piece.color}${piece.type.toUpperCase()}` : '';
    html.push(`<button type="button" data-square="${square}" data-piece-color="${piece?.color === 'w' ? 'white' : piece?.color === 'b' ? 'black' : ''}" class="${trainSelectedSquare === square ? 'selected' : ''}">${webPiece(symbol)}</button>`);
  }
  boardEl.innerHTML = html.join('');
  boardEl.querySelectorAll('button').forEach(button => button.addEventListener('click', () => clickTrainSquare(button.dataset.square)));
}

function clickTrainSquare(square) {
  if (!trainGame || trainPly >= trainMoves.length || !isTrainUserTurn()) return;
  const myColor = trainUserSide === 'white' ? 'w' : 'b';
  if (!trainSelectedSquare) {
    const piece = trainGame.get(square);
    if (!piece || piece.color !== myColor) return;
    trainSelectedSquare = square; paintTrainBoard(); return;
  }
  const from = trainSelectedSquare;
  trainSelectedSquare = null;
  const move = trainGame.move({ from, to: square, promotion: 'q' });
  if (!move) { paintTrainBoard(); return; }
  const expectedSan = trainMoves[trainPly];
  trainGame.undo();
  trainAttemptsForPly++;
  if (move.san !== expectedSan) {
    trainStats.mistakes++;
    setTrainFeedback('wrong', 'Not quite.', trainAttemptsForPly === 1 ? 'Try that position again.' : 'Use Hint if you want a nudge.');
    paintTrainBoard(); updateTrainUI(); return;
  }
  trainGame.move(expectedSan, { sloppy: true });
  trainStats.userMoves++;
  if (trainAttemptsForPly === 1) trainStats.firstTry++;
  trainPly++;
  setTrainFeedback('correct', 'Correct!', expectedSan);
  trainAttemptsForPly = 0;
  advanceTrainOpponentMoves();
  paintTrainBoard(); updateTrainUI();
}

function expectedTrainMove() {
  if (!trainGame || trainPly >= trainMoves.length || !isTrainUserTurn()) return null;
  const clone = new Chess(trainGame.fen());
  return clone.move(trainMoves[trainPly], { sloppy: true });
}

function showTrainHint() {
  const move = expectedTrainMove();
  if (!move) return;
  const piece = trainGame.get(move.from);
  const names = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };
  setTrainFeedback('hint', 'Hint', `Look for a ${names[piece?.type] || 'piece'} move from the ${move.from[0]}-file.`);
}
function showTrainAnswer() {
  const move = expectedTrainMove();
  if (!move) return;
  setTrainFeedback('answer', 'Answer', `${move.san} · ${move.from} → ${move.to}`);
}
function setTrainFeedback(stateName, title, copy) {
  const el = $('train-feedback'); if (!el) return;
  el.dataset.state = stateName; el.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(copy)}</span>`;
}
function updateTrainUI() {
  if (!trainGame) return;
  const totalUserMoves = trainMoves.reduce((count, _, i) => count + (((i % 2 === 0) ? 'white' : 'black') === trainUserSide ? 1 : 0), 0);
  const accuracy = trainStats.userMoves ? Math.round(trainStats.firstTry / trainStats.userMoves * 100) : 0;
  $('train-first-try').textContent = `${accuracy}%`;
  $('train-mistakes').textContent = trainStats.mistakes;
  $('train-progress').textContent = `${trainStats.userMoves}/${totalUserMoves}`;
  $('train-track-fill').style.width = `${totalUserMoves ? trainStats.userMoves / totalUserMoves * 100 : 0}%`;
  $('train-turn-label').textContent = trainPly >= trainMoves.length ? 'Line complete' : `${trainSideToMove()[0].toUpperCase()+trainSideToMove().slice(1)} to move`;
  $('train-instruction').textContent = isTrainUserTurn() ? 'Find your repertoire move.' : 'BOZO is playing the book reply.';
  const history = trainGame.history();
  $('train-move-history').innerHTML = history.length ? history.map((m,i)=>`<span>${i%2===0 ? `${Math.floor(i/2)+1}.` : ''} ${escapeHtml(m)}</span>`).join('') : '<small>No moves yet.</small>';
}
function finishTrainSession() {
  if (!$('train-results') || !trainOpening) return;
  $('train-session').hidden = true;
  $('train-results').hidden = false;
  const accuracy = trainStats.userMoves ? Math.round(trainStats.firstTry / trainStats.userMoves * 100) : 0;
  $('train-result-accuracy').textContent = `${accuracy}%`;
  $('train-result-mistakes').textContent = trainStats.mistakes;
  $('train-result-moves').textContent = trainStats.userMoves;
  $('train-results-title').textContent = accuracy === 100 ? 'Perfect recall.' : accuracy >= 80 ? 'Strong line.' : accuracy >= 60 ? 'Getting there.' : 'This one needs another pass.';
  try {
    const previous = JSON.parse(localStorage.getItem(trainingStorageKey(trainOpening.id)) || '{}');
    localStorage.setItem(trainingStorageKey(trainOpening.id), JSON.stringify({ attempts:(previous.attempts||0)+1, bestAccuracy:Math.max(previous.bestAccuracy||0, accuracy), lastAccuracy:accuracy, mistakes:trainStats.mistakes, trainedAt:new Date().toISOString() }));
  } catch {}
  logActivity?.('opening_trained', { opening_id: trainOpening.id, opening: trainOpening.name, variation: trainOpening.variation || 'Main Line', accuracy }).catch?.(()=>{});
}


// WEB v2.9.0 — Opening Puzzle Engine
let trainMode = 'recall';
let puzzleOpening = null;
let puzzlePool = [];
let puzzleGame = null;
let puzzleMoves = [];
let puzzleUserSide = 'white';
let puzzleStartPly = 0;
let puzzlePly = 0;
let puzzleTargetUserMoves = 1;
let puzzleSolvedInCurrent = 0;
let puzzleSelectedSquare = null;
let puzzleAttemptsForPly = 0;
let puzzleHintUsed = false;
let puzzleAnswerUsed = false;
let puzzleSearchTimer = null;
let puzzleUsedStarts = new Set();
let puzzleCompleting = false;
let puzzleStats = { index:0, total:5, score:0, streak:0, bestStreak:0, userMoves:0, firstTry:0, mistakes:0, skipped:0 };

function puzzleStorageKey() { return 'bozo_opening_puzzles_v1'; }

function setTrainMode(mode = 'recall') {
  trainMode = mode === 'puzzles' ? 'puzzles' : 'recall';
  const recall = trainMode === 'recall';
  $('train-recall-mode').hidden = !recall;
  $('train-puzzle-mode').hidden = recall;
  $('train-mode-recall')?.classList.toggle('active', recall);
  $('train-mode-puzzles')?.classList.toggle('active', !recall);
  $('train-mode-recall')?.setAttribute('aria-selected', String(recall));
  $('train-mode-puzzles')?.setAttribute('aria-selected', String(!recall));
  if ($('train-new-line')) $('train-new-line').textContent = recall ? 'Choose another line' : 'New puzzle line';
  if (!recall && !puzzleGame && !$('puzzle-results')?.hidden) return;
  if (!recall && !puzzleGame) showPuzzlePicker();
}

function resetCurrentTrainMode() {
  if (trainMode === 'puzzles') {
    puzzleOpening = null;
    puzzlePool = [];
    puzzleGame = null;
    showPuzzlePicker();
    $('puzzle-opening-search')?.focus();
    return;
  }
  trainOpening = null;
  prepareTrainPage();
  $('train-opening-search')?.focus();
}

$('train-mode-recall')?.addEventListener('click', () => setTrainMode('recall'));
$('train-mode-puzzles')?.addEventListener('click', () => setTrainMode('puzzles'));
$('puzzle-search-button')?.addEventListener('click', () => searchPuzzleOpenings($('puzzle-opening-search').value));
$('puzzle-opening-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') searchPuzzleOpenings(e.currentTarget.value); });
$('puzzle-opening-search')?.addEventListener('input', e => {
  clearTimeout(puzzleSearchTimer);
  puzzleSearchTimer = setTimeout(() => { if (e.currentTarget.value.trim().length >= 2) searchPuzzleOpenings(e.currentTarget.value); }, 280);
});
$('puzzle-random-button')?.addEventListener('click', startRandomOpeningPuzzles);
$('puzzle-hint')?.addEventListener('click', showPuzzleHint);
$('puzzle-answer')?.addEventListener('click', showPuzzleAnswer);
$('puzzle-skip')?.addEventListener('click', skipPuzzle);
$('puzzle-again')?.addEventListener('click', () => puzzleOpening ? startOpeningPuzzles(puzzleOpening.id) : startRandomOpeningPuzzles());
$('puzzle-new-line')?.addEventListener('click', () => { puzzleOpening = null; puzzlePool = []; puzzleGame = null; showPuzzlePicker(); });

function showPuzzlePicker() {
  if (!$('puzzle-picker')) return;
  $('puzzle-picker').hidden = false;
  $('puzzle-session').hidden = true;
  $('puzzle-results').hidden = true;
}

async function searchPuzzleOpenings(query = '') {
  const root = $('puzzle-opening-results');
  if (!root) return;
  const text = query.trim();
  root.innerHTML = '<div class="empty-state"><div>⌛</div><b>Building puzzles…</b></div>';
  let req = sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type').eq('status','published').limit(60);
  if (text) req = req.or(`name.ilike.%${text}%,variation.ilike.%${text}%,eco.ilike.%${text}%`);
  const { data, error } = await req.order('name');
  if (error) { root.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load openings</b><span>${escapeHtml(readableError(error))}</span></div>`; return; }
  const rows = (data || []).filter(openingSupportsPuzzles);
  if (!rows.length) { root.innerHTML = '<div class="empty-state"><div>🧩</div><b>No puzzle-ready lines</b><span>Try a broader opening name.</span></div>'; return; }
  root.innerHTML = rows.slice(0,40).map(row => {
    const side = inferOpeningSide(row);
    return `<button class="train-opening-result puzzle-opening-result" type="button" data-puzzle-opening="${row.id}"><span><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.variation || 'Main Line')} · ${escapeHtml(row.eco || 'ECO —')}</small></span><em>5 puzzles · ${side === 'neutral' ? 'White' : side}</em></button>`;
  }).join('');
  root.querySelectorAll('[data-puzzle-opening]').forEach(button => button.addEventListener('click', () => startOpeningPuzzles(button.dataset.puzzleOpening)));
}

function openingSupportsPuzzles(row) {
  if (!row?.pgn) return false;
  try {
    const game = new Chess();
    if (!game.load_pgn(row.pgn, { sloppy:true })) return false;
    return game.history().length >= 3;
  } catch { return false; }
}

async function fetchPuzzleOpening(openingId) {
  const { data, error } = await sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type').eq('id',openingId).maybeSingle();
  if (error || !data) throw error || new Error('Opening not found');
  return data;
}

async function startOpeningPuzzles(openingId) {
  route('train');
  setTrainMode('puzzles');
  try {
    puzzleOpening = await fetchPuzzleOpening(openingId);
    puzzlePool = [puzzleOpening];
    beginPuzzleSession();
  } catch (error) { toast(readableError(error)); }
}
window.startOpeningPuzzles = startOpeningPuzzles;

async function startRandomOpeningPuzzles() {
  route('train');
  setTrainMode('puzzles');
  const root = $('puzzle-opening-results');
  if (root) root.innerHTML = '<div class="empty-state"><div>🎲</div><b>BOZO is shuffling the library…</b><span>Finding five puzzle-ready positions.</span></div>';
  const { data, error } = await sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type').eq('status','published').limit(120);
  if (error) { showPuzzlePicker(); return toast(readableError(error)); }
  puzzleOpening = null;
  puzzlePool = shuffleArray((data || []).filter(openingSupportsPuzzles)).slice(0,25);
  if (!puzzlePool.length) { showPuzzlePicker(); return toast('No puzzle-ready opening lines were found.'); }
  beginPuzzleSession();
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}

function beginPuzzleSession() {
  puzzleStats = { index:0, total:5, score:0, streak:0, bestStreak:0, userMoves:0, firstTry:0, mistakes:0, skipped:0 };
  puzzleUsedStarts = new Set();
  $('puzzle-picker').hidden = true;
  $('puzzle-results').hidden = true;
  $('puzzle-session').hidden = false;
  startNextPuzzle();
}

function choosePuzzleOpening() {
  if (puzzleOpening) return puzzleOpening;
  if (!puzzlePool.length) return null;
  return puzzlePool[puzzleStats.index % puzzlePool.length] || puzzlePool[Math.floor(Math.random()*puzzlePool.length)];
}

function buildPuzzleForOpening(opening) {
  const parser = new Chess();
  if (!parser.load_pgn(opening.pgn, { sloppy:true })) return null;
  const moves = parser.history();
  const inferred = inferOpeningSide(opening);
  const userSide = inferred === 'black' ? 'black' : 'white';
  const parity = userSide === 'white' ? 0 : 1;
  let candidates = moves.map((_,i)=>i).filter(i => i%2===parity && i < moves.length);
  const midCandidates = candidates.filter(i => i >= 4);
  if (midCandidates.length) candidates = midCandidates;
  if (!candidates.length) return null;
  const unused = candidates.filter(i => !puzzleUsedStarts.has(`${opening.id}:${i}`));
  const pool = unused.length ? unused : candidates;
  const startPly = pool[Math.floor(Math.random()*pool.length)];
  puzzleUsedStarts.add(`${opening.id}:${startPly}`);
  const remainingUserMoves = candidates.filter(i => i >= startPly).length;
  const maxTarget = Math.max(1, Math.min(3, remainingUserMoves));
  const targetUserMoves = 1 + Math.floor(Math.random()*maxTarget);
  return { opening, moves, userSide, startPly, targetUserMoves };
}

function startNextPuzzle() {
  puzzleCompleting = false;
  if (puzzleStats.index >= puzzleStats.total) return finishPuzzleSession();
  let spec = null;
  for (let tries=0; tries<Math.max(4,puzzlePool.length); tries++) {
    const opening = puzzleOpening || puzzlePool[(puzzleStats.index + tries) % puzzlePool.length];
    spec = buildPuzzleForOpening(opening);
    if (spec) break;
  }
  if (!spec) return finishPuzzleSession();
  puzzleMoves = spec.moves;
  puzzleUserSide = spec.userSide;
  puzzleStartPly = spec.startPly;
  puzzlePly = spec.startPly;
  puzzleTargetUserMoves = spec.targetUserMoves;
  puzzleSolvedInCurrent = 0;
  puzzleSelectedSquare = null;
  puzzleAttemptsForPly = 0;
  puzzleHintUsed = false;
  puzzleAnswerUsed = false;
  puzzleGame = new Chess();
  for (let i=0;i<puzzleStartPly;i++) puzzleGame.move(puzzleMoves[i], { sloppy:true });
  puzzleCurrentOpening = spec.opening;
  $('puzzle-title').textContent = 'Find the continuation.';
  $('puzzle-subtitle').textContent = `${spec.opening.name}${spec.opening.variation ? ' · '+spec.opening.variation : ''} · ${spec.opening.eco || 'ECO —'}`;
  $('puzzle-number').textContent = `${puzzleStats.index+1}/${puzzleStats.total}`;
  $('puzzle-start-label').textContent = puzzleStartPly ? `move ${Math.floor(puzzleStartPly/2)+1}` : 'the opening position';
  setPuzzleFeedback('neutral','Your move.', puzzleTargetUserMoves === 1 ? 'Find the next repertoire move.' : `Find the next ${puzzleTargetUserMoves} repertoire moves.`);
  advancePuzzleOpponentMoves();
  paintPuzzleBoard();
  updatePuzzleUI();
}
let puzzleCurrentOpening = null;

function puzzleSideToMove() { return puzzleGame?.turn() === 'b' ? 'black' : 'white'; }
function isPuzzleUserTurn() { return puzzleSideToMove() === puzzleUserSide; }

function advancePuzzleOpponentMoves() {
  while (puzzlePly < puzzleMoves.length && !isPuzzleUserTurn()) {
    const move = puzzleGame.move(puzzleMoves[puzzlePly], { sloppy:true });
    if (!move) break;
    puzzlePly++;
  }
  if (puzzlePly >= puzzleMoves.length && puzzleSolvedInCurrent < puzzleTargetUserMoves) completeCurrentPuzzle();
}

function paintPuzzleBoard() {
  const boardEl = $('puzzle-board');
  if (!boardEl || !puzzleGame) return;
  const ranks = puzzleUserSide === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = puzzleUserSide === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
  const html=[];
  for (const rank of ranks) for (const file of files) {
    const square=`${file}${rank}`; const piece=puzzleGame.get(square); const symbol=piece?`${piece.color}${piece.type.toUpperCase()}`:'';
    html.push(`<button type="button" data-square="${square}" data-piece-color="${piece?.color==='w'?'white':piece?.color==='b'?'black':''}" class="${puzzleSelectedSquare===square?'selected':''}">${webPiece(symbol)}</button>`);
  }
  boardEl.innerHTML=html.join('');
  boardEl.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>clickPuzzleSquare(button.dataset.square)));
}

function clickPuzzleSquare(square) {
  if (!puzzleGame || puzzlePly >= puzzleMoves.length || !isPuzzleUserTurn()) return;
  const myColor = puzzleUserSide === 'white' ? 'w' : 'b';
  if (!puzzleSelectedSquare) {
    const piece=puzzleGame.get(square); if (!piece || piece.color!==myColor) return;
    puzzleSelectedSquare=square; paintPuzzleBoard(); return;
  }
  const from=puzzleSelectedSquare; puzzleSelectedSquare=null;
  const move=puzzleGame.move({from,to:square,promotion:'q'});
  if (!move) { paintPuzzleBoard(); return; }
  const expectedSan=puzzleMoves[puzzlePly];
  puzzleGame.undo();
  puzzleAttemptsForPly++;
  if (move.san !== expectedSan) {
    puzzleStats.mistakes++; puzzleStats.streak=0;
    setPuzzleFeedback('wrong','Not quite.', puzzleAttemptsForPly===1 ? 'Try the position again.' : 'Use a hint if you need one.');
    paintPuzzleBoard(); updatePuzzleUI(); return;
  }
  puzzleGame.move(expectedSan,{sloppy:true});
  puzzleStats.userMoves++;
  const cleanFirstTry = puzzleAttemptsForPly===1 && !puzzleHintUsed && !puzzleAnswerUsed;
  if (cleanFirstTry) { puzzleStats.firstTry++; puzzleStats.streak++; puzzleStats.score+=100; }
  else if (!puzzleAnswerUsed) { puzzleStats.score += puzzleHintUsed ? 60 : 50; puzzleStats.streak=0; }
  else { puzzleStats.streak=0; }
  puzzleStats.bestStreak=Math.max(puzzleStats.bestStreak,puzzleStats.streak);
  puzzleSolvedInCurrent++; puzzlePly++;
  setPuzzleFeedback('correct', cleanFirstTry ? 'Correct! +100' : 'Correct!', expectedSan);
  puzzleAttemptsForPly=0; puzzleHintUsed=false; puzzleAnswerUsed=false;
  if (puzzleSolvedInCurrent >= puzzleTargetUserMoves || puzzlePly >= puzzleMoves.length) {
    paintPuzzleBoard(); updatePuzzleUI();
    puzzleCompleting = true;
    setTimeout(() => completeCurrentPuzzle(false, true), 480);
    return;
  }
  advancePuzzleOpponentMoves(); paintPuzzleBoard(); updatePuzzleUI();
}

function expectedPuzzleMove() {
  if (!puzzleGame || puzzlePly >= puzzleMoves.length || !isPuzzleUserTurn()) return null;
  const clone=new Chess(puzzleGame.fen());
  return clone.move(puzzleMoves[puzzlePly],{sloppy:true});
}

function showPuzzleHint() {
  const move=expectedPuzzleMove(); if (!move) return;
  puzzleHintUsed=true; puzzleStats.streak=0;
  const piece=puzzleGame.get(move.from); const names={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
  setPuzzleFeedback('hint','Hint',`Look for a ${names[piece?.type]||'piece'} move from the ${move.from[0]}-file.`); updatePuzzleUI();
}
function showPuzzleAnswer() {
  const move=expectedPuzzleMove(); if (!move) return;
  puzzleAnswerUsed=true; puzzleStats.streak=0;
  setPuzzleFeedback('answer','Answer',`${move.san} · ${move.from} → ${move.to}`); updatePuzzleUI();
}
function skipPuzzle() {
  if (!puzzleGame || puzzleCompleting) return;
  puzzleStats.skipped++; puzzleStats.streak=0;
  completeCurrentPuzzle(true);
}
function setPuzzleFeedback(stateName,title,copy) {
  const el=$('puzzle-feedback'); if (!el) return;
  el.dataset.state=stateName; el.innerHTML=`<b>${escapeHtml(title)}</b><span>${escapeHtml(copy)}</span>`;
  el.classList.remove('puzzle-pop'); void el.offsetWidth; el.classList.add('puzzle-pop');
}
function updatePuzzleUI() {
  const accuracy=puzzleStats.userMoves ? Math.round(puzzleStats.firstTry/puzzleStats.userMoves*100) : 0;
  $('puzzle-score').textContent=puzzleStats.score;
  $('puzzle-streak').textContent=puzzleStats.streak;
  $('puzzle-accuracy').textContent=`${accuracy}%`;
  $('puzzle-turn-label').textContent=puzzleGame ? `${puzzleSideToMove()[0].toUpperCase()+puzzleSideToMove().slice(1)} to move` : 'Find the move';
  $('puzzle-instruction').textContent=`${puzzleSolvedInCurrent}/${puzzleTargetUserMoves} continuation moves solved`;
  $('puzzle-track-fill').style.width=`${puzzleTargetUserMoves ? Math.min(100,puzzleSolvedInCurrent/puzzleTargetUserMoves*100) : 0}%`;
  const history=puzzleGame?.history().slice(puzzleStartPly) || [];
  $('puzzle-move-history').innerHTML=history.length ? history.map((m,i)=>`<span>${escapeHtml(m)}</span>`).join('') : '<small>No continuation moves revealed yet.</small>';
}
function completeCurrentPuzzle(skipped=false, forced=false) {
  if (!puzzleGame || (puzzleCompleting && !forced)) return;
  puzzleCompleting=true;
  puzzleGame=null;
  puzzleStats.index++;
  if (puzzleStats.index >= puzzleStats.total) return finishPuzzleSession();
  setTimeout(startNextPuzzle, skipped ? 80 : 220);
}
function finishPuzzleSession() {
  $('puzzle-session').hidden=true; $('puzzle-results').hidden=false;
  const accuracy=puzzleStats.userMoves ? Math.round(puzzleStats.firstTry/puzzleStats.userMoves*100) : 0;
  $('puzzle-result-score').textContent=puzzleStats.score;
  $('puzzle-result-accuracy').textContent=`${accuracy}%`;
  $('puzzle-result-streak').textContent=puzzleStats.bestStreak;
  $('puzzle-results-title').textContent=accuracy===100?'Perfect puzzle run.':accuracy>=85?'Opening instincts are sharp.':accuracy>=65?'Strong run. Keep building.':'BOZO found some weak spots.';
  try {
    const previous=JSON.parse(localStorage.getItem(puzzleStorageKey())||'{}');
    localStorage.setItem(puzzleStorageKey(),JSON.stringify({sessions:(previous.sessions||0)+1,bestScore:Math.max(previous.bestScore||0,puzzleStats.score),bestStreak:Math.max(previous.bestStreak||0,puzzleStats.bestStreak),lastAccuracy:accuracy,lastScore:puzzleStats.score,playedAt:new Date().toISOString()}));
  } catch {}
  logActivity?.('opening_puzzles_completed',{ opening_id:puzzleOpening?.id||null, opening:puzzleOpening?.name||'Random openings', score:puzzleStats.score, accuracy, best_streak:puzzleStats.bestStreak }).catch?.(()=>{});
}
