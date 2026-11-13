/* ============================================================
   CTG — shared data layer (Supabase database + Auth)

   Every page loads the Supabase library, supabase-config.js,
   then this file (and, on pages with translated text, i18n.js).
   Nothing here needs editing during setup — only
   supabase-config.js and supabase/schema.sql. See SETUP.md.
   ============================================================ */

/* ---------- Turning database error codes into plain English ---------- */

function describeDbError(err) {
  const code = (err && err.code) || '';
  const msg = (err && err.message) || '';

  if (code === 'config-missing') {
    return {
      title: "The project keys haven't been filled in",
      body: "supabase-config.js didn't load, or still has the PASTE_… placeholders in it.",
      fix: "Put your Project URL and anon key into supabase-config.js."
    };
  }
  if (code === 'not-admin') {
    return {
      title: "This account isn't on the admin list",
      body: "You're signed in, but the database doesn't treat this account as an admin, " +
            "so private submissions stay hidden.",
      fix: "Supabase dashboard → SQL Editor → insert this UID into public.admins (see the bottom of supabase/schema.sql)."
    };
  }
  if (code === '42501') {
    return {
      title: "The database refused the request",
      body: "Supabase is connected, but its Row Level Security policies are blocking this.",
      fix: "Supabase dashboard → SQL Editor → run supabase/schema.sql again."
    };
  }
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') {
    return {
      title: "The database tables don't exist yet",
      body: "The project exists, but the tables this site uses haven't been created.",
      fix: "Supabase dashboard → SQL Editor → paste supabase/schema.sql → Run."
    };
  }
  if (/invalid api key|no api key/i.test(msg)) {
    return {
      title: "The project keys look wrong",
      body: "Supabase rejected the key in supabase-config.js.",
      fix: "Re-copy the Project URL and anon key from Project Settings → API."
    };
  }
  if (err instanceof TypeError || /failed to fetch|network/i.test(msg)) {
    return {
      title: "Couldn't reach Supabase",
      body: "The browser couldn't connect. Usually this is the internet connection, " +
            "or an extension or school network blocking supabase.co. " +
            "Free Supabase projects also pause after a week without visits.",
      fix: "Check your connection and that the project isn't paused, then reload the page."
    };
  }
  return {
    title: "Something went wrong talking to the database",
    body: msg || String(err),
    fix: "Open the browser console (right-click → Inspect → Console) for the full message."
  };
}

function showTrouble(elId, err) {
  const el = document.getElementById(elId);
  console.error('[CTG]', err);
  if (!el) return;
  const d = describeDbError(err);
  el.innerHTML =
    '<strong>' + escapeHtml(d.title) + '</strong>' +
    escapeHtml(d.body) +
    '<p class="fix">' + escapeHtml(d.fix) +
    (err && err.code ? ' <code>' + escapeHtml(err.code) + '</code>' : '') +
    '</p>';
  el.classList.add('show');
}

function hideTrouble(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.remove('show');
}

/* ---------- Guard: did supabase-config.js actually run? ---------- */

const CONFIG_OK = (typeof sb !== 'undefined' && !!sb);

if (!CONFIG_OK) {
  console.error('[CTG] supabase-config.js did not initialise. ' +
                'Check that the file exists in this folder and the keys are filled in.');
}

/* ============================================================
   Language detection + machine translation

   Detection is a cheap Hangul-range check — no network needed.
   Translation calls MyMemory's free REST API directly from the
   browser (no key, no backend, CORS-enabled). Quality is good
   enough for a first draft; the admin reviews and can edit the
   result before anything is published. See SETUP.md for the
   optional free-tier quota note.
   ============================================================ */

function detectLang(text) {
  return /[가-힣]/.test(text || '') ? 'ko' : 'en';
}

async function translateText(text, sourceLang, targetLang) {
  const clean = (text || '').trim();
  if (!clean) return '';
  if (sourceLang === targetLang) return clean;

  const url = 'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(clean) + '&langpair=' + sourceLang + '|' + targetLang;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation service unavailable (' + res.status + ')');
  const data = await res.json();
  const out = data && data.responseData && data.responseData.translatedText;
  if (!out) throw new Error('Translation service returned no result');
  return out;
}

// Given one piece of text in whichever language it was written, return
// { en, ko, sourceLang } with a machine-translated draft for the other.
async function draftBilingual(text) {
  const sourceLang = detectLang(text);
  const targetLang = sourceLang === 'en' ? 'ko' : 'en';
  const translated = await translateText(text, sourceLang, targetLang);
  return sourceLang === 'en'
    ? { en: text.trim(), ko: translated, sourceLang }
    : { en: translated, ko: text.trim(), sourceLang };
}

/* ============================================================
   Live queries

   Supabase returns { data, error } instead of throwing, so
   `must()` turns an error into a thrown one. `liveTable()`
   loads a table, then reloads it whenever Supabase Realtime
   reports a change — and also right after this browser changes
   something, so the page updates even if Realtime is off.
   ============================================================ */

function must({ data, error }) {
  if (error) throw error;
  return data;
}

const liveReloaders = {};   // table name -> Set of reload functions

function liveTable(table, mapRow, callback, onError) {
  let stopped = false;
  const reload = async () => {
    try {
      const rows = must(await sb.from(table).select('*').order('date', { ascending: false }));
      if (!stopped) callback(rows.map(mapRow));
    } catch (err) {
      if (!stopped && onError) onError(err);
    }
  };

  (liveReloaders[table] = liveReloaders[table] || new Set()).add(reload);
  const channel = sb.channel('ctg-' + table + '-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table }, reload)
    .subscribe();
  reload();

  return () => {
    stopped = true;
    liveReloaders[table].delete(reload);
    sb.removeChannel(channel);
  };
}

function refreshLive(table) {
  (liveReloaders[table] || []).forEach(fn => fn());
}

/* ============================================================
   PrayerBoard — the whole data layer
   ============================================================ */

const PrayerBoard = {

  /* ---------------- Submissions (questions + prayers) ---------------- */
  // Submitted as written, in whichever language — never translated on
  // the way in. Translation only happens when an admin publishes a
  // question to the public board.

  async addSubmission({ type, name, message }) {
    // No .select() afterwards: visitors may insert but not read back.
    must(await sb.from('submissions').insert({
      type,                                  // 'ask' | 'prayer'
      name: (name || '').trim(),
      message: (message || '').trim(),
    }));
  },

  onSubmissions(callback, onError) {
    return liveTable('submissions', row => row, callback, onError);
  },

  async deleteSubmission(id) {
    must(await sb.from('submissions').delete().eq('id', id));
    refreshLive('submissions');
  },

  async setSubmissionSeen(id, seen) {
    must(await sb.from('submissions').update({ seen: !!seen }).eq('id', id));
    refreshLive('submissions');
  },

  // question_* / answer_* are the bilingual pairs the admin has already
  // reviewed (see the "translate & review" step in admin.html).
  async publishSubmissionToBoard(id, { question_en, question_ko, answer_en, answer_ko }) {
    const item = must(await sb.from('submissions').select('type').eq('id', id).maybeSingle());
    if (!item) return;
    if (item.type !== 'ask') throw new Error('Only questions can be posted to the board.');
    must(await sb.from('board').insert({
      question_en: (question_en || '').trim(),
      question_ko: (question_ko || '').trim(),
      answer_en: (answer_en || '').trim(),
      answer_ko: (answer_ko || '').trim(),
    }));
    must(await sb.from('submissions').delete().eq('id', id));
    refreshLive('board');
    refreshLive('submissions');
  },

  /* ---------------- Board (public, bilingual, answered questions) ---------------- */

  onBoard(callback, onError) {
    return liveTable('board', row => row, callback, onError);
  },

  async addBoardEntry({ question_en, question_ko, answer_en, answer_ko }) {
    must(await sb.from('board').insert({
      question_en: (question_en || '').trim(),
      question_ko: (question_ko || '').trim(),
      answer_en: (answer_en || '').trim(),
      answer_ko: (answer_ko || '').trim(),
    }));
    refreshLive('board');
  },

  async updateBoardEntry(id, { question_en, question_ko, answer_en, answer_ko }) {
    const data = {};
    if (question_en !== undefined) data.question_en = question_en.trim();
    if (question_ko !== undefined) data.question_ko = question_ko.trim();
    if (answer_en !== undefined) data.answer_en = answer_en.trim();
    if (answer_ko !== undefined) data.answer_ko = answer_ko.trim();
    must(await sb.from('board').update(data).eq('id', id));
    refreshLive('board');
  },

  async deleteBoardEntry(id) {
    must(await sb.from('board').delete().eq('id', id));
    refreshLive('board');
  },

  /* ---------------- Admin auth ---------------- */

  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  // Checks the current password first, so an unattended signed-in
  // laptop can't be used to take over the account.
  async changePassword(currentPassword, newPassword) {
    const { data } = await sb.auth.getUser();
    const email = data && data.user && data.user.email;
    if (!email) throw new Error('Not signed in.');
    const check = await sb.auth.signInWithPassword({ email, password: currentPassword });
    if (check.error) throw check.error;
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
  async signOut() {
    await sb.auth.signOut();
  },
  // Calls back with { uid, email } when signed in, null when not.
  onAuthChange(callback) {
    let lastUid;
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      const user = session && session.user;
      const uid = user ? user.id : null;
      if (uid === lastUid) return;          // ignore token refreshes
      lastUid = uid;
      // Defer: Supabase recommends not awaiting other calls inside this callback.
      setTimeout(() => callback(user ? { uid: user.id, email: user.email } : null), 0);
    });
    return () => data.subscription.unsubscribe();
  },
  // A non-admin's read of submissions comes back empty rather than as an
  // error, so the admin page asks the database directly.
  async isAdmin() {
    return !!must(await sb.rpc('is_admin'));
  },
};

/* ============================================================
   Small helpers used by every page
   ============================================================ */

function formatDate(ts) {
  if (!ts) return 'Just now';
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = (str === undefined || str === null) ? '' : String(str);
  return div.innerHTML;
}

// True if a timestamp (ISO string from the database) is within the last `days` days.
function isWithinDays(ts, days) {
  if (!ts) return false;
  const ms = Date.now() - new Date(ts).getTime();
  return ms >= 0 && ms < days * 24 * 60 * 60 * 1000;
}
