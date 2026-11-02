const CHILDREN = [
  { code: "ZS", name: "Zsófi" },
  { code: "MI", name: "Misi" },
  { code: "MA", name: "Marci" },
  { code: "JU", name: "Juli" }
];
const MAMMY = { code: "MM", name: "Mammy" };
const PEOPLE = [...CHILDREN, MAMMY];
const VALID_PERSON_CODES = new Set(PEOPLE.map(person => person.code));

const DAYS = ["Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"];
const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const PERIOD_NAMES = { am: "Délelőtt", pm: "Délután" };
const PENDING_EMAIL_KEY = "mammy-pending-email";
const config = window.NAGYI_CONFIG || {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const client = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const state = {
  weekStart: startOfWeek(new Date()),
  entries: new Map(),
  editing: null,
  schedule: [],
  user: null,
  profile: null,
  subscription: null
};

const els = {
  calendarView: document.querySelector("#calendarView"),
  loginView: document.querySelector("#loginView"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  emailField: document.querySelector("#emailField"),
  email: document.querySelector("#email"),
  codeField: document.querySelector("#codeField"),
  loginCode: document.querySelector("#loginCode"),
  loginButton: document.querySelector("#loginButton"),
  changeEmailButton: document.querySelector("#changeEmailButton"),
  calendar: document.querySelector("#calendar"),
  weekRange: document.querySelector("#weekRange"),
  weekLabel: document.querySelector("#weekLabel"),
  userName: document.querySelector("#userName"),
  demoBadge: document.querySelector("#demoBadge"),
  logoutButton: document.querySelector("#logoutButton"),
  editor: document.querySelector("#editor"),
  backdrop: document.querySelector("#modalBackdrop"),
  editorTitle: document.querySelector("#editorTitle"),
  editorPeriod: document.querySelector("#editorPeriod"),
  childChoices: document.querySelector("#childChoices"),
  mammyChoice: document.querySelector("#mammyChoice"),
  orderList: document.querySelector("#orderList"),
  note: document.querySelector("#note"),
  applyAllDay: document.querySelector("#applyAllDay"),
  updatedInfo: document.querySelector("#updatedInfo"),
  deleteEntry: document.querySelector("#deleteEntry"),
  saveEntry: document.querySelector("#saveEntry"),
  toast: document.querySelector("#toast")
};

function startOfWeek(value) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function entryKey(date, period) { return `${date}|${period}`; }
function isSameDay(a, b) { return dateKey(a) === dateKey(b); }

function formatRange(start) {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) return `${start.getMonth() + 1}.${String(start.getDate()).padStart(2, "0")} – ${String(end.getDate()).padStart(2, "0")}.`;
  return `${start.getMonth() + 1}.${String(start.getDate()).padStart(2, "0")} – ${end.getMonth() + 1}.${String(end.getDate()).padStart(2, "0")}.`;
}

function formatEditedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day}. ${hour}:${minute}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function personByCode(code) {
  return PEOPLE.find(person => person.code === code);
}

function normalizeSchedule(entry) {
  const normalized = [];
  const seen = new Set();
  const stored = Array.isArray(entry?.schedule) ? entry.schedule : [];
  stored.forEach(item => {
    const code = typeof item === "string" ? item : item?.code;
    if (!VALID_PERSON_CODES.has(code) || seen.has(code)) return;
    normalized.push({ code, note: String(typeof item === "object" ? item?.note || "" : "").slice(0, 120) });
    seen.add(code);
  });
  if (normalized.length) return normalized;
  if (entry?.unavailable) return [{ code: MAMMY.code, note: "" }];
  return (entry?.children || [])
    .filter(code => VALID_PERSON_CODES.has(code) && code !== MAMMY.code)
    .map(code => ({ code, note: "" }));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function setLoginMessage(message = "", kind = "error") {
  els.loginError.textContent = message;
  els.loginError.dataset.kind = kind;
}

function setAuthStep(step, email = "") {
  const enteringCode = step === "code";
  els.emailField.classList.toggle("hidden", enteringCode);
  els.codeField.classList.toggle("hidden", !enteringCode);
  els.changeEmailButton.classList.toggle("hidden", !enteringCode);
  els.email.required = !enteringCode;
  els.loginCode.required = enteringCode;
  els.loginButton.textContent = enteringCode ? "Belépés" : "Belépési kód kérése";
  if (enteringCode) {
    els.email.value = email;
    localStorage.setItem(PENDING_EMAIL_KEY, email);
    els.loginCode.value = "";
    els.loginCode.focus();
  } else {
    localStorage.removeItem(PENDING_EMAIL_KEY);
    els.loginCode.value = "";
    els.email.focus();
  }
}

function emailSendError(error) {
  if (error?.code === "over_email_send_rate_limit") return "Túl sok kódot kértünk. Várj egy kicsit, majd próbáld újra.";
  if (error?.code === "over_request_rate_limit") return "Túl sok próbálkozás történt. Várj néhány percet.";
  return "Nem sikerült elküldeni a kódot. Próbáld meg később.";
}

function renderChildChoices() {
  els.childChoices.innerHTML = CHILDREN.map(child => `
    <button class="child-choice" type="button" data-child="${child.code}" aria-pressed="false" aria-label="${child.name}">
      ${child.name.toUpperCase()}
    </button>`).join("");
}

function renderOrderList() {
  els.orderList.innerHTML = state.schedule.length ? state.schedule.map((item, index) => {
    const person = personByCode(item.code);
    return `<div class="order-row">
      <span class="order-number">${index + 1}</span>
      <span class="order-color order-color-${item.code.toLowerCase()}"></span>
      <span class="order-label">${escapeHtml(person?.name?.toUpperCase() || item.code)}</span>
      <button class="move-button" type="button" data-index="${index}" data-direction="-1" aria-label="${escapeHtml(person?.name || item.code)} feljebb" ${index === 0 ? "disabled" : ""}>↑</button>
      <button class="move-button" type="button" data-index="${index}" data-direction="1" aria-label="${escapeHtml(person?.name || item.code)} lejjebb" ${index === state.schedule.length - 1 ? "disabled" : ""}>↓</button>
      <input class="person-note-input" type="text" maxlength="120" data-note-index="${index}" aria-label="${escapeHtml(person?.name || item.code)} saját megjegyzése" value="${escapeHtml(item.note)}" placeholder="Rövid megjegyzés ehhez a részhez…" />
    </div>`;
  }).join("") : `<p class="order-empty">Válassz legalább egy elemet.</p>`;
}

function renderCalendar() {
  const today = new Date();
  const currentStart = startOfWeek(today);
  const offsetWeeks = Math.round((state.weekStart - currentStart) / 604800000);
  els.weekRange.textContent = formatRange(state.weekStart);
  els.weekLabel.textContent = offsetWeeks === 0 ? "Ez a hét" : offsetWeeks === 1 ? "Jövő hét" : offsetWeeks === -1 ? "Múlt hét" : `${Math.abs(offsetWeeks)} héttel ${offsetWeeks > 0 ? "később" : "korábban"}`;

  els.calendar.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(state.weekStart, index);
    return `
      <article class="day-row ${isSameDay(date, today) ? "today" : ""}">
        <div class="date-cell">
          <strong>${DAYS[date.getDay()]}</strong>
          <span>${MONTHS[date.getMonth()]} ${date.getDate()}.</span>
        </div>
        ${renderSlot(date, "am")}
        ${renderSlot(date, "pm")}
      </article>`;
  }).join("");
}

function renderSlot(date, period) {
  const iso = dateKey(date);
  const entry = state.entries.get(entryKey(iso, period));
  const schedule = normalizeSchedule(entry);
  const empty = !entry || (!schedule.length && !entry.note);
  const noteOnly = !empty && !schedule.length && Boolean(entry.note);
  const hasPersonNotes = schedule.some(item => item.note);
  let content = "";
  if (!empty) {
    if (schedule.length) {
      const panels = schedule.map(item => {
        const person = personByCode(item.code);
        const detail = item.note ? `<span class="person-note-text">${escapeHtml(item.note)}</span>` : "";
        return `<span class="child-panel child-panel-${item.code.toLowerCase()}"><span class="child-label">${escapeHtml(person?.name?.toUpperCase() || item.code)}</span>${detail}</span>`;
      }).join("");
      content = `<span class="slot-fill child-count-${schedule.length}">${panels}</span>`;
    }
    if (entry.note) content += `<span class="slot-note${noteOnly ? " note-only-text" : ""}">${escapeHtml(entry.note)}</span>`;
  }
  const hasMammy = schedule.some(item => item.code === MAMMY.code);
  return `<button class="slot ${empty ? "empty" : ""} ${noteOnly ? "note-only" : ""} ${hasPersonNotes ? "has-person-notes" : ""} ${hasPersonNotes && entry?.note ? "has-global-note" : ""}" type="button" data-date="${iso}" data-period="${period}" aria-label="${DAYS[date.getDay()]} ${PERIOD_NAMES[period]} szerkesztése${hasMammy ? ", Mammy is szerepel" : ""}">${content}</button>`;
}

function localEntries() {
  try { return JSON.parse(localStorage.getItem("nagyi-calendar-entries") || "[]"); }
  catch { return []; }
}

async function loadWeek() {
  const from = dateKey(state.weekStart);
  const to = dateKey(addDays(state.weekStart, 6));
  let rows;
  if (hasSupabase) {
    const response = await client.from("mammy_entries")
      .select("*, editor:updated_by(display_name)")
      .gte("entry_date", from).lte("entry_date", to);
    if (response.error) throw response.error;
    rows = response.data.map(row => ({ ...row, updated_by_name: row.editor?.display_name || "Családtag" }));
  } else {
    rows = localEntries().filter(row => row.entry_date >= from && row.entry_date <= to);
  }
  state.entries = new Map(rows.map(row => [entryKey(row.entry_date, row.period), row]));
  renderCalendar();
}

function openEditor(date, period) {
  const entry = state.entries.get(entryKey(date, period));
  state.editing = { date, period };
  state.schedule = normalizeSchedule(entry);
  els.editorPeriod.textContent = PERIOD_NAMES[period].toUpperCase();
  const parsed = new Date(`${date}T12:00:00`);
  els.editorTitle.textContent = `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}., ${DAYS[parsed.getDay()].toLowerCase()}`;
  els.note.value = entry?.note || "";
  els.applyAllDay.checked = false;
  const editedAt = formatEditedAt(entry?.updated_at);
  els.updatedInfo.textContent = entry?.updated_by_name
    ? `Utoljára szerkesztette: ${entry.updated_by_name}${editedAt ? ` ${editedAt}` : ""}`
    : "";
  els.deleteEntry.style.visibility = entry ? "visible" : "hidden";
  syncChoices();
  els.backdrop.classList.remove("hidden");
  els.editor.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => els.editor.querySelector(".child-choice")?.focus(), 0);
}

function closeEditor() {
  els.editor.classList.add("hidden");
  els.backdrop.classList.add("hidden");
  document.body.style.overflow = "";
  state.editing = null;
}

function syncChoices() {
  els.childChoices.querySelectorAll(".child-choice").forEach(button => {
    button.setAttribute("aria-pressed", String(state.schedule.some(item => item.code === button.dataset.child)));
  });
  els.mammyChoice.setAttribute("aria-pressed", String(state.schedule.some(item => item.code === MAMMY.code)));
  renderOrderList();
}

function setBusy(busy) {
  els.saveEntry.disabled = busy;
  els.deleteEntry.disabled = busy;
}

async function persistEntry(date, period, shouldDelete = false) {
  const key = entryKey(date, period);
  if (hasSupabase) {
    if (shouldDelete) {
      const response = await client.from("mammy_entries").delete().eq("entry_date", date).eq("period", period);
      if (response.error) throw response.error;
    } else {
      const schedule = state.schedule.map(item => ({ code: item.code, note: item.note.trim() }));
      const payload = {
        entry_date: date,
        period,
        children: schedule.filter(item => item.code !== MAMMY.code).map(item => item.code),
        unavailable: schedule.length === 1 && schedule[0].code === MAMMY.code,
        schedule,
        note: els.note.value.trim(),
        updated_by: state.user.id,
        updated_at: new Date().toISOString()
      };
      const response = await client.from("mammy_entries").upsert(payload, { onConflict: "entry_date,period" });
      if (response.error) throw response.error;
    }
  } else {
    const rows = localEntries().filter(row => entryKey(row.entry_date, row.period) !== key);
    if (!shouldDelete) {
      const schedule = state.schedule.map(item => ({ code: item.code, note: item.note.trim() }));
      rows.push({
        entry_date: date,
        period,
        children: schedule.filter(item => item.code !== MAMMY.code).map(item => item.code),
        unavailable: schedule.length === 1 && schedule[0].code === MAMMY.code,
        schedule,
        note: els.note.value.trim(),
        updated_by_name: "Próba felhasználó",
        updated_at: new Date().toISOString()
      });
    }
    localStorage.setItem("nagyi-calendar-entries", JSON.stringify(rows));
  }
}

async function saveCurrent() {
  if (!state.editing) return;
  setBusy(true);
  try {
    const { date, period } = state.editing;
    const empty = state.schedule.length === 0 && !els.note.value.trim();
    const periods = els.applyAllDay.checked ? ["am", "pm"] : [period];
    await Promise.all(periods.map(value => persistEntry(date, value, empty)));
    await loadWeek();
    closeEditor();
    showToast(empty ? "Az üres bejegyzés törölve." : "Bejegyzés elmentve.");
  } catch (error) {
    console.error(error);
    showToast("Nem sikerült menteni. Próbáld újra.");
  } finally { setBusy(false); }
}

async function deleteCurrent() {
  if (!state.editing) return;
  setBusy(true);
  try {
    const { date, period } = state.editing;
    const periods = els.applyAllDay.checked ? ["am", "pm"] : [period];
    await Promise.all(periods.map(value => persistEntry(date, value, true)));
    await loadWeek();
    closeEditor();
    showToast("Bejegyzés törölve.");
  } catch (error) {
    console.error(error);
    showToast("Nem sikerült törölni.");
  } finally { setBusy(false); }
}

async function loadProfile() {
  const response = await client.from("mammy_profiles").select("display_name").eq("id", state.user.id).maybeSingle();
  if (response.error) throw response.error;
  state.profile = response.data;
  if (!state.profile) throw new Error("MAMMY_ACCESS_DENIED");
  els.userName.textContent = state.profile.display_name;
}

async function showAuthenticated(session) {
  state.user = session.user;
  try {
    await loadProfile();
  } catch (error) {
    if (error.message === "MAMMY_ACCESS_DENIED") {
      await client.auth.signOut();
      state.user = null;
      els.calendarView.classList.add("hidden");
      els.loginView.classList.remove("hidden");
      els.loginError.textContent = "Ehhez a fiókhoz még nincs Mammy-hozzáférés.";
      return;
    }
    throw error;
  }
  els.loginView.classList.add("hidden");
  els.calendarView.classList.remove("hidden");
  els.demoBadge.classList.add("hidden");
  els.logoutButton.classList.remove("hidden");
  await loadWeek();
  if (state.subscription) client.removeChannel(state.subscription);
  state.subscription = client.channel("calendar-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "mammy_entries" }, () => loadWeek())
    .subscribe();
}

async function initializeAuth() {
  if (!hasSupabase) {
    await loadWeek();
    return;
  }
  const { data } = await client.auth.getSession();
  if (data.session) await showAuthenticated(data.session);
  else {
    els.calendarView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
    const pendingEmail = localStorage.getItem(PENDING_EMAIL_KEY);
    setAuthStep(pendingEmail ? "code" : "email", pendingEmail || "");
  }
  client.auth.onAuthStateChange((_event, session) => {
    if (session && session.user?.id !== state.user?.id) showAuthenticated(session);
  });
}

els.calendar.addEventListener("click", event => {
  const slot = event.target.closest(".slot");
  if (slot) openEditor(slot.dataset.date, slot.dataset.period);
});

els.childChoices.addEventListener("click", event => {
  const button = event.target.closest(".child-choice");
  if (!button) return;
  const code = button.dataset.child;
  const index = state.schedule.findIndex(item => item.code === code);
  if (index >= 0) state.schedule.splice(index, 1);
  else state.schedule.push({ code, note: "" });
  syncChoices();
});

els.mammyChoice.addEventListener("click", () => {
  const index = state.schedule.findIndex(item => item.code === MAMMY.code);
  if (index >= 0) state.schedule.splice(index, 1);
  else state.schedule.push({ code: MAMMY.code, note: "" });
  syncChoices();
});

els.orderList.addEventListener("click", event => {
  const button = event.target.closest(".move-button");
  if (!button || button.disabled) return;
  const index = Number(button.dataset.index);
  const target = index + Number(button.dataset.direction);
  [state.schedule[index], state.schedule[target]] = [state.schedule[target], state.schedule[index]];
  syncChoices();
});

els.orderList.addEventListener("input", event => {
  const input = event.target.closest(".person-note-input");
  if (!input) return;
  const item = state.schedule[Number(input.dataset.noteIndex)];
  if (item) item.note = input.value;
});

document.querySelector("#previousWeek").addEventListener("click", async () => { state.weekStart = addDays(state.weekStart, -7); await loadWeek(); });
document.querySelector("#nextWeek").addEventListener("click", async () => { state.weekStart = addDays(state.weekStart, 7); await loadWeek(); });
document.querySelector("#todayButton").addEventListener("click", async () => { state.weekStart = startOfWeek(new Date()); await loadWeek(); });
document.querySelector("#closeEditor").addEventListener("click", closeEditor);
els.backdrop.addEventListener("click", closeEditor);
els.saveEntry.addEventListener("click", saveCurrent);
els.deleteEntry.addEventListener("click", deleteCurrent);
document.addEventListener("keydown", event => { if (event.key === "Escape" && state.editing) closeEditor(); });

els.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  setLoginMessage();
  els.loginButton.disabled = true;
  const email = els.email.value.trim().toLowerCase();
  if (!els.codeField.classList.contains("hidden")) {
    const token = els.loginCode.value.trim();
    if (!/^\d{6,8}$/.test(token)) {
      setLoginMessage("Írd be a levélben kapott 6 jegyű kódot.");
      els.loginButton.disabled = false;
      els.loginCode.select();
      return;
    }
    setLoginMessage("A kód ellenőrzése…", "success");
    const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
    els.loginButton.disabled = false;
    if (error) {
      setLoginMessage("A kód hibás, lejárt, vagy már felhasználták. Kérj új kódot.");
      els.loginCode.select();
    } else {
      localStorage.removeItem(PENDING_EMAIL_KEY);
      setLoginMessage("Sikeres belépés…", "success");
    }
    return;
  }

  setLoginMessage("A belépési kód küldése…", "success");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: "https://mmldb.github.io/mammy-naptar/"
    }
  });
  els.loginButton.disabled = false;
  if (error) {
    setLoginMessage(emailSendError(error));
  } else {
    setAuthStep("code", email);
    setLoginMessage("Elküldtük a 6 jegyű kódot. Írd be ide a levélből.", "success");
  }
});

els.changeEmailButton.addEventListener("click", () => {
  setLoginMessage();
  setAuthStep("email");
});

els.logoutButton.addEventListener("click", async () => {
  await client.auth.signOut();
  window.location.reload();
});

renderChildChoices();
initializeAuth().catch(error => {
  console.error(error);
  showToast("Az alkalmazás betöltése nem sikerült.");
});

window.addEventListener("offline", () => showToast("Offline mód – a kapcsolat helyreállásakor frissítünk."));
window.addEventListener("online", () => {
  showToast("Újra online.");
  loadWeek().catch(() => showToast("A frissítés nem sikerült."));
});

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1" || location.hostname === "localhost")) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("service-worker.js");
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showToast("Új verzió érkezett. A következő megnyitáskor frissül.");
        });
      });
    } catch (error) {
      console.error("A PWA telepítése nem sikerült.", error);
    }
  });
}
