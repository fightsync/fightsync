import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════
// LIGHTWEIGHT SUPABASE CLIENT (REST + Auth via fetch)
// Avoids @supabase/supabase-js (unsupported in preview sandbox)
// ═══════════════════════════════════════════════════════
const SUPABASE_URL = "https://wipfqwcwbigdfqmlupgc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NTtVoaW_gQe3dTvPkiixOQ_odnMUVi_";
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/dynamic-endpoint`;

let _session = null;
const _listeners = new Set();

function setSessionInternal(sess) {
  _session = sess;
  _listeners.forEach(fn => fn(sess));
}

class Query {
  constructor(table) {
    this.table = table;
    this.method = "GET";
    this.filters = [];
    this.selectCols = "*";
    this.body = null;
    this.order_ = null;
    this.single_ = false;
  }
  select(cols = "*") { this.selectCols = cols; if (this.method === "GET") this.method = "GET"; return this; }
  eq(col, val) { this.filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this; }
  order(col, opts = {}) { this.order_ = `${col}.${opts.ascending === false ? "desc" : "asc"}`; return this; }
  single() { this.single_ = true; return this; }
  insert(rows) { this.method = "POST"; this.body = rows; return this; }
  update(obj) { this.method = "PATCH"; this.body = obj; return this; }
  delete() { this.method = "DELETE"; return this; }

  async _exec() {
    let url = `${SUPABASE_URL}/rest/v1/${this.table}`;
    const params = [];
    if (this.method === "GET" || this.method === "PATCH" || this.method === "DELETE") {
      if (this.method === "GET") params.push(`select=${this.selectCols}`);
      if (this.order_) params.push(`order=${this.order_}`);
    }
    params.push(...this.filters);
    if (params.length) url += `?${params.join("&")}`;

    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Authorization": `Bearer ${_session?.access_token || SUPABASE_ANON_KEY}`,
    };
    if (this.method !== "GET") headers["Prefer"] = "return=representation";

    const opts = { method: this.method, headers };
    if (this.body !== null) opts.body = JSON.stringify(this.body);

    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try { const j = await res.json(); msg = j.message || j.msg || msg; } catch {}
        return { data: null, error: { message: msg } };
      }
      let data = null;
      const text = await res.text();
      if (text) data = JSON.parse(text);
      if (this.single_) {
        if (Array.isArray(data)) data = data[0] || null;
      }
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }
  then(resolve, reject) { return this._exec().then(resolve, reject); }
}

const supabase = {
  from(table) { return new Query(table); },
  auth: {
    async getSession() {
      return { data: { session: _session } };
    },
    onAuthStateChange(cb) {
      _listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => _listeners.delete(cb) } } };
    },
    async signInWithPassword({ email, password }) {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const j = await res.json();
        if (!res.ok) return { error: { message: j.error_description || j.msg || "Login failed" } };
        const sess = { access_token: j.access_token, refresh_token: j.refresh_token, user: j.user };
        setSessionInternal(sess);
        return { data: { session: sess }, error: null };
      } catch (e) {
        return { error: { message: e.message } };
      }
    },
    async signUp({ email, password }) {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: "POST",
          headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const j = await res.json();
        if (!res.ok) return { data: null, error: { message: j.error_description || j.msg || j.error || "Sign up failed" } };
        if (j.access_token) {
          const sess = { access_token: j.access_token, refresh_token: j.refresh_token, user: j.user };
          setSessionInternal(sess);
          return { data: { user: j.user, session: sess }, error: null };
        }
        // email confirmation required (no token returned)
        if (j.id) {
          return { data: { user: j }, error: null, needsConfirm: true };
        }
        return { data: null, error: { message: "Sign up failed" } };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
    async signOut() {
      setSessionInternal(null);
      return { error: null };
    },
  },
};


// ═══════════════════════════════════════════════════════
// TRANSLATIONS
// ═══════════════════════════════════════════════════════
const T = {
  en: {
    appName: "FightSync", tagline: "Combat Sports Event Platform",
    dashboard: "Dashboard", events: "Events", fighters: "Fighters",
    gyms: "Gyms", inbox: "Notifications", myBouts: "My Bouts",
    login: "Sign In", logout: "Sign Out", register: "Create Account",
    email: "Email Address", password: "Password", fullName: "Full Name",
    phone: "Phone Number", role: "I am a...",
    roleFighter: "Fighter", roleOrganizer: "Event Organizer / Gym Owner",
    roleAdmin: "Platform Admin",
    noAccount: "No account yet?", hasAccount: "Already have an account?",
    registerHere: "Register", loginHere: "Sign in",
    newEvent: "New Event", eventName: "Event Name", date: "Date",
    venue: "Venue / Location", mainBouts: "Main Card Bouts",
    reserveBouts: "Reserve Bouts", saveEvent: "Create Event",
    inviteLink: "Fighter Registration Link", copyLink: "Copy Link", copied: "Copied!",
    weight: "Weight (kg)", age: "Age", sport: "Discipline",
    gender: "Gender", fights: "Total Fights", wins: "Wins",
    selectGym: "Your Gym", joinEvent: "Register for Event",
    generate: "Auto-Generate Bouts", confirmBout: "Confirm My Bout",
    cancelBout: "Cancel Bout", cancelReason: "Reason for cancellation",
    doCancel: "Confirm Cancellation", boutConfirmed: "Confirmed ✓",
    pending: "Awaiting Confirmation", confirmed: "Confirmed",
    cancelled: "Cancelled", reserve: "Reserve",
    weightDiff: "Weight diff", expDiff: "Experience diff",
    vs: "vs", noBouts: "No bouts yet.", ready: "Available", notReady: "Unavailable",
    allUsers: "All Users", deleteUser: "Delete", suspend: "Suspend",
    restore: "Restore", superAdmin: "Super Admin",
    notifLog: "Notification Log", emailSent: "Email sent", clear: "Clear all",
    save: "Save", back: "Back", city: "City", coach: "Head Coach",
    gymName: "Gym Name", addGym: "Add Gym",
    noMatch: "No match found yet — added to waiting list",
    matchFound: "Match found!", waitlisted: "On waiting list",
    records: "Record", fights_label: "fights", wins_label: "wins",
    swappedIn: "Swapped into Main Card",
    boutCancelledNotif: "Your bout was cancelled",
    loading: "Loading...", error: "Error",
  },
  de: {
    appName: "FightSync", tagline: "Kampfsport Veranstaltungsplattform",
    dashboard: "Übersicht", events: "Veranstaltungen", fighters: "Kämpfer",
    gyms: "Gyms", inbox: "Benachrichtigungen", myBouts: "Meine Kämpfe",
    login: "Anmelden", logout: "Abmelden", register: "Konto erstellen",
    email: "E-Mail-Adresse", password: "Passwort", fullName: "Vollständiger Name",
    phone: "Telefonnummer", role: "Ich bin...",
    roleFighter: "Kämpfer", roleOrganizer: "Veranstalter / Gym-Besitzer",
    roleAdmin: "Plattform-Admin",
    noAccount: "Noch kein Konto?", hasAccount: "Bereits registriert?",
    registerHere: "Registrieren", loginHere: "Anmelden",
    newEvent: "Neue Veranstaltung", eventName: "Veranstaltungsname", date: "Datum",
    venue: "Ort / Veranstaltungsort", mainBouts: "Hauptkämpfe",
    reserveBouts: "Reservekämpfe", saveEvent: "Veranstaltung erstellen",
    inviteLink: "Kämpfer-Registrierungslink", copyLink: "Link kopieren", copied: "Kopiert!",
    weight: "Gewicht (kg)", age: "Alter", sport: "Disziplin",
    gender: "Geschlecht", fights: "Gesamtkämpfe", wins: "Siege",
    selectGym: "Dein Gym", joinEvent: "Für Veranstaltung anmelden",
    generate: "Kämpfe auto-generieren", confirmBout: "Kampf bestätigen",
    cancelBout: "Kampf absagen", cancelReason: "Grund der Absage",
    doCancel: "Absage bestätigen", boutConfirmed: "Bestätigt ✓",
    pending: "Warte auf Bestätigung", confirmed: "Bestätigt",
    cancelled: "Abgesagt", reserve: "Reserve",
    weightDiff: "Gewichtsdiff.", expDiff: "Erfahrungsdiff.",
    vs: "vs", noBouts: "Noch keine Kämpfe.", ready: "Verfügbar", notReady: "Nicht verfügbar",
    allUsers: "Alle Nutzer", deleteUser: "Löschen", suspend: "Sperren",
    restore: "Wiederherstellen", superAdmin: "Super Admin",
    notifLog: "Benachrichtigungs-Log", emailSent: "E-Mail gesendet", clear: "Alle löschen",
    save: "Speichern", back: "Zurück", city: "Stadt", coach: "Cheftrainer",
    gymName: "Gym-Name", addGym: "Gym hinzufügen",
    noMatch: "Kein Match gefunden — auf Warteliste gesetzt",
    matchFound: "Match gefunden!", waitlisted: "Auf Warteliste",
    records: "Bilanz", fights_label: "Kämpfe", wins_label: "Siege",
    swappedIn: "In Hauptkarte eingewechselt",
    boutCancelledNotif: "Dein Kampf wurde abgesagt",
    loading: "Lädt...", error: "Fehler",
  }
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
const expLabel = n => n === 0 ? "Debut" : n <= 3 ? "Beginner" : n <= 8 ? "Intermediate" : "Pro";
const expColor = n => n === 0 ? "#f59e0b" : n <= 3 ? "#60a5fa" : n <= 8 ? "#e0c264" : "#ef4444";
const fmtDate = d => d ? new Date(d).toLocaleDateString("de-DE") : "—";

function findBestMatch(fighter, pool) {
  let best = null, bestScore = -1;
  for (const opp of pool) {
    if (opp.id === fighter.id) continue;
    if (opp.gym_id === fighter.gym_id) continue;
    if (opp.gender !== fighter.gender) continue;
    if (opp.sport !== fighter.sport) continue;
    const wDiff = Math.abs(opp.weight - fighter.weight);
    if (wDiff > 2) continue;
    const fDiff = Math.abs(opp.fights - fighter.fights);
    const score = 100 - wDiff * 20 - fDiff * 5;
    if (score > bestScore) { bestScore = score; best = opp; }
  }
  return best;
}

function sortByExperience(bouts, profilesMap) {
  const expOf = id => profilesMap[id]?.fights || 0;
  return [...bouts].sort((a, b) => {
    const avgA = (expOf(a.fighter1_id) + expOf(a.fighter2_id)) / 2;
    const avgB = (expOf(b.fighter1_id) + expOf(b.fighter2_id)) / 2;
    return avgA - avgB;
  });
}

// send email via edge function (best-effort, never blocks UI)
async function sendEmail(to, subject, message) {
  try {
    await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to, subject, message }),
    });
  } catch (e) {
    console.warn("email send failed", e);
  }
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [lang, setLang] = useState("de");
  const t = T[lang];

  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [profiles, setProfiles] = useState([]); // all profiles (for matching/display)
  const [events, setEvents] = useState([]);
  const [bouts, setBouts] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [view, setView] = useState("dashboard");
  const [activeEventId, setActiveEventId] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [loadingData, setLoadingData] = useState(true);

  const showToast = (msg, color = "#4ade80") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  };

  // ── AUTH SESSION ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── LOAD PROFILE WHEN SESSION CHANGES ──
  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setProfile(null); return; }
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (!error) setProfile(data);
    })();
  }, [session]);

  // ── LOAD ALL DATA ──
  const loadAll = useCallback(async () => {
    setLoadingData(true);
    const [g, p, e, b, w] = await Promise.all([
      supabase.from("gyms").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("events").select("*").order("date"),
      supabase.from("bouts").select("*"),
      supabase.from("waitlist").select("*"),
    ]);
    if (g.data) setGyms(g.data);
    if (p.data) setProfiles(p.data);
    if (e.data) setEvents(e.data);
    if (b.data) setBouts(b.data);
    if (w.data) setWaitlist(w.data);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session, loadAll]);

  // load notifications for current user
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false });
      if (data) setNotifs(data);
    })();
  }, [profile]);

  const profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  // ── notify helper: insert row + send email ──
  const notify = async (userId, message, type = "info") => {
    const target = profiles.find(p => p.id === userId);
    await supabase.from("notifications").insert({ user_id: userId, message, type, email_sent: true });
    if (target?.email) sendEmail(target.email, `FightSync — ${type}`, message);
    if (profile && userId === profile.id) {
      setNotifs(n => [{ id: Date.now(), user_id: userId, message, type, created_at: new Date().toISOString(), email_sent: true }, ...n]);
    }
  };

  // ── AUTO MATCH a fighter into nearest upcoming event ──
  const autoMatchFighter = async (fighterProfile, currentEvents, currentBouts, currentWaitlist) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sorted = [...currentEvents].filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
    for (const ev of sorted) {
      const evBouts = currentBouts.filter(b => b.event_id === ev.id);
      const mainCount = evBouts.filter(b => !b.is_reserve).length;
      const reserveCount = evBouts.filter(b => b.is_reserve).length;
      const usedIds = new Set(evBouts.flatMap(b => [b.fighter1_id, b.fighter2_id]));
      const evWaitlistIds = currentWaitlist.filter(w => w.event_id === ev.id).map(w => w.fighter_id);
      const pool = profiles.filter(u => u.role === "fighter" && u.ready && !usedIds.has(u.id) && u.id !== fighterProfile.id && !evWaitlistIds.includes(u.id));
      const opp = findBestMatch(fighterProfile, pool);
      if (opp) {
        const isReserve = mainCount >= ev.main_count;
        if (isReserve && reserveCount >= ev.reserve_count) continue; // event full, try next
        const { data: inserted, error } = await supabase.from("bouts").insert({
          event_id: ev.id, fighter1_id: fighterProfile.id, fighter2_id: opp.id,
          sport: fighterProfile.sport, is_reserve: isReserve, status: "pending",
          f1_confirmed: false, f2_confirmed: false,
        }).select().single();
        if (!error && inserted) {
          setBouts(b => [...b, inserted]);
          await notify(fighterProfile.id, `${t.matchFound} vs ${opp.full_name} — ${ev.name} (${fmtDate(ev.date)})`, "match");
          await notify(opp.id, `${t.matchFound} vs ${fighterProfile.full_name} — ${ev.name} (${fmtDate(ev.date)})`, "match");
          showToast(`⚔ ${t.matchFound} vs ${opp.full_name}`);
        }
        return;
      }
      // waitlist
      const { data: wRow, error: wErr } = await supabase.from("waitlist").insert({ event_id: ev.id, fighter_id: fighterProfile.id }).select().single();
      if (!wErr && wRow) setWaitlist(w => [...w, wRow]);
      await notify(fighterProfile.id, t.noMatch, "wait");
      showToast(`⏳ ${t.noMatch}`, "#f59e0b");
      return;
    }
  };

  // ── AUTH HANDLERS ──
  const handleLogin = async (email, pw) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) return error.message;
    return null;
  };

  const handleRegister = async (form) => {
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (error) return error.message;
    if (!data.user) return "Registration failed";

    const profileRow = {
      id: data.user.id,
      full_name: form.fullName,
      phone: form.phone,
      role: form.role,
      gym_id: form.gymId || null,
      suspended: false,
    };
    if (form.role === "fighter") {
      Object.assign(profileRow, {
        weight: form.weight, age: form.age, gender: form.gender,
        sport: form.sport, fights: form.fights, wins: form.wins, ready: true,
      });
    }
    const { data: profData, error: profErr } = await supabase.from("profiles").insert(profileRow).select().single();
    if (profErr) return profErr.message;

    setProfile(profData);
    const newProfiles = [...profiles, profData];
    setProfiles(newProfiles);

    if (profData.role === "fighter") {
      await loadAll();
      setTimeout(async () => {
        const [{ data: ev }, { data: bt }, { data: wl }] = await Promise.all([
          supabase.from("events").select("*").order("date"),
          supabase.from("bouts").select("*"),
          supabase.from("waitlist").select("*"),
        ]);
        await autoMatchFighter(profData, ev || [], bt || [], wl || []);
        loadAll();
      }, 300);
    }
    return null;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setView("dashboard");
  };

  // ── CONFIRM BOUT ──
  const confirmBout = async (boutId) => {
    if (!profile) return;
    const bout = bouts.find(b => b.id === boutId);
    if (!bout) return;
    const isF1 = bout.fighter1_id === profile.id;
    const field = isF1 ? "f1_confirmed" : "f2_confirmed";
    const otherOk = isF1 ? bout.f2_confirmed : bout.f1_confirmed;
    const newStatus = otherOk ? "confirmed" : "pending";

    const { data, error } = await supabase.from("bouts").update({ [field]: true, status: newStatus }).eq("id", boutId).select().single();
    if (error) { showToast(error.message, "#ef4444"); return; }
    setBouts(bs => bs.map(b => b.id === boutId ? data : b));

    if (newStatus === "confirmed") {
      const oppId = isF1 ? bout.fighter2_id : bout.fighter1_id;
      const opp = profilesMap[oppId];
      await notify(profile.id, `${t.boutConfirmed} vs ${opp?.full_name}`, "confirmed");
      await notify(oppId, `${t.boutConfirmed} vs ${profile.full_name}`, "confirmed");
      showToast("✓ " + t.boutConfirmed);
    } else {
      showToast("✓ Confirmed your side");
    }
  };

  // ── CANCEL BOUT (organizer/admin) ──
  const cancelBout = async (eventId, boutId, reason) => {
    const bout = bouts.find(b => b.id === boutId);
    if (!bout) return;

    await supabase.from("bouts").update({ status: "cancelled", cancel_reason: reason }).eq("id", boutId);
    setBouts(bs => bs.map(b => b.id === boutId ? { ...b, status: "cancelled", cancel_reason: reason } : b));

    await notify(bout.fighter1_id, `${t.boutCancelledNotif}${reason ? ": " + reason : ""}`, "cancelled");
    await notify(bout.fighter2_id, `${t.boutCancelledNotif}${reason ? ": " + reason : ""}`, "cancelled");

    // swap a reserve of same sport into main
    const reserveCandidate = bouts.find(b => b.event_id === eventId && b.is_reserve && b.sport === bout.sport && b.status !== "cancelled" && b.id !== boutId);
    if (reserveCandidate) {
      await supabase.from("bouts").update({ is_reserve: false }).eq("id", reserveCandidate.id);
      setBouts(bs => bs.map(b => b.id === reserveCandidate.id ? { ...b, is_reserve: false } : b));
      await notify(reserveCandidate.fighter1_id, t.swappedIn, "swap");
      await notify(reserveCandidate.fighter2_id, t.swappedIn, "swap");
    }
    showToast("Bout cancelled", "#ef4444");
    setModal(null);
  };

  // ── GENERATE ALL BOUTS for an event ──
  const generateBouts = async (eventId) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    // remove existing non-confirmed/cancelled bouts? Simplify: skip if bouts already exist
    const existing = bouts.filter(b => b.event_id === eventId);
    if (existing.length > 0) { showToast("Bouts already exist for this event", "#f59e0b"); return; }

    const pool = profiles.filter(u => u.role === "fighter" && u.ready);
    const used = new Set();
    const newBouts = [];
    for (let i = 0; i < pool.length; i++) {
      if (used.has(pool[i].id)) continue;
      for (let j = i + 1; j < pool.length; j++) {
        if (used.has(pool[j].id)) continue;
        const a = pool[i], b = pool[j];
        if (a.gym_id === b.gym_id || a.gender !== b.gender || a.sport !== b.sport) continue;
        if (Math.abs(a.weight - b.weight) > 2) continue;
        used.add(a.id); used.add(b.id);
        const isReserve = newBouts.filter(x => !x.is_reserve).length >= ev.main_count;
        if (isReserve && newBouts.filter(x => x.is_reserve).length >= ev.reserve_count) break;
        newBouts.push({ event_id: eventId, fighter1_id: a.id, fighter2_id: b.id, sport: a.sport, is_reserve: isReserve, status: "pending", f1_confirmed: false, f2_confirmed: false });
        break;
      }
    }
    if (newBouts.length === 0) { showToast("No matches found", "#f59e0b"); return; }
    const { data, error } = await supabase.from("bouts").insert(newBouts).select();
    if (error) { showToast(error.message, "#ef4444"); return; }
    setBouts(bs => [...bs, ...data]);
    for (const b of data) {
      await notify(b.fighter1_id, `${t.matchFound} vs ${profilesMap[b.fighter2_id]?.full_name} — ${ev.name}`, "match");
      await notify(b.fighter2_id, `${t.matchFound} vs ${profilesMap[b.fighter1_id]?.full_name} — ${ev.name}`, "match");
    }
    showToast(`${data.length} bouts generated`);
  };

  // ── ADMIN actions ──
  const deleteUser = async (id) => {
    await supabase.from("profiles").delete().eq("id", id);
    setProfiles(ps => ps.filter(p => p.id !== id));
    showToast("User deleted", "#ef4444");
  };
  const toggleSuspend = async (id) => {
    const u = profiles.find(p => p.id === id);
    const { data } = await supabase.from("profiles").update({ suspended: !u.suspended }).eq("id", id).select().single();
    if (data) setProfiles(ps => ps.map(p => p.id === id ? data : p));
  };

  // ── ADD EVENT / GYM / FIGHTER (organizer) ──
  const addEvent = async (form) => {
    const { data, error } = await supabase.from("events").insert({
      name: form.name, date: form.date, venue: form.venue,
      main_count: form.mainCount, reserve_count: form.reserveCount,
      organizer_id: profile.id,
    }).select().single();
    if (error) { showToast(error.message, "#ef4444"); return; }
    setEvents(es => [...es, data]);
    setModal(null);
    showToast("Event created");
  };

  const addGym = async (form) => {
    const { data, error } = await supabase.from("gyms").insert({ name: form.name, city: form.city, coach: form.coach, owner_id: profile.id }).select().single();
    if (error) { showToast(error.message, "#ef4444"); return; }
    setGyms(gs => [...gs, data]);
    setModal(null);
    showToast("Gym added");
  };

  // ── RENDER GATES ──
  if (session === undefined || (session && !profile && loadingData === false)) {
    // still figuring things out
  }

  if (session === undefined) {
    return <CenterScreen><div style={{ color: "#666" }}>Loading...</div></CenterScreen>;
  }

  if (!session) {
    return <AuthScreen t={t} lang={lang} setLang={setLang} mode={authMode} setMode={setAuthMode} onLogin={handleLogin} onRegister={handleRegister} gyms={gyms} />;
  }

  if (!profile) {
    return <CenterScreen><div style={{ color: "#666" }}>{t.loading}</div></CenterScreen>;
  }

  const role = profile.role;
  const myNotifs = notifs;
  const unread = myNotifs.length;
  const activeEvent = activeEventId ? events.find(e => e.id === activeEventId) : null;

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "#080810", minHeight: "100vh", color: "#eee", maxWidth: 520, margin: "0 auto" }}>

      {/* TOPBAR */}
      <div style={{ background: "#0e0e1a", borderBottom: "1px solid #1e1e30", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(activeEvent || view !== "dashboard") && (
              <button onClick={() => { setActiveEventId(null); setView("dashboard"); }} style={s.ghostBtn}>←</button>
            )}
            <span style={{ fontWeight: 900, fontSize: 17, color: "#fff", letterSpacing: -0.5 }}>
              𓁹 <span style={{ color: "#c9a227" }}>Fight</span>Sync
            </span>
            {role === "admin" && <span style={{ background: "#c9a227", color: "#000", fontSize: 10, fontWeight: 800, borderRadius: 4, padding: "1px 6px" }}>ADMIN</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setLang(l => l === "en" ? "de" : "en")} style={{ ...s.ghostBtn, fontSize: 11, border: "1px solid #2a2a40", borderRadius: 5, padding: "3px 8px" }}>
              {lang === "en" ? "DE" : "EN"}
            </button>
            {unread > 0 && (
              <button onClick={() => setView("inbox")} style={{ background: "#ef4444", border: "none", borderRadius: 10, color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", cursor: "pointer" }}>
                {unread}
              </button>
            )}
            <button onClick={handleLogout} style={{ ...s.ghostBtn, fontSize: 12, color: "#666" }}>{t.logout}</button>
          </div>
        </div>
        <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#c9a227", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: "#000", flexShrink: 0 }}>
            {profile.full_name?.[0]}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#ddd" }}>{profile.full_name}</div>
            <div style={{ fontSize: 10, color: "#555" }}>
              {role === "fighter" ? `${profile.weight}kg · ${profile.sport} · ${gyms.find(g => g.id === profile.gym_id)?.name || ""}` : role === "organizer" ? `${t.roleOrganizer} · ${gyms.find(g => g.id === profile.gym_id)?.name || ""}` : t.superAdmin}
            </div>
          </div>
        </div>
        {!activeEvent && (
          <div style={{ display: "flex", borderTop: "1px solid #1a1a2a" }}>
            {(role === "admin" ? ["dashboard", "events", "allUsers", "inbox"]
              : role === "organizer" ? ["dashboard", "events", "fighters", "gyms", "inbox"]
              : ["dashboard", "myBouts", "inbox"]
            ).map(k => (
              <button key={k} onClick={() => setView(k)} style={{
                flex: 1, background: "none", border: "none",
                borderBottom: view === k ? "2px solid #c9a227" : "2px solid transparent",
                color: view === k ? "#c9a227" : "#555", padding: "9px 0",
                fontWeight: view === k ? 800 : 400, cursor: "pointer", fontSize: 11,
                textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap"
              }}>
                {k === "allUsers" ? t.allUsers : t[k]}
                {k === "inbox" && unread > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 8, fontSize: 9, fontWeight: 800, padding: "1px 4px", marginLeft: 3 }}>{unread}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", background: toast.color, color: "#000", borderRadius: 8, padding: "8px 18px", fontWeight: 800, fontSize: 13, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: 14 }}>
        {loadingData ? (
          <Empty>{t.loading}</Empty>
        ) : (
          <>
            {activeEvent && (
              <EventDetail
                ev={activeEvent}
                bouts={bouts.filter(b => b.event_id === activeEvent.id)}
                waitlist={waitlist.filter(w => w.event_id === activeEvent.id)}
                profilesMap={profilesMap} t={t} currentProfile={profile}
                onGenerate={role === "organizer" || role === "admin" ? () => generateBouts(activeEvent.id) : null}
                onConfirm={role === "fighter" ? confirmBout : null}
                onCancelBout={(role === "organizer" || role === "admin") ? boutId => setModal({ type: "cancel", data: { eventId: activeEvent.id, boutId } }) : null}
                onInviteLink={() => {
                  const link = `${window.location.origin}/?event=${activeEvent.id}`;
                  navigator.clipboard?.writeText(link).catch(() => {});
                  setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
                  showToast(t.copied);
                }}
                copiedLink={copiedLink}
              />
            )}

            {!activeEvent && view === "dashboard" && (
              <Dashboard profiles={profiles} events={events} gyms={gyms} bouts={bouts} waitlist={waitlist} t={t} currentProfile={profile} notifs={myNotifs} onGoEvent={id => setActiveEventId(id)} />
            )}

            {!activeEvent && view === "events" && (
              <div>
                <div style={s.rowBetween}>
                  <Label>{t.events}</Label>
                  {(role === "organizer" || role === "admin") && <GoldBtn onClick={() => setModal({ type: "addEvent" })}>{t.newEvent}</GoldBtn>}
                </div>
                {events.map(ev => (
                  <EventCard key={ev.id} ev={ev} bouts={bouts.filter(b => b.event_id === ev.id)} waitlist={waitlist.filter(w => w.event_id === ev.id)} t={t} onClick={() => setActiveEventId(ev.id)} />
                ))}
                {events.length === 0 && <Empty>{t.noBouts}</Empty>}
              </div>
            )}

            {!activeEvent && view === "myBouts" && (
              <FighterBouts currentProfile={profile} events={events} bouts={bouts} profilesMap={profilesMap} waitlist={waitlist} t={t} onConfirm={confirmBout} />
            )}

            {!activeEvent && view === "fighters" && role === "organizer" && (
              <div>
                <Label>{t.fighters}</Label>
                {profiles.filter(u => u.role === "fighter").map(f => (
                  <FighterCard key={f.id} f={f} gym={gyms.find(g => g.id === f.gym_id)} t={t}
                    onToggle={async () => {
                      const { data } = await supabase.from("profiles").update({ ready: !f.ready }).eq("id", f.id).select().single();
                      if (data) setProfiles(ps => ps.map(p => p.id === f.id ? data : p));
                    }} />
                ))}
              </div>
            )}

            {!activeEvent && view === "gyms" && role === "organizer" && (
              <div>
                <div style={s.rowBetween}>
                  <Label>{t.gyms}</Label>
                  <GoldBtn onClick={() => setModal({ type: "addGym" })}>{t.addGym}</GoldBtn>
                </div>
                {gyms.map(g => (
                  <Card key={g.id}>
                    <div style={{ fontWeight: 700 }}>{g.name}</div>
                    <div style={{ color: "#777", fontSize: 12 }}>{g.city} · {t.coach}: {g.coach}</div>
                    <div style={{ color: "#c9a227", fontSize: 11, marginTop: 4 }}>{profiles.filter(u => u.gym_id === g.id && u.role === "fighter").length} fighters</div>
                  </Card>
                ))}
              </div>
            )}

            {!activeEvent && view === "inbox" && (
              <div>
                <div style={s.rowBetween}>
                  <Label>{t.notifLog}</Label>
                  {myNotifs.length > 0 && (
                    <button onClick={async () => {
                      await supabase.from("notifications").delete().eq("user_id", profile.id);
                      setNotifs([]);
                    }} style={{ ...s.ghostBtn, fontSize: 12, color: "#ef4444" }}>{t.clear}</button>
                  )}
                </div>
                {myNotifs.length === 0 && <Empty>No notifications</Empty>}
                {myNotifs.map(n => (
                  <div key={n.id} style={{ background: "#0e0e1a", border: `1px solid ${n.type === "confirmed" ? "#1a3a1a" : n.type === "cancelled" ? "#3a1a1a" : n.type === "match" ? "#2a2410" : "#1e1e30"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: n.type === "confirmed" ? "#4ade80" : n.type === "cancelled" ? "#ef4444" : n.type === "match" ? "#e0c264" : "#ccc" }}>{n.message}</div>
                    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                      <span style={{ fontSize: 10, color: "#4ade80" }}>✉ {t.emailSent}</span>
                      <span style={{ fontSize: 10, color: "#555", marginLeft: "auto" }}>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!activeEvent && view === "allUsers" && role === "admin" && (
              <div>
                <Label>{t.allUsers}</Label>
                {profiles.filter(u => u.role !== "admin").map(u => (
                  <Card key={u.id} style={{ borderLeft: `3px solid ${u.suspended ? "#ef4444" : u.role === "organizer" ? "#f59e0b" : "#c9a227"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{u.full_name}</div>
                        <div style={{ color: "#666", fontSize: 11 }}>{u.phone}</div>
                        <div style={{ fontSize: 11, color: u.role === "organizer" ? "#f59e0b" : "#c9a227", marginTop: 2 }}>{u.role} {u.suspended && <span style={{ color: "#ef4444" }}>· SUSPENDED</span>}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => toggleSuspend(u.id)} style={{ background: u.suspended ? "#0d1a0d" : "#1a0808", border: `1px solid ${u.suspended ? "#4ade80" : "#f59e0b"}`, borderRadius: 5, color: u.suspended ? "#4ade80" : "#f59e0b", padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>
                          {u.suspended ? t.restore : t.suspend}
                        </button>
                        <button onClick={() => deleteUser(u.id)} style={{ background: "#1a0808", border: "1px solid #ef4444", borderRadius: 5, color: "#ef4444", padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>{t.deleteUser}</button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modal?.type === "cancel" && (
        <CancelModal t={t} onConfirm={reason => cancelBout(modal.data.eventId, modal.data.boutId, reason)} onClose={() => setModal(null)} />
      )}
      {modal?.type === "addEvent" && (
        <AddEventModal t={t} onSave={addEvent} onClose={() => setModal(null)} />
      )}
      {modal?.type === "addGym" && (
        <AddGymModal t={t} onSave={addGym} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CENTER SCREEN
// ═══════════════════════════════════════════════════════
function CenterScreen({ children }) {
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "#080810", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
function Dashboard({ profiles, events, gyms, bouts, waitlist, t, currentProfile, notifs, onGoEvent }) {
  const role = currentProfile.role;
  const fighters = profiles.filter(u => u.role === "fighter");
  const confirmed = bouts.filter(b => b.status === "confirmed").length;
  const pending = bouts.filter(b => b.status === "pending").length;

  if (role === "fighter") {
    const myBouts = bouts.filter(b => b.fighter1_id === currentProfile.id || b.fighter2_id === currentProfile.id)
      .map(b => ({ ...b, ev: events.find(e => e.id === b.event_id) }));
    const waitlisted = waitlist.filter(w => w.fighter_id === currentProfile.id).map(w => events.find(e => e.id === w.event_id)).filter(Boolean);
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Hi, {currentProfile.full_name?.split(" ")[0]} 👋</div>
        <div style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>{currentProfile.weight}kg · {currentProfile.sport} · {expLabel(currentProfile.fights)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <StatBox label="My Bouts" value={myBouts.length} color="#c9a227" />
          <StatBox label={t.confirmed} value={myBouts.filter(b => b.status === "confirmed").length} color="#4ade80" />
        </div>
        {myBouts.length === 0 && waitlisted.length === 0 && <Empty>No bouts yet. Wait for auto-match.</Empty>}
        {waitlisted.map(e => (
          <Card key={e.id} style={{ borderLeft: "3px solid #f59e0b" }}>
            <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 13 }}>⏳ {t.waitlisted}</div>
            <div style={{ color: "#888", fontSize: 12 }}>{e.name} · {fmtDate(e.date)}</div>
          </Card>
        ))}
        {myBouts.slice(0, 3).map(b => {
          const oppId = b.fighter1_id === currentProfile.id ? b.fighter2_id : b.fighter1_id;
          const opp = profiles.find(u => u.id === oppId);
          return (
            <Card key={b.id} style={{ borderLeft: `3px solid ${b.status === "confirmed" ? "#4ade80" : b.status === "cancelled" ? "#ef4444" : "#c9a227"}` }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{b.ev?.name}</div>
              <div style={{ color: "#888", fontSize: 12 }}>vs {opp?.full_name} · {b.sport}</div>
              <StatusPill status={b.status} t={t} />
            </Card>
          );
        })}
        {notifs.slice(0, 3).map(n => (
          <div key={n.id} style={{ background: "#0e0e1a", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12, color: "#aaa", borderLeft: "2px solid #c9a227" }}>{n.message}</div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Dashboard</div>
      <div style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>{role === "admin" ? t.superAdmin : t.roleOrganizer}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatBox label={t.fighters} value={fighters.length} color="#c9a227" />
        <StatBox label={t.events} value={events.length} color="#e0c264" />
        <StatBox label={t.confirmed} value={confirmed} color="#4ade80" />
        <StatBox label={t.pending} value={pending} color="#f59e0b" />
      </div>
      <Label>{t.events}</Label>
      {events.map(ev => <EventCard key={ev.id} ev={ev} bouts={bouts.filter(b => b.event_id === ev.id)} waitlist={waitlist.filter(w => w.event_id === ev.id)} t={t} onClick={() => onGoEvent(ev.id)} />)}
      {events.length === 0 && <Empty>{t.noBouts}</Empty>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EVENT CARD
// ═══════════════════════════════════════════════════════
function EventCard({ ev, bouts, waitlist, t, onClick }) {
  const main = bouts.filter(b => !b.is_reserve);
  const confirmed = main.filter(b => b.status === "confirmed").length;
  const pending = main.filter(b => b.status === "pending").length;
  return (
    <Card onClick={onClick} style={{ cursor: "pointer", borderLeft: "3px solid #c9a227" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>{ev.name}</div>
          <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>📅 {fmtDate(ev.date)} · 📍 {ev.venue}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11 }}>
          {main.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
              <Chip color="#4ade80" bg="#0d1a0d">{confirmed} ✓</Chip>
              {pending > 0 && <Chip color="#f59e0b" bg="#1a1500">{pending} ⏳</Chip>}
            </div>
          ) : <span style={{ color: "#444", fontSize: 11 }}>{ev.main_count} bouts planned</span>}
        </div>
      </div>
      {waitlist.length > 0 && <div style={{ color: "#f59e0b", fontSize: 11, marginTop: 4 }}>⏳ {waitlist.length} on waitlist</div>}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// EVENT DETAIL
// ═══════════════════════════════════════════════════════
function EventDetail({ ev, bouts, profilesMap, t, currentProfile, onGenerate, onConfirm, onCancelBout, onInviteLink, copiedLink }) {
  const main = sortByExperience(bouts.filter(b => !b.is_reserve), profilesMap);
  const reserve = bouts.filter(b => b.is_reserve);
  const confirmed = main.filter(b => b.status === "confirmed").length;
  const pending = main.filter(b => b.status === "pending").length;
  const cancelled = main.filter(b => b.status === "cancelled").length;

  return (
    <div>
      <div style={{ background: "#0e0e1a", border: "1px solid #1e1e30", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>{ev.name}</div>
        <div style={{ color: "#666", fontSize: 12, marginTop: 3 }}>📅 {fmtDate(ev.date)} · 📍 {ev.venue}</div>
        {bouts.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Chip color="#4ade80" bg="#0d1a0d">{confirmed} {t.confirmed}</Chip>
            <Chip color="#f59e0b" bg="#1a1500">{pending} {t.pending}</Chip>
            <Chip color="#ef4444" bg="#1a0808">{cancelled} {t.cancelled}</Chip>
            <Chip color="#e0c264" bg="#2a2410">{reserve.length} {t.reserve}</Chip>
          </div>
        )}
        {(onGenerate || onInviteLink) && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {onGenerate && <GoldBtn onClick={onGenerate}>{t.generate}</GoldBtn>}
            {onInviteLink && <button onClick={onInviteLink} style={{ background: "#1a1a2a", border: "1px solid #c9a227", borderRadius: 7, color: "#c9a227", padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{copiedLink ? t.copied : t.copyLink}</button>}
          </div>
        )}
      </div>

      {bouts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚔️</div>
          <div style={{ color: "#555", fontSize: 14 }}>{t.noBouts}</div>
        </div>
      ) : (
        <div>
          <Label>{t.mainBouts} ({main.length})</Label>
          {main.map((b, i) => (
            <BoutRow key={b.id} b={b} num={i + 1} profilesMap={profilesMap} t={t} currentProfile={currentProfile}
              onConfirm={onConfirm ? () => onConfirm(b.id) : null}
              onCancel={onCancelBout && b.status !== "cancelled" ? () => onCancelBout(b.id) : null} />
          ))}
          {reserve.length > 0 && (
            <>
              <Label style={{ marginTop: 18 }}>{t.reserveBouts} ({reserve.length})</Label>
              {reserve.map((b, i) => (
                <BoutRow key={b.id} b={b} num={`R${i + 1}`} profilesMap={profilesMap} t={t} currentProfile={currentProfile} isReserve
                  onConfirm={onConfirm ? () => onConfirm(b.id) : null} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BOUT ROW
// ═══════════════════════════════════════════════════════
function BoutRow({ b, num, profilesMap, t, currentProfile, onConfirm, onCancel, isReserve }) {
  const f1 = profilesMap[b.fighter1_id];
  const f2 = profilesMap[b.fighter2_id];
  const isMine = currentProfile && (b.fighter1_id === currentProfile.id || b.fighter2_id === currentProfile.id);
  const myOk = currentProfile && (b.fighter1_id === currentProfile.id ? b.f1_confirmed : b.f2_confirmed);
  const isCancelled = b.status === "cancelled";
  const isConfirmed = b.status === "confirmed";

  return (
    <div style={{
      background: isCancelled ? "#100808" : isConfirmed ? "#081008" : isReserve ? "#08081a" : "#0e0e1a",
      border: `1px solid ${isCancelled ? "#2a1010" : isConfirmed ? "#0d2a0d" : isMine ? "#c9a227" : "#1e1e30"}`,
      borderRadius: 10, padding: "10px 12px", marginBottom: 8, opacity: isCancelled ? 0.6 : 1
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ background: "#1a1a2a", color: isReserve ? "#e0c264" : "#c9a227", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>#{num}</span>
            <span style={{ background: "#2a2410", color: "#e0c264", borderRadius: 4, padding: "1px 7px", fontSize: 10 }}>{b.sport}</span>
            <StatusPill status={b.status} t={t} small />
            {isMine && !isCancelled && <span style={{ background: "#2a2410", color: "#e0c264", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 800 }}>YOU</span>}
          </div>
          <FighterLine f={f1} ok={b.f1_confirmed} isMe={currentProfile?.id === f1?.id} />
          <div style={{ color: "#333", fontSize: 10, textAlign: "center", margin: "3px 0" }}>──── vs ────</div>
          <FighterLine f={f2} ok={b.f2_confirmed} isMe={currentProfile?.id === f2?.id} />
          <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
            <span style={{ fontSize: 10, color: "#444" }}>⚖ {Math.abs((f1?.weight || 0) - (f2?.weight || 0)).toFixed(1)}kg</span>
            <span style={{ fontSize: 10, color: "#444" }}>🥊 {Math.abs((f1?.fights || 0) - (f2?.fights || 0))} fights</span>
          </div>
          {isCancelled && b.cancel_reason && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>⚠ {b.cancel_reason}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 10 }}>
          {onConfirm && isMine && !myOk && !isCancelled && (
            <button onClick={onConfirm} style={{ background: "linear-gradient(135deg,#c9a227,#a07d18)", border: "none", borderRadius: 7, color: "#000", padding: "7px 12px", fontWeight: 800, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>
              ✓ {t.confirmBout}
            </button>
          )}
          {onCancel && !isCancelled && (
            <button onClick={onCancel} style={{ background: "#1a0808", border: "1px solid #ef4444", borderRadius: 6, color: "#ef4444", padding: "5px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

function FighterLine({ f, ok, isMe }) {
  if (!f) return <div style={{ color: "#444", fontSize: 12 }}>TBD</div>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      <span style={{ fontWeight: isMe ? 800 : 600, fontSize: 13, color: isMe ? "#e0c264" : "#ddd" }}>{f.full_name}</span>
      <span style={{ color: "#666", fontSize: 11 }}>{f.weight}kg</span>
      <span style={{ fontSize: 10, background: "#111", color: expColor(f.fights), borderRadius: 3, padding: "1px 5px" }}>{expLabel(f.fights)}</span>
      <span style={{ fontSize: 11 }}>{ok ? "✅" : "⏳"}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FIGHTER BOUTS VIEW
// ═══════════════════════════════════════════════════════
function FighterBouts({ currentProfile, events, bouts, profilesMap, waitlist, t, onConfirm }) {
  const myBouts = bouts.filter(b => b.fighter1_id === currentProfile.id || b.fighter2_id === currentProfile.id)
    .map(b => ({ ...b, ev: events.find(e => e.id === b.event_id) }));
  const waitlisted = waitlist.filter(w => w.fighter_id === currentProfile.id).map(w => events.find(e => e.id === w.event_id)).filter(Boolean);
  return (
    <div>
      <Label>{t.myBouts}</Label>
      {myBouts.length === 0 && waitlisted.length === 0 && <Empty>{t.noBouts}</Empty>}
      {waitlisted.map(e => (
        <Card key={e.id} style={{ borderLeft: "3px solid #f59e0b" }}>
          <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 13 }}>⏳ {t.waitlisted}</div>
          <div style={{ color: "#888", fontSize: 12 }}>{e.name} · {fmtDate(e.date)}</div>
        </Card>
      ))}
      {myBouts.map(b => {
        const oppId = b.fighter1_id === currentProfile.id ? b.fighter2_id : b.fighter1_id;
        const opp = profilesMap[oppId];
        const myOk = b.fighter1_id === currentProfile.id ? b.f1_confirmed : b.f2_confirmed;
        return (
          <Card key={b.id} style={{ borderLeft: `3px solid ${b.status === "confirmed" ? "#4ade80" : b.status === "cancelled" ? "#ef4444" : "#c9a227"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{b.ev?.name}</div>
                <div style={{ color: "#666", fontSize: 12 }}>📅 {fmtDate(b.ev?.date)}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <span style={{ color: "#e0c264" }}>vs </span>
                  <span style={{ fontWeight: 700 }}>{opp?.full_name || "TBD"}</span>
                  <span style={{ color: "#555", fontSize: 11, marginLeft: 6 }}>{opp?.weight}kg · {b.sport}</span>
                </div>
                <StatusPill status={b.status} t={t} />
              </div>
              {!myOk && b.status !== "cancelled" && (
                <button onClick={() => onConfirm(b.id)} style={{ background: "linear-gradient(135deg,#c9a227,#a07d18)", border: "none", borderRadius: 7, color: "#000", padding: "8px 12px", fontWeight: 800, cursor: "pointer", fontSize: 11, marginLeft: 8 }}>
                  ✓ {t.confirmBout}
                </button>
              )}
              {myOk && b.status !== "confirmed" && b.status !== "cancelled" && (
                <span style={{ fontSize: 11, color: "#4ade80", background: "#0d1a0d", borderRadius: 6, padding: "4px 8px", marginLeft: 8 }}>✓ You confirmed</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FIGHTER CARD
// ═══════════════════════════════════════════════════════
function FighterCard({ f, gym, t, onToggle }) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{f.full_name}</div>
          <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>{gym?.name} · {f.weight}kg · {f.sport} · {f.gender === "male" ? "♂" : "♀"} · {f.age}y</div>
          <div style={{ color: "#555", fontSize: 11 }}>{f.phone}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: expColor(f.fights), background: "#111", borderRadius: 3, padding: "1px 6px" }}>{expLabel(f.fights)}</span>
            <span style={{ fontSize: 11, color: "#555" }}>{f.fights} fights / {f.wins} wins</span>
          </div>
        </div>
        <button onClick={onToggle} style={{ background: f.ready ? "#0d1a0d" : "#1a0808", border: `1px solid ${f.ready ? "#4ade80" : "#ef4444"}`, borderRadius: 6, color: f.ready ? "#4ade80" : "#ef4444", padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
          {f.ready ? t.ready : t.notReady}
        </button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════
function AuthScreen({ t, lang, setLang, mode, setMode, onLogin, onRegister, gyms }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("fighter");
  const [gymId, setGymId] = useState(gyms[0]?.id || "");
  const [sport, setSport] = useState("Kickboxen");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [fights, setFights] = useState(0);
  const [wins, setWins] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!gymId && gyms[0]) setGymId(gyms[0].id); }, [gyms]);

  const go = async () => {
    setErr(""); setBusy(true);
    let e;
    if (mode === "login") {
      e = await onLogin(email, pw);
    } else {
      if (!fullName || !email || !phone || !pw) { setErr("All fields required"); setBusy(false); return; }
      e = await onRegister({ fullName, email, phone, password: pw, role, gymId: gymId ? +gymId : null, sport, weight: +weight, age: +age, gender, fights: +fights, wins: +wins });
    }
    setBusy(false);
    if (e) setErr(e);
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "#080810", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 42, marginBottom: 8 }}>𓁹</div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -1 }}><span style={{ color: "#c9a227" }}>Fight</span><span style={{ color: "#fff" }}>Sync</span></div>
        <div style={{ color: "#444", fontSize: 13, marginTop: 4 }}>{t.tagline}</div>
      </div>
      <div style={{ background: "#0e0e1a", border: "1px solid #1e1e30", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 16 }}>{mode === "login" ? t.login : t.register}</h2>
          <button onClick={() => setLang(l => l === "en" ? "de" : "en")} style={{ background: "#1a1a2a", border: "1px solid #c9a227", borderRadius: 5, color: "#c9a227", padding: "3px 9px", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>{lang === "en" ? "DE" : "EN"}</button>
        </div>

        {mode === "register" && (
          <>
            <FF label={t.fullName} value={fullName} onChange={setFullName} />
            <FF label={t.phone} value={phone} onChange={setPhone} placeholder="+49..." />
            <div style={{ marginBottom: 12 }}>
              <label style={s.lbl}>{t.role}</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["fighter", "organizer"].map(r => (
                  <button key={r} onClick={() => setRole(r)} style={{ flex: 1, background: role === r ? "#c9a227" : "#1a1a2a", border: `1px solid ${role === r ? "#c9a227" : "#2a2a40"}`, borderRadius: 7, color: role === r ? "#000" : "#666", padding: "9px 0", fontWeight: role === r ? 800 : 400, cursor: "pointer", fontSize: 12 }}>
                    {r === "fighter" ? t.roleFighter : t.roleOrganizer}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={s.lbl}>{t.selectGym}</label>
              <select value={gymId} onChange={e => setGymId(e.target.value)} style={s.sel}>
                <option value="">—</option>
                {gyms.map(g => <option key={g.id} value={g.id}>{g.name} — {g.city}</option>)}
              </select>
            </div>
            {role === "fighter" && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <FF label={t.weight} value={weight} type="number" onChange={setWeight} />
                  <FF label={t.age} value={age} type="number" onChange={setAge} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <FF label={t.fights} value={fights} type="number" onChange={setFights} />
                  <FF label={t.wins} value={wins} type="number" onChange={setWins} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={s.lbl}>{t.sport}</label>
                  <select value={sport} onChange={e => setSport(e.target.value)} style={s.sel}>
                    {["Kickboxen", "Boxen", "Muay Thai", "Grappling", "MMA"].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={s.lbl}>{t.gender}</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} style={s.sel}>
                    <option value="male">Male / Männlich</option>
                    <option value="female">Female / Weiblich</option>
                  </select>
                </div>
              </>
            )}
          </>
        )}

        <FF label={t.email} value={email} onChange={setEmail} placeholder="email@example.com" />
        <FF label={t.password} value={pw} type="password" onChange={setPw} />
        {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>⚠ {err}</div>}
        <GoldBtn onClick={go} style={{ width: "100%", padding: 12, fontSize: 14, opacity: busy ? 0.6 : 1 }}>
          {busy ? "..." : (mode === "login" ? t.login : t.register)}
        </GoldBtn>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#555" }}>
          {mode === "login" ? t.noAccount : t.hasAccount}{" "}
          <span onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }} style={{ color: "#c9a227", cursor: "pointer", fontWeight: 700 }}>
            {mode === "login" ? t.registerHere : t.loginHere}
          </span>
        </div>
        <div style={{ marginTop: 16, background: "#111", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#555" }}>
          ⚠ Email confirmation may be required depending on Supabase Auth settings. If login fails right after signup, check Authentication → Settings → "Confirm email" in Supabase, or check your inbox for a confirmation link.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════
function CancelModal({ t, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <Modal onClose={onClose}>
      <h3 style={{ color: "#ef4444", marginTop: 0 }}>✕ {t.cancelBout}</h3>
      <FF label={t.cancelReason} value={reason} onChange={setReason} />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onClose} style={{ flex: 1, background: "#1a1a2a", border: "1px solid #2a2a40", borderRadius: 7, color: "#666", padding: 10, cursor: "pointer" }}>{t.back}</button>
        <button onClick={() => onConfirm(reason)} style={{ flex: 2, background: "#ef4444", border: "none", borderRadius: 7, color: "#fff", padding: 10, fontWeight: 800, cursor: "pointer" }}>{t.doCancel}</button>
      </div>
    </Modal>
  );
}

function AddEventModal({ t, onSave, onClose }) {
  const [form, setForm] = useState({ name: "", date: "", venue: "", mainCount: 25, reserveCount: 5 });
  return (
    <Modal onClose={onClose}>
      <h3 style={{ color: "#c9a227", marginTop: 0 }}>{t.newEvent}</h3>
      <FF label={t.eventName} value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
      <FF label={t.date} value={form.date} type="date" onChange={v => setForm(f => ({ ...f, date: v }))} />
      <FF label={t.venue} value={form.venue} onChange={v => setForm(f => ({ ...f, venue: v }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <FF label={t.mainBouts} value={form.mainCount} type="number" onChange={v => setForm(f => ({ ...f, mainCount: +v }))} />
        <FF label={t.reserveBouts} value={form.reserveCount} type="number" onChange={v => setForm(f => ({ ...f, reserveCount: +v }))} />
      </div>
      <GoldBtn onClick={() => onSave(form)} style={{ width: "100%", marginTop: 8 }}>{t.saveEvent}</GoldBtn>
    </Modal>
  );
}

function AddGymModal({ t, onSave, onClose }) {
  const [form, setForm] = useState({ name: "", city: "", coach: "", phone: "" });
  return (
    <Modal onClose={onClose}>
      <h3 style={{ color: "#c9a227", marginTop: 0 }}>{t.addGym}</h3>
      <FF label={t.gymName} value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
      <FF label={t.city} value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
      <FF label={t.coach} value={form.coach} onChange={v => setForm(f => ({ ...f, coach: v }))} />
      <GoldBtn onClick={() => onSave(form)} style={{ width: "100%", marginTop: 8 }}>{t.save}</GoldBtn>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// UI ATOMS
// ═══════════════════════════════════════════════════════
const Card = ({ children, onClick, style }) => <div onClick={onClick} style={{ background: "#0e0e1a", border: "1px solid #1e1e30", borderRadius: 10, padding: 14, marginBottom: 10, ...style }}>{children}</div>;
const GoldBtn = ({ children, onClick, style }) => <button onClick={onClick} style={{ background: "linear-gradient(135deg,#c9a227,#a07d18)", border: "none", borderRadius: 7, color: "#000", padding: "8px 16px", fontWeight: 800, cursor: "pointer", fontSize: 13, ...style }}>{children}</button>;
const Chip = ({ children, color, bg }) => <span style={{ background: bg, color, borderRadius: 5, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>{children}</span>;
const Label = ({ children, style }) => <div style={{ color: "#c9a227", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, ...style }}>{children}</div>;
const Modal = ({ children, onClose }) => <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "flex-end", zIndex: 200 }}><div style={{ background: "#0e0e1a", borderRadius: "16px 16px 0 0", padding: 20, width: "100%", maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box" }}><button onClick={onClose} style={{ float: "right", background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>{children}</div></div>;
const FF = ({ label, value, onChange, type = "text", placeholder }) => <div style={{ marginBottom: 12 }}><label style={s.lbl}>{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: "#080810", border: "1px solid #1e1e30", borderRadius: 7, padding: "9px 11px", color: "#eee", fontSize: 14, boxSizing: "border-box", outline: "none" }} /></div>;
const StatBox = ({ label, value, color }) => <div style={{ background: "#0e0e1a", border: "1px solid #1e1e30", borderRadius: 10, padding: "14px 16px" }}><div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div><div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{label}</div></div>;
const Empty = ({ children }) => <div style={{ color: "#333", textAlign: "center", padding: "40px 0", fontSize: 13 }}>{children}</div>;
const StatusPill = ({ status, t, small }) => { const cfg = { confirmed: { bg: "#0d1a0d", color: "#4ade80", l: t.confirmed }, pending: { bg: "#1a1500", color: "#f59e0b", l: t.pending }, cancelled: { bg: "#1a0808", color: "#ef4444", l: t.cancelled } }; const c = cfg[status] || cfg.pending; return <span style={{ background: c.bg, color: c.color, borderRadius: 4, padding: small ? "1px 5px" : "3px 8px", fontSize: small ? 9 : 11, fontWeight: 700, marginTop: 4, display: "inline-block" }}>{c.l}</span>; };

const s = {
  ghostBtn: { background: "none", border: "none", color: "#888", cursor: "pointer", padding: "4px 6px", fontSize: 14 },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  lbl: { fontSize: 12, color: "#555", display: "block", marginBottom: 4 },
  sel: { width: "100%", background: "#080810", border: "1px solid #1e1e30", borderRadius: 7, padding: "9px 11px", color: "#eee", fontSize: 14 },
};
