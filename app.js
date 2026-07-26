
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

  let req = sb.from('openings').select('id,eco,name,variation,pgn,source_type').eq('status','published').limit(60);
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

  target.innerHTML = data.map(o => `
    <article class="opening-card">
      <span>${escapeHtml(o.eco || 'ECO —')} · ${escapeHtml(o.source_type || 'official')}</span>
      <h3>${escapeHtml(o.name)}</h3>
      ${o.variation ? `<small>${escapeHtml(o.variation)}</small>` : ''}
      <div class="pgn">${escapeHtml((o.pgn || '').slice(0,220))}${(o.pgn || '').length > 220 ? '…' : ''}</div>
      <span class="tag">Cloud opening</span>
    </article>
  `).join('');
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
