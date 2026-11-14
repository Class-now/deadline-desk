// Deadline Desk page logic. One Board object runs the page; the page's own buttons and
// the assistant's actions call the same methods, so both follow one set of rules.
import { CALLS, CATEGORIES, SNAPSHOT_DATE } from "./calls-data.js";

const DAY = 86400000;
const JST_OFFSET = 9 * 3600000;
const STORE_KEY = "deadline-desk-shortlist";
const LANGUAGES = ["any", "English", "Japanese"];
const AI_POLICIES = ["any", "allowed", "not-forbidden"];
// Working days a first-time entrant usually needs, by category. Used only for the plan.
const PREP_DAYS = { "hackathon": 14, "writing": 10, "poetry": 2, "film": 10, "design": 7, "business-idea": 7, "data-science": 21, "essay-prize": 10 };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Date helpers in Japan time, where the board's deadlines live. */
class JstDate {
  /** :return: "YYYY-MM-DD" of the instant in Japan time. */
  static iso(ms) {
    return new Date(ms + JST_OFFSET).toISOString().slice(0, 10);
  }

  /** :return: "Tue, Dec 1, 2026" for the instant in Japan time. */
  static label(ms) {
    const d = new Date(ms + JST_OFFSET);
    return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }

  /** :return: "Tue, Dec 1, 2026 07:00 JST". */
  static labelTime(ms) {
    const d = new Date(ms + JST_OFFSET);
    return `${JstDate.label(ms)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} JST`;
  }

  /** :return: Start of a "YYYY-MM-DD" day in Japan time, or NaN. */
  static parseDay(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text || "")) return NaN;
    return Date.parse(`${text}T00:00:00+09:00`);
  }
}

export class Board {
  /** Clock used for "today"; tests replace it. */
  static now = () => Date.now();

  constructor() {
    this.version = 0;
    this.filters = Board.defaultFilters();
    this.shownIds = [];
    this.shortlist = Board.loadShortlist();
  }

  static defaultFilters() {
    return { category: "any", language: "any", aiPolicy: "any", minPrizeUsd: 0, deadlineFrom: "", deadlineTo: "", keyword: "" };
  }

  static loadShortlist() {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter(id => CALLS.some(c => c.id === id)) : [];
    } catch {
      return [];
    }
  }

  saveShortlist() {
    try {
      globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(this.shortlist));
    } catch {
      // Private windows may block storage; the shortlist then lasts for this visit.
    }
  }

  /** :return: Every call id, for action schemas. */
  static callIds() {
    return CALLS.map(c => c.id);
  }

  /** :return: A plain summary of one call, with days left from now. */
  static summary(call) {
    const ms = Date.parse(call.deadline);
    const left = ms - Board.now();
    return {
      id: call.id,
      title: call.title,
      organizer: call.organizer,
      category: call.category,
      format: call.format,
      deadline: call.deadline,
      deadlineLabel: JstDate.labelTime(ms),
      daysLeft: left > 0 ? Math.floor(left / DAY) : 0,
      open: left > 0,
      prize: call.prize,
      openTo: call.openTo,
      language: call.language,
      aiPolicy: call.aiPolicy,
      fee: call.fee,
      url: call.url,
    };
  }

  /**
   * Check filters and fill in defaults. Changes nothing.
   * :return: {ok: true, filters} or {ok: false, reason, field}.
   */
  static checkFilters(input = {}) {
    const f = { ...Board.defaultFilters(), ...input };
    if (f.category !== "any" && !CATEGORIES.includes(f.category)) return { ok: false, reason: `Unknown category "${f.category}".`, field: "category" };
    if (!LANGUAGES.includes(f.language)) return { ok: false, reason: `Language must be one of ${LANGUAGES.join(", ")}.`, field: "language" };
    if (!AI_POLICIES.includes(f.aiPolicy)) return { ok: false, reason: `AI policy filter must be one of ${AI_POLICIES.join(", ")}.`, field: "aiPolicy" };
    f.minPrizeUsd = Number(f.minPrizeUsd) || 0;
    if (f.minPrizeUsd < 0) return { ok: false, reason: "Minimum prize cannot be negative.", field: "minPrizeUsd" };
    for (const key of ["deadlineFrom", "deadlineTo"]) {
      if (f[key] && Number.isNaN(JstDate.parseDay(f[key]))) return { ok: false, reason: `${key} must be a date like 2026-12-31.`, field: key };
    }
    if (f.deadlineFrom && f.deadlineTo && f.deadlineFrom > f.deadlineTo) return { ok: false, reason: "The 'from' date is after the 'to' date.", field: "deadlineFrom" };
    f.keyword = String(f.keyword || "").trim().slice(0, 60);
    return { ok: true, filters: f };
  }

  /**
   * Search open calls. Changes nothing on the page.
   * :return: {ok, count, calls (sorted by deadline), filters} or a refusal.
   */
  findCalls(input) {
    const check = Board.checkFilters(input);
    if (!check.ok) return check;
    const f = check.filters;
    const word = f.keyword.toLowerCase();
    const from = f.deadlineFrom ? JstDate.parseDay(f.deadlineFrom) : -Infinity;
    const to = f.deadlineTo ? JstDate.parseDay(f.deadlineTo) + DAY : Infinity;
    const calls = CALLS.map(Board.summary).filter(c => {
      const ms = Date.parse(c.deadline);
      if (!c.open) return false;
      if (f.category !== "any" && c.category !== f.category) return false;
      if (f.language !== "any" && c.language !== f.language && c.language !== "any") return false;
      if (f.aiPolicy === "allowed" && c.aiPolicy !== "allowed") return false;
      if (f.aiPolicy === "not-forbidden" && c.aiPolicy === "not-allowed") return false;
      if ((CALLS.find(x => x.id === c.id).prizeUsd || 0) < f.minPrizeUsd) return false;
      if (ms < from || ms >= to) return false;
      if (word && !`${c.title} ${c.organizer} ${c.format} ${c.prize} ${c.openTo}`.toLowerCase().includes(word)) return false;
      return true;
    }).sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
    return { ok: true, count: calls.length, calls, filters: f };
  }

  /** Apply filters to the visible list. :return: the search result, or a refusal. */
  showCalls(input) {
    const result = this.findCalls(input);
    if (!result.ok) return result;
    this.filters = result.filters;
    this.shownIds = result.calls.map(c => c.id);
    this.version += 1;
    this.render();
    return { ...result, version: this.version };
  }

  /** :return: updated state, or a refusal. */
  addToShortlist(id) {
    const call = CALLS.find(c => c.id === id);
    if (!call) return { ok: false, reason: `No call with id "${id}".`, field: "id" };
    if (!Board.summary(call).open) return { ok: false, reason: `${call.title} has already closed.`, field: "id" };
    if (this.shortlist.includes(id)) return { ok: false, reason: `${call.title} is already on the shortlist.`, field: "id" };
    if (this.shortlist.length >= 12) return { ok: false, reason: "The shortlist holds 12 calls. Remove one first.", field: "id" };
    this.shortlist.push(id);
    this.afterShortlistChange();
    return { ok: true, added: call.title, ...this.getState() };
  }

  /** :return: updated state, or a refusal. */
  removeFromShortlist(id) {
    if (!this.shortlist.includes(id)) return { ok: false, reason: `"${id}" is not on the shortlist.`, field: "id" };
    this.shortlist = this.shortlist.filter(x => x !== id);
    this.afterShortlistChange();
    return { ok: true, removed: id, ...this.getState() };
  }

  afterShortlistChange() {
    this.version += 1;
    this.saveShortlist();
    this.render();
  }

  /**
   * Work back from each shortlisted deadline to start, draft and submit dates, and flag
   * clashes. Changes nothing.
   * :param bufferDays: days between "submit by" and the real deadline (0-7).
   * :return: {ok, today, steps (sorted by start date), clashes, closed}.
   */
  planShortlist(bufferDays = 2) {
    const buffer = Number.isInteger(bufferDays) ? bufferDays : 2;
    if (buffer < 0 || buffer > 7) return { ok: false, reason: "Buffer must be 0 to 7 days.", field: "bufferDays" };
    const now = Board.now();
    const today = JstDate.parseDay(JstDate.iso(now));
    const steps = [];
    const closed = [];
    for (const id of this.shortlist) {
      const call = CALLS.find(c => c.id === id);
      const s = Board.summary(call);
      if (!s.open) {
        closed.push(call.title);
        continue;
      }
      const deadlineDay = JstDate.parseDay(JstDate.iso(Date.parse(call.deadline)));
      const prep = PREP_DAYS[call.category] || 7;
      const submitBy = Math.max(today, deadlineDay - buffer * DAY);
      const startBy = submitBy - prep * DAY;
      const draftBy = submitBy - Math.ceil(prep / 3) * DAY;
      steps.push({
        id, title: call.title, prepDays: prep, deadlineLabel: s.deadlineLabel,
        startBy: JstDate.iso(startBy), startByLabel: JstDate.label(startBy),
        draftBy: JstDate.iso(Math.max(today, draftBy)), draftByLabel: JstDate.label(Math.max(today, draftBy)),
        submitBy: JstDate.iso(submitBy), submitByLabel: JstDate.label(submitBy),
        late: startBy < today,
        url: call.url,
      });
    }
    steps.sort((a, b) => a.submitBy.localeCompare(b.submitBy));
    const clashes = [];
    for (let i = 1; i < steps.length; i += 1) {
      const gap = (JstDate.parseDay(steps[i].submitBy) - JstDate.parseDay(steps[i - 1].submitBy)) / DAY;
      if (gap <= 2) clashes.push(`${steps[i - 1].title} and ${steps[i].title} are due within ${gap} day(s) of each other.`);
    }
    return { ok: true, today: JstDate.iso(now), todayLabel: JstDate.label(now), bufferDays: buffer, steps, clashes, closed };
  }

  /** :return: the shortlist as an iCalendar file (one all-day event per submit date). */
  shortlistIcs() {
    const plan = this.planShortlist();
    const stamp = new Date(Board.now()).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Deadline Desk//EN"];
    for (const s of plan.steps) {
      const day = s.submitBy.replace(/-/g, "");
      lines.push("BEGIN:VEVENT", `UID:${s.id}@deadline-desk`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day}`,
        `SUMMARY:Submit: ${s.title}`, `DESCRIPTION:Deadline ${s.deadlineLabel}. Start by ${s.startBy}. ${s.url}`, "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  /** :return: the page state as plain JSON. */
  getState() {
    const now = Board.now();
    return {
      today: JstDate.iso(now),
      todayLabel: JstDate.label(now),
      timeZone: "Asia/Tokyo (JST, UTC+9)",
      snapshotDate: SNAPSHOT_DATE,
      totalCalls: CALLS.length,
      categories: CATEGORIES,
      filters: { ...this.filters },
      shownCount: this.shownIds.length,
      shortlist: this.shortlist.map(id => Board.summary(CALLS.find(c => c.id === id))),
      version: this.version,
    };
  }

  /** Draw the list, the shortlist and the plan. Skips silently without a page. */
  render() {
    const doc = globalThis.document;
    if (!doc || typeof doc.getElementById !== "function") return;
    const list = doc.getElementById("calls-list");
    const count = doc.getElementById("calls-count");
    const short = doc.getElementById("shortlist-list");
    const plan = doc.getElementById("plan-list");
    if (!list || !short || !plan) return;
    this.writeForm(doc);
    const shown = this.shownIds.map(id => Board.summary(CALLS.find(c => c.id === id)));
    if (count) count.textContent = `${shown.length} open call${shown.length === 1 ? "" : "s"} · snapshot ${SNAPSHOT_DATE} · today ${JstDate.label(Board.now())} (JST)`;
    list.replaceChildren(...shown.map(c => this.card(doc, c)));
    const items = this.shortlist.map(id => Board.summary(CALLS.find(c => c.id === id)));
    short.replaceChildren(...items.map(c => {
      const li = doc.createElement("li");
      const a = doc.createElement("a");
      a.href = c.url;
      a.textContent = c.title;
      a.target = "_blank";
      a.rel = "noopener";
      const meta = doc.createElement("span");
      meta.className = "meta";
      meta.textContent = ` — ${c.open ? `${c.daysLeft} days left` : "closed"}`;
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "link-button";
      btn.textContent = "Remove";
      btn.dataset.remove = c.id;
      li.append(a, meta, btn);
      return li;
    }));
    const empty = doc.getElementById("shortlist-empty");
    if (empty) empty.hidden = items.length > 0;
    const p = this.planShortlist();
    plan.replaceChildren(...p.steps.map(s => {
      const li = doc.createElement("li");
      li.className = s.late ? "late" : "";
      li.textContent = `${s.title}: start ${s.startByLabel} → draft ${s.draftByLabel} → submit ${s.submitByLabel}${s.late ? " (start date has passed — move fast)" : ""}`;
      return li;
    }), ...p.clashes.map(text => {
      const li = doc.createElement("li");
      li.className = "clash";
      li.textContent = `Clash: ${text}`;
      return li;
    }));
  }

  card(doc, c) {
    const li = doc.createElement("li");
    li.className = "call";
    const h = doc.createElement("h3");
    const a = doc.createElement("a");
    a.href = c.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = c.title;
    h.append(a);
    const p = doc.createElement("p");
    p.className = "meta";
    p.textContent = `${c.organizer} · ${c.category} · ${c.language} · AI: ${c.aiPolicy} · ${c.fee}`;
    const d = doc.createElement("p");
    d.textContent = `${c.format}. Prize: ${c.prize}. Open to: ${c.openTo}.`;
    const due = doc.createElement("p");
    due.className = c.daysLeft <= 14 ? "due soon" : "due";
    due.textContent = `Deadline ${c.deadlineLabel} — ${c.daysLeft} days left`;
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.dataset.add = c.id;
    const listed = this.shortlist.includes(c.id);
    btn.textContent = listed ? "On shortlist" : "Add to shortlist";
    btn.disabled = listed;
    li.append(h, p, d, due, btn);
    return li;
  }

  writeForm(doc) {
    for (const [key, value] of Object.entries(this.filters)) {
      const el = doc.getElementById(`f-${key}`);
      if (el) el.value = String(value === 0 ? "" : value);
    }
  }

  readForm(doc) {
    const f = {};
    for (const key of Object.keys(Board.defaultFilters())) {
      const el = doc.getElementById(`f-${key}`);
      if (el) f[key] = el.value;
    }
    f.minPrizeUsd = Number(f.minPrizeUsd) || 0;
    return f;
  }

  /** Wire the page's own controls to the same methods the assistant uses. */
  wire() {
    const doc = globalThis.document;
    if (!doc || typeof doc.getElementById !== "function") return;
    const form = doc.getElementById("filters");
    const message = doc.getElementById("filters-message");
    form?.addEventListener("submit", event => {
      event.preventDefault();
      const r = this.showCalls(this.readForm(doc));
      if (message) message.textContent = r.ok ? "" : r.reason;
    });
    form?.addEventListener("reset", () => {
      setTimeout(() => {
        this.showCalls(Board.defaultFilters());
        if (message) message.textContent = "";
      }, 0);
    });
    doc.getElementById("calls-list")?.addEventListener("click", event => {
      const id = event.target?.dataset?.add;
      if (id) this.addToShortlist(id);
    });
    doc.getElementById("shortlist-list")?.addEventListener("click", event => {
      const id = event.target?.dataset?.remove;
      if (id) this.removeFromShortlist(id);
    });
    doc.getElementById("export-ics")?.addEventListener("click", () => {
      const blob = new Blob([this.shortlistIcs()], { type: "text/calendar" });
      const a = doc.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "deadline-desk-shortlist.ics";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
}

/** The one page object the page and the assistant share. */
export class App {
  static page = new Board();
}

App.page.wire();
App.page.showCalls(Board.defaultFilters());
