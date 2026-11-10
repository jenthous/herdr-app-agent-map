// Made-up computers, spaces and agents for screenshots: `{ "demo": true }` in
// mods/agent-map/config.json shows these instead of the real ones (nothing is run
// and clicks go nowhere).
const C = { indigo: "#5e6ad2", ocean: "#3d7ea6", moss: "#5f8a5b", amber: "#b0873e", rose: "#b05a78", slate: "#64748b" };
let n = 0;
// [status, app?, minutes since its status changed, sub-agents]
const term = (machine, status, mins, bg = []) => {
  const address = `${machine ? machine + "/" : ""}t${(++n).toString(36)}`;
  return {
    address, pane: `p${n}`, space: "", tab: "", status, app: status === "shell" ? null : "claude-code", title: "",
    mins, bg: bg.map(([name, st]) => ({ address: `${machine ? machine + "/" : ""}t${(++n).toString(36)}`, name, status: st, alsoTab: false })),
  };
};
const space = (name, tabs) => ({ id: `sp-${name}`, name, tabs: tabs.map(([tname, terms], i) => ({ id: `tb-${name}-${i}`, name: tname, terms })) });

export function demo() {
  n = 0;
  return [
    { g: { key: "@local" }, label: "This computer", color: C.slate, sessions: [{ name: "", spaces: [
      space("herdr-app-agent-map", [["Agent map recipe", [term(null, "working", 2)]]]),
      space("dotfiles", [["zsh startup time", [term(null, "idle", 95)]], ["Brewfile cleanup", [term(null, "idle", 300)]]]),
      space("notes", [["notes", [term(null, "idle", 60 * 30)]]]),
    ] }] },
    { g: { key: "studio" }, label: "studio", color: C.ocean, sessions: [
      { name: "", spaces: [
        space("checkout-web", [["Payment link retry", [term("studio", "blocked", 1)]]]),
        space("render-farm", [["Batch orchestrator", [term("studio", "working", 4, [["tiles", "working"], ["thumbs", "done"], ["upload", "done"]])]], ["Queue metrics", [term("studio", "idle", 50)]]]),
        space("mobile-app", [["Release 2.4 notes", [term("studio", "done", 7)]]]),
        space("design-system", [["Token audit", [term("studio", "idle", 200)]]]),
        space("infra", [["infra", [term("studio", "idle", 60 * 26)]]]),
        space("analytics", [["analytics", [term("studio", "idle", 60 * 80)]]]),
        space("legacy-admin", [["legacy-admin", [term("studio", "idle", 60 * 120)]]]),
      ] },
      { name: "client-a", spaces: [
        space("landing-page", [["Hero copy pass", [term("studio-client-a", "working", 3)]]]),
        space("crm-sync", [["crm-sync", [term("studio-client-a", "idle", 60 * 40)]]]),
      ] },
    ] },
    { g: { key: "build-box" }, label: "build-box", color: C.moss, sessions: [{ name: "", spaces: [
      space("api", [["Rate limiter", [term("build-box", "working", 6)]], ["Flaky test hunt", [term("build-box", "idle", 30)]], ["Schema docs", [term("build-box", "idle", 60 * 14)]]]),
      space("research", [["Vendor comparison", [term("build-box", "idle", 25, [["pricing", "done"], ["security", "done"]])]]]),
      space("search", [["Reindex plan", [term("build-box", "done", 12)]]]),
      space("ops", [["ops", [term("build-box", "idle", 60 * 20)]]]),
      space("billing", [["billing", [term("build-box", "idle", 60 * 50)]]]),
    ] }] },
    { g: { key: "laptop" }, label: "laptop", color: C.amber, sessions: [{ name: "", spaces: [
      space("blog", [["Draft: terminals that stay", [term("laptop", "idle", 40)]]]),
      space("photos", [["photos", [term("laptop", "idle", 60 * 30)]]]),
      space("taxes", [["taxes", [term("laptop", "idle", 60 * 100)]]]),
    ] }] },
    { g: { key: "gpu" }, label: "gpu", color: C.rose, sessions: [{ name: "", spaces: [
      space("training", [["Eval sweep", [term("gpu", "working", 1, [["seed-1", "working"], ["seed-2", "working"]])]]]),
    ] }] },
  ];
}
