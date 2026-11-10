// Agent Map: every computer → hc session → space → tab → agent → its sub-agents,
// in one window (mod.open:agent-map, keys.json: cmd-g).
//
// A machine is a board. Inside, a tree with only what has a shape: a space whose
// one tab holds one agent is one line (1:1 merged); a space with several tabs or
// terminals branches; an agent with sub-agents (terminals whose `parent` is it)
// branches again. A space whose agents all rest folds to one line with its tabs as
// pills. An agent alone in its space that has rested 12 hours or more leaves the
// tree for a small cell under it (lighter: under a day, darker: three days and on).
// A computer with two or more hc sessions gets one block per session.
//
// Keys: ↑↓ move, ←→ previous / next board, ⏎ go there, / find, a everything,
// s shells too, l English / Korean, esc clear or close.
//
// Language: the one picked here (EN/한 or l, shared "agent-map.lang"), else
// `language` in mods/agent-map/config.json, else Machine Rail's, else the system's.
// `{ "demo": true }` in that file shows made-up machines (demo.js) for screenshots. Clicking a row, pill or cell goes there.
//
// Computers are grouped and named as Machine Rail does (`hc machine ls`, by host;
// names, colors and order from shared "machine.prefs"). How long an agent has
// rested comes from hc (`status_ms` in `hc get`), read once per open.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { hc, exec, theme, props, closeOverlay, shared, setShared, spaces, panes, terminals, run, readTextFile, appHome, settings } from "herdr";
import { makeUpdater } from "./update.js";
import { demo } from "./demo.js";

// "Update Agent Map" in the header when a newer release is out.
const UPDATER = makeUpdater({
  repo: "jenthous/herdr-app-agent-map",
  version: "0.1.1",
  key: "agent-map.update",
  mod: "agent-map",
  name: "Agent Map",
  prompt: "Update the agent-map mod from github.com/jenthous/herdr-app-agent-map",
});
const LANG_KEY = "agent-map.lang";

const QUIET = 12 * 3600e3;
const DAY = 86400e3;
const LOCAL = "@local";
const COLORS = { indigo: "#5e6ad2", ocean: "#3d7ea6", teal: "#2f8a80", moss: "#5f8a5b", amber: "#b0873e", rust: "#b0634b", rose: "#b05a78", plum: "#7d62a8", slate: "#64748b" };
const RANK = { blocked: 4, working: 3, done: 2, idle: 1, shell: 0 };

const STR = {
  en: {
    title: "Agent map",
    sum: (w, b, d, bg) => `${w} working · ${b} waiting · ${d} done · ${bg} sub-agents`,
    thisComputer: "This computer",
    sessions: (n) => `${n} sessions`,
    session: "session",
    defaultSession: "default",
    tabs: (n) => `${n} tabs`,
    terms: (n) => `${n} terminals`,
    resting: "resting",
    quiet: (n) => `12h+ ${n}`,
    shells: (n) => `shells ${n}`,
    shell: "shell",
    alsoTab: "tab",
    all: "Everything",
    showShells: "Shells",
    find: "Find a machine, space, tab or agent",
    none: "Nothing matches",
    loading: "Reading…",
    legend: "cells: rested 12h+",
    l1: "<1d", l2: "1–3d", l3: "3d+",
    ago: (m) => (m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`),
    switchLang: "한",
    keys: [["↑↓", "move"], ["←→", "board"], ["⏎", "go"], ["/", "find"], ["a", "everything"], ["s", "shells"], ["l", "한국어"], ["esc", "close"]],
  },
  ko: {
    title: "에이전트 지도",
    sum: (w, b, d, bg) => `${w} 일하는 중 · ${b} 기다림 · ${d} 끝남 · 서브 ${bg}`,
    thisComputer: "이 컴퓨터",
    sessions: (n) => `세션 ${n}`,
    session: "세션",
    defaultSession: "기본",
    tabs: (n) => `${n} 탭`,
    terms: (n) => `${n} 터미널`,
    resting: "쉬는 중",
    quiet: (n) => `12시간+ ${n}`,
    shells: (n) => `셸 ${n}`,
    shell: "셸",
    alsoTab: "탭",
    all: "전체 보기",
    showShells: "셸 보기",
    find: "머신·space·탭·에이전트 찾기",
    none: "맞는 것이 없어요",
    loading: "읽는 중…",
    legend: "칸 = 12시간 넘게 쉼",
    l1: "~1일", l2: "1~3일", l3: "3일+",
    ago: (m) => (m < 60 ? `${m}분` : m < 1440 ? `${Math.floor(m / 60)}시간` : `${Math.floor(m / 1440)}일`),
    switchLang: "EN",
    keys: [["↑↓", "이동"], ["←→", "보드"], ["⏎", "가기"], ["/", "찾기"], ["a", "전체"], ["s", "셸"], ["l", "English"], ["esc", "닫기"]],
  },
};

// When each terminal's status last changed (ms), kept across opens.
const SINCE = new Map(); // address → { status, at }
// The last lines of a terminal's screen, read on hover: address → { at, text }.
const PEEK = new Map();
const PEEK_FRESH = 15000;

// A screen's last few lines worth reading: an agent's input box and status lines
// (under a ──── rule near the bottom) and blank lines left out.
function lastLines(text, n = 6) {
  let lines = String(text ?? "").split("\n").map((l) => l.replace(/\s+$/, ""));
  const tail = Math.max(0, lines.length - 14);
  const rule = lines.findIndex((l, i) => i >= tail && /^\s*[─━]{10,}/.test(l));
  if (rule > 0) lines = lines.slice(0, rule);
  return lines.filter((l) => l.trim()).slice(-n)
    .map((l) => l.replace(/^\s{8,}/, "  "))
    .map((l) => (l.length > 110 ? l.slice(0, 109) + "…" : l)).join("\n");
}

async function readConfig(name) {
  try { return JSON.parse((await readTextFile(`${appHome()}/mods/${name}/config.json`)) ?? "null") ?? {}; } catch { return {}; }
}

// The language when none was picked here: this mod's config, Machine Rail's, the system's.
async function language(own) {
  for (const l of [own.language, (await readConfig("machine-switch")).language]) if (STR[l]) return l;
  try {
    const r = await exec("defaults", ["read", "-g", "AppleLanguages"]);
    const l = r.code === 0 ? r.stdout.match(/([a-z]{2})(?:[-_"\s,]|$)/i)?.[1]?.toLowerCase() : null;
    if (l) return STR[l] ? l : "en";
  } catch {}
  return "en";
}

const stop = (_e, cx) => cx.stop_propagation();
// A theme color (maybe #rrggbbaa) at some opacity.
const alpha = (c, a) => String(c).slice(0, 7) + a;
const lower = (s) => String(s ?? "").toLowerCase();

export default class AgentMap extends View {
  init(_props, cx) {
    if (props()?.role === "update") { this.update = new UPDATER.Update(); return this.update.init(cx); }
    this.systemLang = "en";
    this.demo = null; // made-up boards, when config.json asks
    this.groups = null; // machine groups from hc
    this.all = shared("agent-map.all") === true;
    this.shells = shared("agent-map.shells") === true;
    this.query = "";
    this.sel = null; // key of the selected row
    this.hover = null; // { addr, label } under the pointer
    this.nav = []; // rows in reading order, rebuilt by render: { key, board, go }
    this.search = InputState.new({});
    this.search.on("change", (_e, cx) => { this.query = this.search.value(); this.sel = null; cx.notify(); });
    this.search.on("submit", (_e, cx) => { this.go(this.current()); cx.notify(); });
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      const own = await readConfig("agent-map");
      this.systemLang = await language(own);
      // the demo starts from the default view, whatever was saved
      if (own.demo) { this.demo = demo(); this.groups = []; this.all = false; this.shells = false; cx.notify(); return; }
      this.groups = await this.machines();
      cx.notify();
      this.readSince(cx);
    });
    UPDATER.check();
    // Ages tick; statuses are live anyway.
    cx.timer.every(30000, (cx) => { this.readSince(cx); cx.notify(); });
  }

  get lang() { const l = shared(LANG_KEY); return STR[l] ? l : this.systemLang; }

  T() { return STR[this.lang] ?? STR.en; }

  toggleLang() { setShared(LANG_KEY, this.lang === "ko" ? "en" : "ko"); }

  // Machine Rail's grouping: entries by host, the session-less entry first.
  async machines() {
    const r = await hc(["machine", "ls", "--json"]).catch(() => null);
    let list = [];
    try { list = JSON.parse(r?.stdout ?? "{}").machines ?? []; } catch {}
    const prefs = shared("machine.prefs") ?? {};
    const byHost = new Map();
    for (const m of list) {
      if (m.temporary) continue;
      const key = m.host || m.target || m.name;
      if (!byHost.has(key)) byHost.set(key, []);
      byHost.get(key).push(m);
    }
    const out = [{ key: LOCAL, label: prefs.alias?.[`g:${LOCAL}`] || null, color: prefs.color?.[`g:${LOCAL}`] ?? "slate", entries: [{ name: null, session: null }] }];
    for (const [key, entries] of byHost) {
      entries.sort((a, b) => (a.session == null ? -1 : b.session == null ? 1 : String(a.session).localeCompare(String(b.session))));
      const main = entries[0];
      out.push({ key, label: prefs.alias?.[`g:${key}`] || (main.session == null ? main.name : main.target), color: prefs.color?.[`g:${key}`] ?? null, entries });
    }
    const order = prefs.order ?? [];
    const rank = (k) => { const i = order.indexOf(k); return i < 0 ? order.length : i; };
    return out.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g.key) - rank(b.g.key) || a.i - b.i).map((x) => x.g);
  }

  // Ask hc when each resting agent's status last changed (once per status change).
  readSince(cx) {
    if (this.demo) return;
    const want = [];
    for (const p of panes()) {
      if (!p.terminal || !p.status) continue;
      const known = SINCE.get(p.terminal);
      if (!known || known.status !== p.status) want.push(p.terminal);
    }
    if (!want.length || this.reading) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      const queue = [...want];
      const worker = async () => {
        for (let a; (a = queue.shift()); ) {
          try {
            const r = await hc(["get", a, "--json"]);
            const j = JSON.parse(r.stdout);
            SINCE.set(a, { status: panes().find((p) => p.terminal === a)?.status ?? null, at: j.status_ms ?? 0 });
          } catch { SINCE.set(a, { status: null, at: 0 }); }
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      this.reading = false;
      cx.notify();
    });
  }

  // ---------- the model ----------

  // [{ g, label, color, sessions: [{ name, spaces: [{ id, name, tabs: [{ id, name, terms }] }] }] }]
  model() {
    const T = this.T();
    if (this.demo) return this.demo.map((b) => (b.g.key === "@local" ? { ...b, label: T.thisComputer } : b));
    const ps = panes();
    const all = terminals();
    const byAddr = new Map(all.map((x) => [x.address, x]));
    const inPane = new Set(ps.map((p) => p.terminal).filter(Boolean));
    const kids = (addr) => all.filter((k) => k.parent === addr && k.state === "live").map((k) => ({
      address: k.address, name: k.name || k.address.split("/").pop(), status: k.status || "idle", alsoTab: inPane.has(k.address),
    }));
    const entryOf = new Map();
    for (const g of this.groups ?? []) for (const e of g.entries) entryOf.set(e.name ?? null, { g, session: e.session });
    const out = new Map();
    for (const g of this.groups ?? []) out.set(g.key, { g, label: g.key === LOCAL ? (g.label || T.thisComputer) : g.label, color: COLORS[g.color] ?? null, sessions: new Map() });
    for (const sp of spaces()) {
      const where = entryOf.get(sp.machine ?? null);
      if (!where) continue;
      const box = out.get(where.g.key);
      const sname = where.session ?? "";
      if (!box.sessions.has(sname)) box.sessions.set(sname, { name: sname, spaces: [] });
      const tabs = sp.tabs.map((tb) => ({
        id: tb.id, name: tb.name,
        terms: ps.filter((p) => p.tab === tb.id && p.terminal).map((p) => ({
          address: p.terminal, pane: p.pane, space: sp.id, tab: tb.id,
          status: p.status ? p.status : "shell", app: p.app, title: byAddr.get(p.terminal)?.name || p.app || "",
          bg: kids(p.terminal),
        })),
      }));
      box.sessions.get(sname).spaces.push({ id: sp.id, name: sp.name, tabs });
    }
    return [...out.values()].map((b) => ({ ...b, sessions: [...b.sessions.values()] }));
  }

  // Read the screen of what's under the pointer (at most every 15 s per terminal).
  peek(addr, cx) {
    const p = PEEK.get(addr);
    if (this.demo || (p && Date.now() - p.at < PEEK_FRESH) || p?.busy) return;
    PEEK.set(addr, { ...(p ?? { text: "" }), busy: true, at: p?.at ?? 0 });
    cx.spawn(async (cx) => {
      let text = p?.text ?? "";
      try { const r = await hc(["read", addr, "--json"]); if (r.code === 0) text = lastLines(JSON.parse(r.stdout).text); } catch {}
      PEEK.set(addr, { at: Date.now(), text, busy: false });
      cx.notify();
    });
  }

  // Hovering shows a card at once (a tooltip waits half a second): what it is and
  // the last lines on its screen, read on the first hover.
  hoverOn(addr, label, bi) {
    return (h, cx) => {
      if (h) { this.hover = { addr, label, col: this.colOf?.[bi] ?? 0 }; this.peek(addr, cx); cx.notify(); }
      else if (this.hover?.addr === addr) { this.hover = null; cx.notify(); }
    };
  }

  card(t, T) {
    const h = this.hover;
    if (!h) return null;
    const p = PEEK.get(h.addr);
    const text = p?.text || (p && !p.busy ? "" : T.loading);
    const mono = settings().font_family ?? "JetBrains Mono";
    // one column wide (1180 - 2×14 padding - 2×12 gaps) / 3, over a column the
    // pointer is not in: the left one, or the right one when the pointer is there
    const left = h.col !== 0;
    return v_flex().absolute().bottom(38).when(left, (el) => el.left(14)).when(!left, (el) => el.right(14)).w(376).p(10).gap(6).rounded(8)
      .bg(t.raised).border_1().border_color(t.border).shadow_lg()
      .child(h_flex().gap(8).items_center().text_size(11.5)
        .child(div().min_w(0).truncate().font_semibold().child(h.label))
        .child(div().flex_1())
        .child(div().flex_none().text_color(t.dim).font_family(mono).text_size(11).child(h.addr)))
      .when(Boolean(text), (el) => el.child(v_flex().text_size(11.5).font_family(mono).text_color(t.muted)
        .children(text.split("\n").map((l) => div().truncate().child(l || " ")))));
  }


  since(x) { return x.mins != null ? Date.now() - x.mins * 60000 : SINCE.get(x.address)?.at ?? 0; }
  live(x) { return x.status === "working" || x.status === "blocked" || x.status === "done"; }
  resting(x) { const at = this.since(x); return !at || Date.now() - at >= QUIET; }

  matches(q, b, s, sp, tb, x) {
    return [b.label, s.name, sp.name, tb.name, x.app, x.title, x.address, ...x.bg.map((k) => k.name)].some((v) => lower(v).includes(q));
  }

  // ---------- going there ----------

  go(row) {
    if (!row || this.demo) return;
    row.go();
    closeOverlay(props().overlay);
  }
  goTerm(x) {
    if (x.app) run("agent.focus", { terminal: x.address });
    else { run("space.select", { id: x.space }); run("tab.select", { id: x.tab }); run("pane.focus", { pane: x.pane }); }
  }
  current() { return this.nav.find((r) => r.key === this.sel) ?? this.nav[0]; }

  key(e, cx) {
    const typing = !this.handle.is_focused();
    const k = e.key;
    if (k === "escape") {
      if (this.query) { this.search.set_value(""); this.query = ""; this.handle.focus(); }
      else if (typing) this.handle.focus();
      else closeOverlay(props().overlay);
    } else if (k === "up" || k === "down") {
      const i = Math.max(0, this.nav.findIndex((r) => r.key === this.sel));
      const n = this.nav.length;
      if (n) this.sel = this.nav[this.sel == null ? 0 : (i + (k === "down" ? 1 : -1) + n) % n].key;
    } else if (k === "left" || k === "right") {
      if (typing) return;
      const cur = this.current();
      const boards = [...new Set(this.nav.map((r) => r.board))];
      const bi = boards.indexOf(cur?.board);
      const next = boards[(bi + (k === "right" ? 1 : -1) + boards.length) % boards.length];
      this.sel = this.nav.find((r) => r.board === next)?.key ?? this.sel;
    } else if (k === "enter") {
      if (typing) return;
      this.go(this.current());
    } else if (typing || e.modifiers?.platform || e.modifiers?.control) {
      return;
    } else if (k === "/") {
      this.search.focus();
    } else if (k === "a") {
      this.all = !this.all; setShared("agent-map.all", this.all);
    } else if (k === "l") {
      this.toggleLang();
    } else if (k === "s") {
      this.shells = !this.shells; setShared("agent-map.shells", this.shells);
    } else return;
    cx.stop_propagation();
    cx.notify();
  }

  // ---------- drawing ----------

  render() {
    if (this.update) return this.update.render();
    const t = theme(), T = this.T();
    const boards = this.groups ? this.model() : [];
    const q = lower(this.query.trim());
    this.nav = [];
    const drawn = boards.map((b, bi) => { const d = this.board(t, T, b, bi, q); return d && { ...d, bi }; }).filter(Boolean);
    if (this.sel != null && !this.nav.some((r) => r.key === this.sel)) this.sel = null;
    // three columns, each board where the column is shortest
    const cols = [[], [], []], h = [0, 0, 0];
    this.colOf = {};
    for (const d of drawn) { const i = h.indexOf(Math.min(...h)); cols[i].push(d.el); h[i] += d.weight; this.colOf[d.bi] = i; }
    const n = { working: 0, blocked: 0, done: 0, bg: 0 };
    for (const b of boards) for (const s of b.sessions) for (const sp of s.spaces) for (const tb of sp.tabs) for (const x of tb.terms) {
      if (n[x.status] != null) n[x.status]++;
      n.bg += x.bg.length;
    }
    let body;
    if (!this.groups) body = div().p(16).text_color(t.dim).child(T.loading);
    else if (!drawn.length) body = div().p(16).text_color(t.dim).child(T.none);
    else body = h_flex().items_start().gap(12).p(14).children(cols.map((c) => v_flex().flex_1().min_w(0).gap(12).children(c)));
    const card = this.card(t, T);
    return v_flex().id("agent-map").relative().track_focus(this.handle).size_full().min_h(0).bg(t.popover).text_color(t.foreground).text_size(12.5)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(this.header(t, T, n))
      .child(div().id("am-scroll").flex_1().min_h(0).overflow_y_scrollbar().child(body))
      .child(h_flex().h(30).flex_none().px(16).gap(14).items_center().border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .children(T.keys.map(([k, v]) => h_flex().gap(5).items_center().child(this.kbd(t, k)).child(v)))
        .child(div().flex_1()).child("⌘G"))
      .when(Boolean(card), (el) => el.child(card));
  }

  kbd(t, k) {
    return div().px(4).rounded(4).border_1().border_color(t.border).text_size(10.5).text_color(t.muted).child(k);
  }

  header(t, T, n) {
    const chip = (id, label, on, flip) => div().id(id).px(8).h(22).flex().items_center().rounded(6).border_1()
      .border_color(on ? t.muted : t.border).bg(on ? t.raised : t.popover).text_size(11.5).text_color(on ? t.foreground : t.muted)
      .cursor_pointer().on_mouse_down("left", stop).on_click((_e, cx) => { flip(); cx.notify(); }).child(label);
    const swatch = (c, border) => div().size(10).rounded(3).bg(c).when(Boolean(border), (el) => el.border_1().border_color(t.border));
    return h_flex().h(46).flex_none().px(16).gap(10).items_center().border_b(1).border_color(t.border)
      .child(div().text_size(14).font_semibold().child(T.title))
      .child(div().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(T.sum(n.working, n.blocked, n.done, n.bg)))
      .child(h_flex().id("am-find").ml(6).w(260).h(26).px(8).gap(6).items_center().rounded(7).border_1()
        .border_color(this.query ? t.accent : t.border).bg(t.background).on_mouse_down("left", stop)
        .child(div().relative().flex_1().min_w(0)
          .child(Input.new(this.search).w_full().h(22).items_center().text_size(12))
          .when(!this.query, (el) => el.child(div().absolute().left(0).top(3).text_size(12).text_color(t.dim).child(T.find))))
        .child(this.kbd(t, "/")))
      .child(div().flex_1())
      .when(!this.all && !this.query, (el) => el.child(h_flex().gap(8).items_center().text_size(10.5).text_color(t.dim)
        .child(T.legend)
        .child(h_flex().gap(3).items_center().child(swatch(this.cellColor(t, "fresh"))).child(T.l1))
        .child(h_flex().gap(3).items_center().child(swatch(this.cellColor(t, "mid"))).child(T.l2))
        .child(h_flex().gap(3).items_center().child(swatch(this.cellColor(t, "old"), true)).child(T.l3))))
      .when(Boolean(UPDATER.available()), (el) => el.child(UPDATER.pill(t, this.lang)))
      .child(chip("am-lang", T.switchLang, false, () => this.toggleLang()))
      .child(chip("am-all", T.all, this.all, () => { this.all = !this.all; setShared("agent-map.all", this.all); }))
      .child(chip("am-shells", T.showShells, this.shells, () => { this.shells = !this.shells; setShared("agent-map.shells", this.shells); }))
      .child(div().id("am-close").size(26).flex().items_center().justify_center().rounded(6).text_color(t.dim).cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_mouse_down("left", stop)
        .on_click(() => closeOverlay(props().overlay)).child("×"));
  }

  cellColor(t, age) {
    return age === "fresh" ? alpha(t.muted, "cc") : age === "mid" ? alpha(t.muted, "55") : t.background;
  }

  statusColor(t, s) {
    return s === "blocked" ? t.blocked : s === "working" ? t.working : s === "done" ? t.done : null;
  }

  // As Herdr marks them: working spins, blocked a red dot, done a check, idle an
  // empty ring (each its own shape, not just a color); a shell a small square.
  dot(t, s, size = 14) {
    const slot = div().size(size).flex_none().flex().items_center().justify_center();
    if (s === "working") return slot.child(svg("mods/agent-map/icons/spinner.svg").size(size - 3).text_color(t.working).spin(900));
    if (s === "blocked" || s === "error") return slot.child(div().size(7).rounded(4).bg(t.blocked));
    if (s === "done") return slot.child(svg("mods/agent-map/icons/check.svg").size(size - 2).text_color(t.done));
    if (s === "shell") return slot.child(div().size(7).rounded(2).border_1().border_color(t.border));
    return slot.child(div().size(7).rounded(4).border(1.5).border_color(t.idle ?? t.dim));
  }

  counts(t, list) {
    const n = { blocked: 0, working: 0, done: 0, idle: 0 };
    for (const x of list) if (n[x.status] != null) n[x.status]++;
    const one = (s, v) => h_flex().gap(2).items_center().child(this.dot(t, s, 12)).child(String(v));
    return h_flex().gap(6).items_center().text_size(10.5).text_color(t.dim)
      .when(n.blocked > 0, (el) => el.child(one("blocked", n.blocked)))
      .when(n.working > 0, (el) => el.child(one("working", n.working)))
      .when(n.done > 0, (el) => el.child(one("done", n.done)))
      .child(one("idle", n.idle));
  }

  // A board: null when nothing in it is shown.
  board(t, T, b, bi, q) {
    const terms = (s) => s.spaces.flatMap((sp) => sp.tabs.flatMap((tb) => tb.terms));
    const mine = b.sessions.flatMap(terms).filter((x) => this.shells || x.app);
    if (!mine.length) return null;
    const color = b.color ?? t.dim;
    const multi = b.sessions.length > 1;
    const parts = [];
    let weight = 3;
    for (const s of b.sessions) {
      const part = this.sessionPart(t, T, b, s, bi, q, color);
      if (!part) continue;
      weight += part.weight;
      parts.push(multi
        ? v_flex().mx(8).mt(8).rounded(8).border_1().border_color(t.border)
          .child(h_flex().h(26).px(10).gap(6).items_center().border_b(1).border_color(t.border).text_size(11.5)
            .child(div().text_color(t.dim).child(T.session))
            .child(div().font_semibold().text_color(t.muted).child(s.name || T.defaultSession))
            .child(div().flex_1()).child(this.counts(t, terms(s).filter((x) => this.shells || x.app))))
          .child(part.el)
        : part.el);
    }
    if (!parts.length) return null;
    const el = v_flex().rounded(10).border_1().border_color(mine.some((x) => x.status === "blocked") ? alpha(t.blocked, "99") : t.border).bg(t.background).pb(multi ? 8 : 0)
      .child(h_flex().h(36).px(12).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().size(10).rounded(3).bg(color))
        .child(div().font_semibold().child(b.label))
        .when(multi, (el) => el.child(div().px(5).rounded(5).border_1().border_color(t.border).text_size(10.5).text_color(t.dim).child(T.sessions(b.sessions.length))))
        .child(div().flex_1()).child(this.counts(t, mine)))
      .children(parts);
    return { el, weight };
  }

  sessionPart(t, T, b, s, bi, q, color) {
    const rows = [], quiet = [];
    let weight = 0;
    for (const sp of s.spaces) {
      const units = sp.tabs.map((tb) => ({ tb, xs: tb.terms.filter((x) => (this.shells || x.app) && (!q || this.matches(q, b, s, sp, tb, x))) })).filter((u) => u.xs.length);
      if (!units.length) continue;
      const xs = units.flatMap((u) => u.xs);
      const flat = units.length === 1 && xs.length === 1;
      const x0 = xs[0];
      if (!this.all && !q && flat && !this.live(x0) && !x0.bg.length && (!x0.app || this.resting(x0))) {
        quiet.push({ sp, tb: units[0].tb, x: x0 });
        continue;
      }
      if (flat) {
        rows.push(this.limb(t, color, this.leaf(t, T, bi, x0, sp.name, units[0].tb.name !== sp.name ? units[0].tb.name : null)));
        weight += 1 + x0.bg.length;
      } else if (!this.all && !q && !xs.some((x) => this.live(x) || x.bg.length)) {
        rows.push(this.limb(t, color, this.folded(t, T, bi, sp, units)));
        weight += 1 + Math.ceil(xs.length / 2);
      } else {
        const head = h_flex().h(24).px(8).gap(6).items_center().rounded(6).border_1().border_dashed().border_color(t.border)
          .child(div().min_w(0).truncate().font_medium().child(sp.name))
          .child(div().flex_none().text_size(11).text_color(t.dim).child(units.length > 1 ? T.tabs(units.length) : T.terms(xs.length)));
        const kids = units.flatMap((u) => u.xs.map((x) => this.leaf(t, T, bi, x, null, u.tb.name)));
        rows.push(this.limb(t, color, v_flex().child(head).child(this.fork(t, kids))));
        weight += 1 + xs.length + xs.reduce((a, x) => a + x.bg.length, 0);
      }
    }
    if (!rows.length && !quiet.length) return null;
    const el = v_flex()
      .when(rows.length > 0, (el) => el.child(v_flex().relative().mt(8).mb(8).ml(16).mr(10).pl(12).gap(3)
        .child(div().absolute().left(0).top(4).bottom(10).w(2).rounded(1).bg(alpha(color, "88")))
        .children(rows)))
      .when(quiet.length > 0, (el) => el.child(this.cells(t, T, bi, quiet, rows.length > 0)));
    return { el, weight: weight + (quiet.length ? 1.5 : 0) };
  }

  limb(t, color, child) {
    return div().relative().min_w(0)
      .child(div().absolute().left(-12).top(12).w(10).h(1).bg(t.border))
      .child(child);
  }

  fork(t, kids) {
    return v_flex().relative().pl(18).pt(3).gap(3)
      .children(kids.map((k) => div().relative().min_w(0)
        .child(div().absolute().left(-12).top(-14).w(10).h(26).border_l_1().border_b_1().border_color(t.border).rounded_bl(5))
        .child(k)));
  }

  row(key, bi, go) {
    this.nav.push({ key, board: bi, go });
    return key === this.sel;
  }

  // One terminal: a line (with its name and tab), then its sub-agents as pills.
  leaf(t, T, bi, x, name, tab) {
    const on = this.row(x.address, bi, () => this.goTerm(x));
    const sc = this.statusColor(t, x.status);
    const at = this.since(x);
    const age = x.app && !this.live(x) && at ? T.ago(Math.floor((Date.now() - at) / 60000)) : null;
    const line = h_flex().id(`am-${x.address}`).h(24).px(8).gap(6).items_center().rounded(6).min_w(0).cursor_pointer()
      .when(Boolean(sc), (el) => el.border_1().border_color(alpha(sc, "77")).bg(x.status === "blocked" ? alpha(sc, "1a") : t.raised))
      .when(!sc, (el) => el.text_color(t.muted))
      .when(on, (el) => el.border_1().border_color(t.accent).bg(t.hover))
      .hover((s) => s.bg(t.hover))
      .on_mouse_down("left", stop).on_click(() => this.go({ go: () => this.goTerm(x) }))
      .on_hover(this.hoverOn(x.address, [name, tab].filter(Boolean).join(" · ") || x.address, bi))
      .child(this.dot(t, x.status))
      .when(Boolean(name), (el) => el.child(div().flex_none().max_w(200).truncate().font_medium().text_color(t.foreground).child(name)))
      .when(Boolean(tab), (el) => el.child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(name ? t.muted : t.foreground).child(tab)))
      .when(!tab, (el) => el.child(div().flex_1()))
      .when(!x.app, (el) => el.child(div().flex_none().px(4).rounded(4).border_1().border_dashed().border_color(t.border).text_size(10).text_color(t.dim).child(T.shell)))
      .when(Boolean(age), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(age)));
    if (!x.bg.length) return line;
    // pills keep their own width: each in a row of its own
    return v_flex().child(line).child(this.fork(t, x.bg.map((k) => h_flex().child(this.pill(t, T, bi, k)))));
  }

  pill(t, T, bi, k) {
    const on = this.row(k.address, bi, () => run("agent.focus", { terminal: k.address }));
    return h_flex().id(`am-${k.address}`).h(21).px(7).gap(5).items_center().rounded(11).bg(t.raised).text_size(11).cursor_pointer()
      .when(on, (el) => el.border_1().border_color(t.accent))
      .hover((s) => s.bg(t.hover))
      .on_mouse_down("left", stop).on_click(() => this.go({ go: () => run("agent.focus", { terminal: k.address }) }))
      .on_hover(this.hoverOn(k.address, k.name, bi))
      .child(this.dot(t, k.status)).child(k.name)
      .when(k.alsoTab, (el) => el.child(div().text_color(t.dim).child(`· ${T.alsoTab}`)));
  }

  // A space where everything rests: one line, its tabs as pills that go there.
  folded(t, T, bi, sp, units) {
    const head = h_flex().h(24).px(8).gap(6).items_center().rounded(6).border_1().border_dashed().border_color(t.border).text_color(t.muted)
      .child(div().min_w(0).truncate().font_medium().text_color(t.foreground).child(sp.name))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(`${units.length > 1 ? T.tabs(units.length) : T.terms(units[0].xs.length)} ${T.resting}`));
    const pills = units.flatMap((u) => u.xs.map((x) => {
      const on = this.row(x.address, bi, () => this.goTerm(x));
      const old = !x.app || this.resting(x);
      return h_flex().id(`am-${x.address}`).max_w(180).h(20).px(7).gap(5).items_center().rounded(10).text_size(10.5).cursor_pointer()
        .bg(old ? t.background : t.raised).border_1().border_color(on ? t.accent : old ? t.border : t.raised)
        .text_color(old ? t.dim : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", stop).on_click(() => this.go({ go: () => this.goTerm(x) }))
        .child(this.dot(t, x.status)).child(div().min_w(0).truncate().child(u.tb.name))
        .on_hover(this.hoverOn(x.address, `${sp.name} · ${u.tb.name}`, bi));
    }));
    return v_flex().child(head).child(h_flex().flex_wrap().gap(4).pt(4).pl(10).children(pills));
  }

  // Rested 12 h+ and alone in its space: a cell each, newest first; shells apart.
  cells(t, T, bi, quiet, ruled) {
    const now = Date.now();
    const agents = quiet.filter((c) => c.x.app).sort((a, b) => this.since(b.x) - this.since(a.x));
    const shells = quiet.filter((c) => !c.x.app);
    const age = (x) => { const at = this.since(x); return !at ? "old" : now - at < DAY ? "fresh" : now - at < 3 * DAY ? "mid" : "old"; };
    const cell = (c, kind) => {
      const on = this.row(c.x.address, bi, () => this.goTerm(c.x));
      const at = this.since(c.x);
      const tip = `${c.sp.name}${c.tb.name !== c.sp.name ? ` › ${c.tb.name}` : ""} · ${c.x.address}${at ? ` · ${T.ago(Math.floor((now - at) / 60000))}` : ""}`;
      return div().id(`am-${c.x.address}`).size(12).rounded(3).cursor_pointer()
        .when(kind === "shell", (el) => el.border_1().border_dashed().border_color(t.border))
        .when(kind !== "shell", (el) => el.bg(this.cellColor(t, kind)).when(kind === "old", (e2) => e2.border_1().border_color(t.border)))
        .when(on, (el) => el.border_1().border_color(t.accent))
        .hover((s) => s.border_1().border_color(t.foreground))
        .on_mouse_down("left", stop).on_click(() => this.go({ go: () => this.goTerm(c.x) }))
        .on_hover(this.hoverOn(c.x.address, tip.split(" · ")[0] + (at ? ` · ${T.ago(Math.floor((now - at) / 60000))}` : ""), bi));
    };
    return h_flex().items_start().gap(8).px(12).py(8).when(ruled, (el) => el.border_t(1).border_color(t.border)).text_size(11).text_color(t.dim)
      .child(v_flex().w(64).flex_none()
        .when(agents.length > 0, (el) => el.child(T.quiet(agents.length)))
        .when(shells.length > 0, (el) => el.child(T.shells(shells.length))))
      .child(h_flex().flex_1().flex_wrap().gap(3)
        .children(agents.map((c) => cell(c, age(c.x))))
        .when(shells.length > 0, (el) => el.child(div().w(6)))
        .children(shells.map((c) => cell(c, "shell"))));
  }
}
