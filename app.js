
const SUPABASE_URL = 'https://iollrrbpjsmvxozkpxeh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TSiatPuLjWMSx27rnsJTBw_Wxtc_F3y';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

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
  if (name === 'dashboard') renderDashboard();
  if (name === 'challenges') renderChallenges();
  if (name === 'friends') renderFriends();
  if (name === 'review') prepareReviewPage();
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

  room.innerHTML = records.length ? records.slice(0, 12).map(r => `
    <div class="trophy-row">
      <div><b>${escapeHtml(r.name || 'Opening')}</b><small>${r.masteryAwarded ? 'Mastered · +500' : `${r.stars.filter(Boolean).length}/5 stars`}</small></div>
      <div class="trophy-stars">${r.stars.map(on => on ? '★' : '☆').join('')}</div>
    </div>
  `).join('') : `<div class="empty-state"><div>🏆</div><b>No trophies yet</b><span>Train an opening in the Android app to begin your shared Trophy Room.</span></div>`;
}

$('dashboard-sync-button').addEventListener('click', async () => {
  await loadIdentity();
  toast('Cloud data refreshed');
});

function renderProfile() {
  const signedIn = Boolean(state.session?.user);
  $('profile-guest').hidden = signedIn;
  $('profile-user').hidden = !signedIn;
  if (!signedIn) return;

  const p = state.profile || {};
  $('profile-avatar').src = p.avatar_url || './assets/bozo-mascot.webp';
  $('profile-ign').textContent = p.ign || 'Player';
  $('profile-username').textContent = '@' + (p.username || 'username');
  $('profile-role-badge').textContent = roleLabel(state.role);
  $('profile-role-badge').classList.toggle('owner', state.role === 'owner');
  $('profile-ign-input').value = p.ign || '';
  $('profile-username-input').value = p.username || '';
  $('profile-bio-input').value = p.bio || '';
  $('profile-personality-input').value = p.opening_personality || 'Explorer';
  $('profile-email').textContent = state.session.user.email || '';
  $('profile-user-id').textContent = state.session.user.id;
}

$('profile-save-button').addEventListener('click', async () => {
  const username = $('profile-username-input').value.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  if (username.length < 3) return toast('Username must be at least 3 characters.');

  const { error } = await sb.from('profiles').update({
    ign: $('profile-ign-input').value.trim(),
    username,
    bio: $('profile-bio-input').value.trim(),
    opening_personality: $('profile-personality-input').value
  }).eq('id', state.session.user.id);

  if (error) return toast(readableError(error));
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
    .select('title,body').eq('is_active', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  if (error || !data) return $('announcement-card').hidden = true;
  $('announcement-title').textContent = data.title;
  $('announcement-body').textContent = data.body;
  $('announcement-card').hidden = false;
}

$('opening-search-button').addEventListener('click', () => searchOpenings($('opening-search-input').value));
$('opening-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchOpenings(e.target.value); });

async function searchOpenings(query) {
  const target = $('opening-results');
  target.innerHTML = '<div class="empty-state"><div>⌛</div><b>Searching theory…</b></div>';

  let req = sb.from('openings').select('id,eco,name,variation,pgn,source_type').eq('status','published').limit(10000);
  if (query.trim()) req = req.or(`name.ilike.%${query.trim()}%,variation.ilike.%${query.trim()}%,eco.ilike.%${query.trim()}%`);
  const { data, error } = await req.order('name');

  if (error) {
    target.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load the cloud library</b><span>${escapeHtml(readableError(error))}</span></div>`;
    return;
  }

  if (!data?.length) {
    target.innerHTML = `<div class="empty-state"><div>📚</div><b>No published cloud openings found</b><span>The Android opening library is currently bundled locally. The next backend step is importing those 3,800+ lines into the public.openings table.</span></div>`;
    return;
  }

  const families = groupOpeningFamilies(data);
  target.innerHTML = families.map(renderOpeningFamily).join('');

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
          <p>
            ${single ? '1 published line' : `${lineCount.toLocaleString()} variations`}
            ${officialCount ? ` · ${officialCount} official` : ''}
            ${bozoCount ? ` · ${bozoCount} BOZO` : ''}
          </p>
        </div>
        ${single ? '' : `<span class="family-count">${lineCount}</span>`}
      </div>

      <div class="family-preview">
        <span>${escapeHtml(preview.displayVariation)}</span>
        <code>${formatPreviewMoves(preview.pgn || '', 4)}</code>
      </div>

      ${single ? `
        <div class="single-line-actions three-actions">
          <button class="study-button" onclick="openStudyById('${preview.id}')">Study</button>
          <button class="family-bot-button"
                  onclick="openBotForOpening('${escapeHtml(challengeName).replace(/'/g, "\\'")}')">
            Play bot
          </button>
          <button class="family-practice-button"
                  onclick="openChallengeForOpening('${escapeHtml(challengeName).replace(/'/g, "\\'")}')">
            Challenge
          </button>
        </div>
      ` : `
        <div class="family-action-row four-actions">
          <button class="study-button" onclick="openStudyById('${preview.id}')">Study preview</button>
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
                  <code>${escapeHtml(line.pgn || '')}</code>
                  ${line.notes ? `<p>${escapeHtml(line.notes)}</p>` : ''}
                  <div class="line-action-row three-line-actions">
                    <button class="line-study-button" onclick="openStudyById('${line.id}')">Study</button>
                    <button class="line-bot-button"
                            onclick="openBotForOpening('${escapeHtml(lineChallengeName).replace(/'/g, "\\'")}')">
                      Bot
                    </button>
                    <button class="line-challenge-button"
                            onclick="openChallengeForOpening('${escapeHtml(lineChallengeName).replace(/'/g, "\\'")}')">
                      Challenge
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </article>
  `;
}

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
        <input id="owner-announcement-title" maxlength="80" placeholder="Title">
        <textarea id="owner-announcement-body" maxlength="600" placeholder="Message"></textarea>
        <label><input id="owner-announcement-pin" type="checkbox" checked> Pin announcement</label>
        <button id="owner-publish-announcement" class="button primary">Publish</button>
      </div>`;
    $('owner-publish-announcement').addEventListener('click', publishAnnouncement);
    return;
  }

  const map = {
    submissions: ['opening_submissions','proposed_name,submission_type,status,created_at','Opening review'],
    reports: ['reports','report_type,reason,status,created_at','Open reports'],
    audit: ['moderation_actions','action,reason,created_at','Audit history']
  };
  const [table, columns, title] = map[panel];
  let request = sb.from(table).select(columns).order('created_at',{ascending:false}).limit(50);
  if (panel === 'submissions') request = request.in('status',['pending','changes_requested']);
  if (panel === 'reports') request = request.in('status',['open','under_review']);
  const { data, error } = await request;
  if (error) return ownerError(error);

  target.innerHTML = `<div class="panel-heading"><div><span>OWNER</span><h2>${title}</h2></div></div>
    <div class="owner-list">${(data || []).map(item => `
      <div class="owner-list-row"><div><b>${escapeHtml(item.proposed_name || item.report_type || item.action || 'Item')}</b><small>${escapeHtml(item.submission_type || item.reason || item.status || '')}</small></div><small>${new Date(item.created_at).toLocaleString()}</small></div>
    `).join('') || '<div class="empty-state"><div>✓</div><b>Nothing waiting</b></div>'}</div>`;
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
  toast('Announcement published');
  await loadAnnouncement();
  route('home');
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
    notes:'A BOZO custom Réti system that develops into a Polish-Grob pawn expansion.'
  },
  {
    eco:'A00',
    name:"Polish Opening: King's Indian, Polish Grob Attack",
    variation:'Main Line',
    pgn:'1. b4 Nf6 2. Bb2 g6 3. g4 Bg7 4. g5 Nh5 5. Bxg7 Nxg7 6. c4 O-O 7. Qb3',
    source_type:'bozo',
    notes:'A BOZO custom variation combining the Polish setup with a Grob-style g-pawn expansion.'
  },
  {
    eco:'A00',
    name:"Polish Opening: King's Indian, Polish Grob Attack",
    variation:'h5 Counterstrike',
    pgn:'1. b4 Nf6 2. Bb2 g6 3. g4 Bg7 4. g5 Nh5 5. Bxg7 Nxg7 6. c4 h5 7. gxh6 Rxh6 8. Qb3',
    source_type:'bozo',
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
        imported_at: new Date().toISOString()
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
          <button class="button primary" onclick="challengeWebFriend('${escapeHtml(friend.username).replace(/'/g,"\\'")}')">Challenge</button>
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


function renderDuelMoveRows(moves = []) {
  return groupMovesByTurn(moves).map(row => `
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

async function openStudyOpening(openingId) {
  const { data, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn,notes')
    .eq('id', openingId)
    .maybeSingle();

  if (error || !data) return toast(readableError(error || new Error('Opening not found')));

  studyOpening = data;
  studyGame = new Chess();
  const parser = new Chess();
  const loaded = parser.load_pgn(data.pgn, { sloppy: true });
  if (!loaded) return toast('This line could not be loaded on the study board.');

  studyMoves = parser.history();
  studyPly = 0;
  studyOrientation = 'white';
  $('study-title').textContent = data.name;
  $('study-subtitle').textContent = `${data.variation || 'Main Line'} · ${data.eco || 'ECO —'}`;
  $('study-pgn').textContent = data.pgn;
  $('study-modal').hidden = false;
  clearCoach();
  paintStudy();
}

function closeStudy() {
  $('study-modal').hidden = true;
}

function setStudyPly(nextPly) {
  studyPly = Math.max(0, Math.min(studyMoves.length, nextPly));
  studyGame = new Chess();
  for (let i = 0; i < studyPly; i++) {
    studyGame.move(studyMoves[i], { sloppy: true });
  }
  clearCoachAnnotations();
  updateCoachMoveLabel();
  paintStudy();
}

function paintStudy() {
  if (!studyGame) return;
  const ranks = studyOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = studyOrientation === 'white'
    ? ['a','b','c','d','e','f','g','h']
    : ['h','g','f','e','d','c','b','a'];
  const board = fenBoard(studyGame.fen());
  const html = [];

  for (const rank of ranks) {
    for (const file of files) {
      const row = 8-rank;
      const col = file.charCodeAt(0)-97;
      html.push(`<div>${webPiece(board[row][col])}</div>`);
    }
  }

  $('study-board').innerHTML = html.join('');
  $('study-progress').textContent = studyPly === 0
    ? 'Start position'
    : `${studyPly}/${studyMoves.length} plies`;

  $('study-move-list').innerHTML = renderGroupedMoveRows(studyMoves, studyPly);

  $('study-prev').disabled = studyPly === 0;
  $('study-start').disabled = studyPly === 0;
  $('study-next').disabled = studyPly === studyMoves.length;
  $('study-end').disabled = studyPly === studyMoves.length;
  updateCoachMoveLabel();
}



let lastCoachExplanation = null;

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
        moveHistory: studyMoves.slice(0, studyPly)
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

    lastCoachExplanation = data.explanation;
    renderCoachExplanation(data.explanation);
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

const REVIEW_STOCKFISH_JS = './assets/stockfish.worker.js';
const REVIEW_STOCKFISH_WASM = './assets/stockfish.wasm';
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
$('review-start').addEventListener('click', () => setReviewStep(0));
$('review-prev').addEventListener('click', () => setReviewStep(reviewStepIndex - 1));
$('review-next').addEventListener('click', () => setReviewStep(reviewStepIndex + 1));
$('review-end').addEventListener('click', () => setReviewStep(reviewData?.rows.length || 0));
$('review-flip').addEventListener('click', () => {
  reviewOrientation = reviewOrientation === 'white' ? 'black' : 'white';
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
    const wasmUrl = new URL(REVIEW_STOCKFISH_WASM, document.baseURI);
    scriptUrl.hash = encodeURIComponent(wasmUrl.href);

    this.worker = new Worker(scriptUrl.href);
    this.worker.addEventListener('message', event => this.handle(String(event.data)));
    this.worker.addEventListener('error', event => {
      this.fail(new Error(event?.message || 'Stockfish worker failed to load.'));
    });

    this.send('uci');
    await this.waitFor('uciok');
    this.send('setoption name Threads value 1');
    this.send('setoption name Hash value 32');
    this.send('setoption name MultiPV value 1');
    this.send('isready');
    await this.waitFor('readyok');
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

    const bestMove = await new Promise((resolve, reject) => {
      const unsubscribe = () => unsubscribeInfo();
      this.bestResolvers.push({ resolve, reject, unsubscribe });
      this.send(`go depth ${depth}`);
    });

    unsubscribeInfo();
    return { cp, mate, bestMove, pv, depthSeen };
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
    reviewEngineReady = null;
    reviewEngine = null;
    $('review-engine-state').textContent = 'Engine failed';
    throw error;
  });
  return reviewEngineReady;
}

async function getWebBotMoveEngine() {
  if (webBotMoveEngine) return webBotMoveEngine;
  webBotMoveEngine = new ReviewStockfish();
  await webBotMoveEngine.initialize();
  return webBotMoveEngine;
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
      principalVariation: pvBefore.slice(0, 8),
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
    $('review-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);
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

function paintReviewEvaluation(cp = 0, mate = null) {
  const bounded = mate != null
    ? (mate > 0 ? 1000 : -1000)
    : Math.max(-1000, Math.min(1000, cp));
  const whitePercent = Math.max(5, Math.min(95, 50 + bounded / 20));
  $('review-eval-white').style.width = `${whitePercent}%`;
  $('review-eval-label').textContent = formatReviewEval(cp, mate);
}

function updateReviewSelectedMove() {
  const row = reviewStepIndex === 0 ? null : reviewData?.rows[reviewStepIndex - 1];

  if (!row) {
    $('review-selected-move').textContent = 'Starting position';
    $('review-classification').textContent = '—';
    $('review-classification').className = 'review-classification';
    $('review-selected-summary').textContent =
      'Choose a move to inspect its evaluation and alternatives.';
    $('review-move-eval').textContent = '0.00';
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
  $('review-move-eval').textContent = formatReviewEval(row.whiteCp, row.mate);
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
        question: question || `Why was this move classified as ${row.label}?`,
        moveHistory: reviewData.rows.slice(0, row.ply).map(item => item.san),
        evaluationBefore: reviewStepIndex > 1
          ? reviewData.rows[reviewStepIndex - 2].whiteCp
          : 0,
        evaluationAfter: row.whiteCp,
        evaluationUnit: 'centipawns from White perspective',
        bestMove: row.engineBest,
        principalVariation: row.principalVariation,
        classification: row.label,
        centipawnLoss: row.rawEngineLoss,
        moveAccuracy: Math.round(row.accuracy * 10) / 10,
        openingAccuracy: reviewAccuracyFor(
          reviewData.rows.filter(item => item.ply <= 16)
        ),
        overallAccuracy: reviewAccuracyFor(reviewData.rows)
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

    reviewCoachExplanation = data.explanation;
    renderReviewCoachExplanation(data.explanation);
  } catch (error) {
    answer.innerHTML = `<div class="coach-error">${escapeHtml(
      error?.message || 'BOZO Coach could not respond.'
    )}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Explain selected move';
  }
}

function renderReviewCoachExplanation(explanation) {
  const purposes = Array.isArray(explanation.purpose)
    ? explanation.purpose.filter(Boolean)
    : [];

  $('review-coach-answer').innerHTML = `
    <p class="coach-summary">${escapeHtml(explanation.summary || '')}</p>
    ${purposes.length ? `
      <div class="coach-section">
        <b>What happened</b>
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
  beginner: { label: 'Beginner', depth: 4, randomness: 0.48 },
  casual: { label: 'Casual', depth: 6, randomness: 0.28 },
  club: { label: 'Club', depth: 9, randomness: 0.12 },
  advanced: { label: 'Advanced', depth: 12, randomness: 0.04 },
  master: { label: 'BOZO Master', depth: 15, randomness: 0 }
};

let webBotSession = null;
let webBotSelectedSquare = null;
let webBotAnalysisToken = 0;
let webBotMoveEngine = null;
let webBotTurnWatchdog = null;
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

    if (!webBotIsPlayerTurn()) {
      scheduleWebBotMove(120);
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
  $('bot-game-modal').hidden = true;
  webBotAnalysisToken++;
  webBotSession = null;
  webBotSelectedSquare = null;
  botUserArrows = [];
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

  // Give the bot's reply priority over the optional evaluation-bar search.
  scheduleWebBotMove(60);
}

function scheduleWebBotMove(delay = 80) {
  clearTimeout(webBotTurnWatchdog);
  webBotTurnWatchdog = setTimeout(() => {
    webBotTurnWatchdog = null;
    if (!webBotSession ||
        webBotSession.status !== 'active' ||
        webBotIsPlayerTurn() ||
        webBotSession.botThinking) return;

    playWebBotMove().catch(error => {
      console.error('Scheduled BOZO Bot move failed:', error);
      if (webBotSession) {
        webBotSession.botThinking = false;
        $('bot-game-message').textContent =
          error?.message || 'BOZO Bot could not move.';
      }
    });
  }, delay);
}

async function playWebBotMove() {
  if (!webBotSession ||
      webBotSession.status !== 'active' ||
      webBotIsPlayerTurn() ||
      webBotSession.botThinking) return;

  const session = webBotSession;
  const game = session.game;
  session.botThinking = true;
  updateWebBotStatus();

  try {
    let played = null;
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

      const engine = await getWebBotMoveEngine();
      const result = await engine.analyze(game.fen(), session.strength.depth);
      if (webBotSession !== session || session.status !== 'active') return;

      let chosenUci = result.bestMove;
      if (session.strength.randomness > 0 && Math.random() < session.strength.randomness) {
        const legalMoves = game.moves({ verbose: true });
        const candidates = legalMoves.filter(move => {
          const givesAwayQueen =
            move.captured === 'q' && move.piece !== 'q';
          return !givesAwayQueen;
        });
        const pool = candidates.length ? candidates : legalMoves;
        const random = pool[Math.floor(Math.random() * pool.length)];
        if (random) {
          chosenUci = `${random.from}${random.to}${random.promotion || ''}`;
        }
      }

      const from = chosenUci?.slice(0, 2);
      const to = chosenUci?.slice(2, 4);
      const promotion = chosenUci?.slice(4, 5) || 'q';
      played = game.move({ from, to, promotion });

      if (!played) throw new Error(`Stockfish returned an illegal move: ${chosenUci}`);
    }

    session.lastMove = played;
    session.moves = game.history();
    updateWebBotPhase();
    session.botThinking = false;
    paintWebBotGame();
    updateWebBotStatus();

    const gameEnded = checkWebBotGameOver();
    // Evaluation is optional and runs only after the move has appeared.
    updateWebBotEvaluation();
    if (gameEnded) return;
  } catch (error) {
    console.error('BOZO Bot error:', error);
    $('bot-game-message').textContent =
      error?.message || 'BOZO Bot could not move.';
  } finally {
    if (webBotSession === session && session.botThinking) {
      session.botThinking = false;
      updateWebBotStatus();
    }
  }
}

function checkWebBotGameOver() {
  if (!webBotSession) return true;
  const game = webBotSession.game;
  if (!game.game_over()) return false;

  webBotSession.status = 'completed';

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
        : 'BOZO Bot will choose a Stockfish move.';

    // Recovery guard: if the UI is waiting on the bot and no search is active,
    // ensure a bot turn is scheduled.
    if (!webBotTurnWatchdog) scheduleWebBotMove(100);
  }
}

function renderWebBotMoveList() {
  if (!webBotSession) return;
  $('bot-move-list').innerHTML = renderDuelMoveRows(webBotSession.game.history());
}

async function updateWebBotEvaluation() {
  if (!webBotSession) return;
  const session = webBotSession;
  const token = ++webBotAnalysisToken;

  try {
    const engine = await getReviewEngine();
    const result = await engine.analyze(session.game.fen(), 7);
    if (token !== webBotAnalysisToken || webBotSession !== session) return;

    const cp = whiteReviewEval(result, session.game.turn());
    const bounded = result.mate != null
      ? (result.mate > 0 ? 1000 : -1000)
      : Math.max(-1000, Math.min(1000, cp));
    const whitePercent = Math.max(5, Math.min(95, 50 + bounded / 20));
    $('bot-eval-white').style.width = `${whitePercent}%`;
    $('bot-eval-label').textContent = formatReviewEval(cp, result.mate);
  } catch (error) {
    if (token === webBotAnalysisToken) {
      $('bot-eval-label').textContent = '?';
    }
  }
}

function resignWebBotGame() {
  if (!webBotSession || webBotSession.status !== 'active') return;
  webBotSession.status = 'completed';
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
  paintWebBotGame();
  updateWebBotStatus();
  updateWebBotEvaluation();

  if (!webBotIsPlayerTurn()) scheduleWebBotMove(120);
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
$('duel-refresh-button').addEventListener('click', () => openWebDuel(activeWebDuel?.id));
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

async function openWebDuel(id) {
  const { data, error } = await sb.rpc('my_opening_challenges');
  if (error) return toast(readableError(error));
  activeWebDuel = (data || []).find(c => c.id === id);
  if (!activeWebDuel) return toast('Duel not found');

  webDuelGame = new Chess();
  for (const move of (activeWebDuel.move_history || [])) {
    const result = webDuelGame.move(move.san, { sloppy:true });
    if (!result) console.warn('Could not replay', move.san);
  }

  $('challenge-game-modal').hidden = false;
  $('duel-game-title').textContent = activeWebDuel.opening_name;
  $('duel-game-subtitle').textContent = `${activeWebDuel.variation_name || 'Main Line'} · vs ${challengeOpponentName(activeWebDuel)}`;
  $('duel-book-name').textContent = activeWebDuel.variation_name || 'Main Line';
  $('duel-book-pgn').textContent = activeWebDuel.line_pgn;
  selectedWebSquare = null;
  paintWebDuel();

  if (duelRealtimeChannel) sb.removeChannel(duelRealtimeChannel);
  duelRealtimeChannel = sb.channel(`duel-${id}`)
    .on('postgres_changes',{
      event:'UPDATE',schema:'public',table:'opening_challenges',filter:`id=eq.${id}`
    }, () => openWebDuel(id))
    .subscribe();
}

function closeWebDuel() {
  $('challenge-game-modal').hidden = true;
  if (duelRealtimeChannel) {
    sb.removeChannel(duelRealtimeChannel);
    duelRealtimeChannel = null;
  }
}

function webPiece(symbol) {
  return {p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',P:'♙',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔'}[symbol] || '';
}

function fenBoard(fen) {
  const boardPart = (fen === 'start' ? new Chess().fen() : fen).split(' ')[0];
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
  $('duel-game-message').textContent = myTurn
    ? ((c.move_history || []).length < c.required_plies ? 'Book moves are enforced.' : 'The game is now out of book.')
    : '';

  const orientation = myDuelColor(c);
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
  const board = fenBoard(webDuelGame.fen());
  const html=[];
  for (const rankNum of ranks) {
    for (const file of files) {
      const row=8-rankNum, col=file.charCodeAt(0)-97;
      const square=`${file}${rankNum}`;
      const piece=board[row][col];
      html.push(`<button data-square="${square}" class="${selectedWebSquare===square?'selected':''}">${webPiece(piece)}</button>`);
    }
  }
  $('web-duel-board').innerHTML=html.join('');
  $('web-duel-board').querySelectorAll('button').forEach(b => b.addEventListener('click', () => clickWebDuelSquare(b.dataset.square)));

  const moves=c.move_history || [];
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
  activeWebDuel=data;
  selectedWebSquare=null;

  if (webDuelGame.in_checkmate()) {
    await sb.rpc('finish_opening_challenge',{
      challenge_id:activeWebDuel.id,finish_reason:'checkmate',
      game_result:webDuelGame.turn()==='w'?'0-1':'1-0'
    });
  } else if (webDuelGame.in_draw()) {
    await sb.rpc('finish_opening_challenge',{
      challenge_id:activeWebDuel.id,finish_reason:'draw',game_result:'1/2-1/2'
    });
  }
  await openWebDuel(activeWebDuel.id);
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
  route((location.hash || '#home').slice(1));
})();
