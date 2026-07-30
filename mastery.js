(() => {
  'use strict';

  const KEY = 'bozo_opening_mastery_v1';
  const TABLE = 'opening_mastery';
  const $ = id => document.getElementById(id);

  let studySession = null;
  let client = null;
  let user = null;
  let syncing = false;
  let saveTimer = null;

  const emptyStore = () => ({ openings: {}, bestStreak: 0 });

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      return parsed && parsed.openings ? parsed : emptyStore();
    } catch {
      return emptyStore();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
  }

  function rank(percent) {
    return percent >= 100 ? 'BOZO Grandmaster'
      : percent >= 80 ? 'Master'
      : percent >= 60 ? 'Expert'
      : percent >= 40 ? 'Apprentice'
      : percent >= 20 ? 'Student'
      : 'Beginner';
  }

  function normalizeOpening(opening = {}) {
    return {
      name: opening.name || opening.opening_name || 'Opening',
      maxPly: Math.max(0, Number(opening.maxPly ?? opening.max_ply ?? 0) || 0),
      totalPlies: Math.max(0, Number(opening.totalPlies ?? opening.total_plies ?? 0) || 0),
      sessions: Math.max(0, Number(opening.sessions ?? opening.sessions_completed ?? 0) || 0),
      bestStreak: Math.max(0, Number(opening.bestStreak ?? opening.best_streak ?? 0) || 0),
      lastPracticed: opening.lastPracticed || opening.last_practiced || null
    };
  }

  function latestDate(a, b) {
    if (!a) return b || null;
    if (!b) return a || null;
    return new Date(a) >= new Date(b) ? a : b;
  }

  function mergeOpening(localOpening = {}, cloudOpening = {}) {
    const local = normalizeOpening(localOpening);
    const cloud = normalizeOpening(cloudOpening);
    return {
      name: local.name !== 'Opening' ? local.name : cloud.name,
      maxPly: Math.max(local.maxPly, cloud.maxPly),
      totalPlies: Math.max(local.totalPlies, cloud.totalPlies),
      sessions: Math.max(local.sessions, cloud.sessions),
      bestStreak: Math.max(local.bestStreak, cloud.bestStreak),
      lastPracticed: latestDate(local.lastPracticed, cloud.lastPracticed)
    };
  }

  function get(id) {
    return normalizeOpening(load().openings[String(id)] || {});
  }

  function percent(opening) {
    const o = normalizeOpening(opening);
    return o.totalPlies
      ? Math.min(100, Math.round((o.maxPly / o.totalPlies) * 100))
      : 0;
  }

  function cardMarkup(id) {
    const opening = get(id);
    const mastery = percent(opening);
    return `<div class="opening-mastery-cardline">
      <span>${rank(mastery)}</span>
      <div class="opening-mastery-track"><span style="width:${mastery}%"></span></div>
      <strong>${mastery}%</strong>
    </div>`;
  }

  const compactMarkup = cardMarkup;

  function setSyncStatus(message, state = '') {
    const status = $('mastery-sync-status');
    const copy = $('local-mastery-copy');
    const title = $('local-mastery-title');
    const eyebrow = document.querySelector('.local-mastery-dashboard .panel-heading span');

    if (status) {
      status.textContent = message;
      status.dataset.state = state;
    }

    if (user) {
      if (title) title.textContent = 'Cloud Opening Mastery';
      if (eyebrow) eyebrow.textContent = 'PHASE TWO';
      if (copy) copy.textContent = 'Progress is saved locally and synced automatically to your BOZO account.';
    } else {
      if (title) title.textContent = 'Local Opening Mastery';
      if (eyebrow) eyebrow.textContent = 'GUEST MODE';
      if (copy) copy.textContent = 'Guest progress is saved on this device. Sign in to sync it across devices.';
    }
  }

  function refreshAll() {
    document.querySelectorAll('[data-mastery-opening]').forEach(element => {
      element.innerHTML = cardMarkup(element.dataset.masteryOpening);
    });
    renderDashboard();
  }

  function toCloudRow(openingId, opening) {
    const o = normalizeOpening(opening);
    return {
      user_id: user.id,
      opening_id: String(openingId),
      opening_name: o.name,
      max_ply: o.maxPly,
      total_plies: o.totalPlies,
      sessions_completed: o.sessions,
      best_streak: o.bestStreak,
      last_practiced: o.lastPracticed
    };
  }

  async function upsertOpening(openingId) {
    if (!client || !user) return;
    const opening = load().openings[String(openingId)];
    if (!opening) return;

    const { error } = await client
      .from(TABLE)
      .upsert(toCloudRow(openingId, opening), { onConflict: 'user_id,opening_id' });

    if (error) throw error;
  }

  function scheduleCloudSave(openingId) {
    if (!client || !user) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        setSyncStatus('Saving…', 'syncing');
        await upsertOpening(openingId);
        setSyncStatus('Synced', 'synced');
      } catch (error) {
        console.warn('Opening mastery cloud save failed:', error);
        setSyncStatus('Saved locally · Cloud retry needed', 'error');
      }
    }, 450);
  }

  async function syncNow() {
    if (!client || !user || syncing) return;
    syncing = true;
    setSyncStatus('Syncing…', 'syncing');

    try {
      const { data: cloudRows, error } = await client
        .from(TABLE)
        .select('opening_id,opening_name,max_ply,total_plies,sessions_completed,best_streak,last_practiced')
        .eq('user_id', user.id);

      if (error) throw error;

      const local = load();
      const cloudById = Object.fromEntries(
        (cloudRows || []).map(row => [String(row.opening_id), row])
      );
      const allIds = new Set([
        ...Object.keys(local.openings || {}),
        ...Object.keys(cloudById)
      ]);

      const merged = emptyStore();

      for (const openingId of allIds) {
        const combined = mergeOpening(
          local.openings?.[openingId],
          cloudById[openingId]
        );
        merged.openings[openingId] = combined;
        merged.bestStreak = Math.max(merged.bestStreak, combined.bestStreak);
      }

      save(merged);

      const rows = Object.entries(merged.openings).map(([openingId, opening]) =>
        toCloudRow(openingId, opening)
      );

      if (rows.length) {
        const { error: upsertError } = await client
          .from(TABLE)
          .upsert(rows, { onConflict: 'user_id,opening_id' });
        if (upsertError) throw upsertError;
      }

      refreshAll();
      setSyncStatus('Synced', 'synced');
    } catch (error) {
      console.warn('Opening mastery cloud sync failed:', error);
      setSyncStatus('Saved locally · Cloud retry needed', 'error');
    } finally {
      syncing = false;
    }
  }

  async function setAuth(nextClient, nextUser) {
    client = nextClient || null;
    user = nextUser || null;
    clearTimeout(saveTimer);

    if (user && client) {
      setSyncStatus('Connecting…', 'syncing');
      await syncNow();
    } else {
      setSyncStatus('Local only', 'local');
      refreshAll();
    }
  }

  function startSession(opening) {
    studySession = {
      id: String(opening.id),
      name: opening.name + (opening.variation ? `: ${opening.variation}` : ''),
      streak: 0,
      best: 0,
      completed: false
    };
    paintStudyPanel(opening, 0, 0);
  }

  function recordStudyPly(opening, ply, total, previous) {
    if (!opening) return;
    if (!studySession || studySession.id !== String(opening.id)) startSession(opening);

    if (ply === previous + 1) {
      studySession.streak++;
      studySession.best = Math.max(studySession.best, studySession.streak);
    } else if (ply < previous) {
      studySession.streak = 0;
    } else if (ply > previous + 1) {
      studySession.streak = Math.max(studySession.streak, ply);
      studySession.best = Math.max(studySession.best, studySession.streak);
    }

    const data = load();
    const openingId = String(opening.id);
    const current = normalizeOpening(data.openings[openingId] || {});

    current.name = studySession.name;
    current.totalPlies = Math.max(total, current.totalPlies);
    current.maxPly = Math.max(ply, current.maxPly);
    current.bestStreak = Math.max(current.bestStreak, studySession.best);
    current.lastPracticed = new Date().toISOString();

    data.bestStreak = Math.max(data.bestStreak || 0, current.bestStreak);
    data.openings[openingId] = current;

    if (total > 0 && ply === total && !studySession.completed) {
      studySession.completed = true;
      current.sessions += 1;
      data.openings[openingId] = current;
      save(data);
      showSummary(current, total);
    } else {
      save(data);
    }

    paintStudyPanel(opening, ply, total);
    refreshAll();
    scheduleCloudSave(openingId);
  }

  function paintStudyPanel(opening, ply, total) {
    if (!opening) return;
    const saved = get(String(opening.id));
    const effective = {
      ...saved,
      totalPlies: total || saved.totalPlies,
      maxPly: Math.max(saved.maxPly, ply || 0)
    };
    const mastery = percent(effective);

    if ($('study-mastery-percent')) $('study-mastery-percent').textContent = `${mastery}%`;
    if ($('study-mastery-rank')) $('study-mastery-rank').textContent = rank(mastery);
    if ($('study-mastery-fill')) $('study-mastery-fill').style.width = `${mastery}%`;
    if ($('study-session-streak')) $('study-session-streak').textContent = studySession?.streak || 0;
    if ($('study-best-streak')) $('study-best-streak').textContent =
      Math.max(saved.bestStreak, studySession?.best || 0);
    if ($('study-mastery-note')) {
      $('study-mastery-note').textContent = mastery === 100
        ? 'Line completed. Repeat it later to reinforce the pattern.'
        : `${Math.max(0, (total || 0) - (ply || 0))} plies remain in this walkthrough.`;
    }
  }

  function showSummary(opening, total) {
    const mastery = percent(opening);
    if (!$('mastery-summary-modal')) return;

    $('mastery-summary-title').textContent = opening.name;
    $('mastery-summary-percent').textContent = `${mastery}%`;
    $('mastery-summary-rank').textContent = rank(mastery);
    $('mastery-summary-moves').textContent = total;
    $('mastery-summary-streak').textContent = opening.bestStreak || 0;
    $('mastery-summary-sessions').textContent = opening.sessions || 1;
    $('mastery-summary-message').textContent = mastery === 100
      ? 'You completed the full line. This opening is now marked as mastered.'
      : 'Good session. Continue through the remaining moves to raise mastery.';
    $('mastery-summary-modal').hidden = false;
    refreshAll();
  }

  function renderDashboard() {
    const data = load();
    const rows = Object.entries(data.openings)
      .map(([id, opening]) => ({ id, ...normalizeOpening(opening), p: percent(opening) }))
      .sort((a, b) => b.p - a.p ||
        String(b.lastPracticed || '').localeCompare(String(a.lastPracticed || '')));

    const overall = rows.length
      ? Math.round(rows.reduce((sum, opening) => sum + opening.p, 0) / rows.length)
      : 0;

    if ($('local-overall-mastery')) $('local-overall-mastery').textContent = `${overall}%`;
    if ($('local-mastery-rank')) $('local-mastery-rank').textContent = rank(overall);
    if ($('local-lines-studied')) $('local-lines-studied').textContent = rows.length;
    if ($('local-best-streak')) $('local-best-streak').textContent = data.bestStreak || 0;
    if ($('local-needs-review')) {
      $('local-needs-review').textContent = rows.filter(o => o.p > 0 && o.p < 100).length;
    }

    const list = $('local-mastery-list');
    if (!list) return;

    list.innerHTML = rows.length
      ? rows.slice(0, 12).map(opening => `
        <article class="local-mastery-row">
          <div>
            <h3>${escapeHtml(opening.name || 'Opening')}</h3>
            <small>${rank(opening.p)} · ${opening.sessions || 0} sessions</small>
          </div>
          <div class="opening-mastery-track"><span style="width:${opening.p}%"></span></div>
          <strong>${opening.p}%</strong>
        </article>`).join('')
      : `<div class="empty-state">
          <div>♟</div>
          <b>No opening mastery yet</b>
          <span>Open a line in the Opening Library and walk through its moves.</span>
        </div>`;
  }

  async function reset() {
    const scope = user
      ? 'Reset all opening mastery on this device and in your BOZO cloud account?'
      : 'Reset all local opening mastery on this device?';

    if (!confirm(scope)) return;

    if (client && user) {
      setSyncStatus('Resetting…', 'syncing');
      const { error } = await client.from(TABLE).delete().eq('user_id', user.id);
      if (error) {
        console.warn('Cloud mastery reset failed:', error);
        setSyncStatus('Cloud reset failed', 'error');
        return;
      }
    }

    localStorage.removeItem(KEY);
    studySession = null;
    refreshAll();
    setSyncStatus(user ? 'Synced' : 'Local only', user ? 'synced' : 'local');
    window.toast?.('Opening mastery reset');
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('reset-local-mastery')?.addEventListener('click', reset);
    $('mastery-sync-now')?.addEventListener('click', syncNow);

    const close = () => {
      if ($('mastery-summary-modal')) $('mastery-summary-modal').hidden = true;
    };

    $('close-mastery-summary')?.addEventListener('click', close);
    $('mastery-summary-done')?.addEventListener('click', close);
    $('mastery-summary-modal')?.addEventListener('click', event => {
      if (event.target.id === 'mastery-summary-modal') close();
    });

    setSyncStatus('Local only', 'local');
    renderDashboard();
  });

  window.BozoMastery = {
    cardMarkup,
    compactMarkup,
    refreshAll,
    startSession,
    recordStudyPly,
    paintStudyPanel,
    renderDashboard,
    rank,
    setAuth,
    syncNow
  };
})();