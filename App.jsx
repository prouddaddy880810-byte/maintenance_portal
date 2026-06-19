import { useState, useEffect } from "react";

const TODAY = new Date().toISOString().split("T")[0];

const INITIAL_ASSETS = [
  // FILTERS
  { id: 1,  name: "Upstairs Back Trane",   location: "Upstairs",        category: "Filter",     detail: "20×25×2",       intervalDays: 30,  pmEnabled: true  },
  { id: 2,  name: "Upstairs Front Trane",  location: "Upstairs",        category: "Filter",     detail: "16×20×1",       intervalDays: 30,  pmEnabled: true  },
  { id: 3,  name: "Break Room Unit",       location: "Break Room",      category: "Filter",     detail: "20×20×1",       intervalDays: 30,  pmEnabled: true  },
  { id: 4,  name: "Office Basement Trane", location: "Basement",        category: "Filter",     detail: "Rinse-out",     intervalDays: 30,  pmEnabled: true  },
  { id: 5,  name: "AHU-01",               location: "Roof North",      category: "Filter",     detail: "20×25×2",       intervalDays: 30,  pmEnabled: true  },
  { id: 6,  name: "AHU-02",               location: "Roof South",      category: "Filter",     detail: "20×25×2",       intervalDays: 30,  pmEnabled: true  },
  { id: 7,  name: "RTU-01",               location: "Roof East",       category: "Filter",     detail: "16×20×1",       intervalDays: 60,  pmEnabled: true  },
  { id: 8,  name: "RTU-02",               location: "Roof West",       category: "Filter",     detail: "16×20×1",       intervalDays: 60,  pmEnabled: true  },
  { id: 9,  name: "MAU-01",               location: "Mech Room B",     category: "Filter",     detail: "24×24×4",       intervalDays: 90,  pmEnabled: true  },
  // EQUIPMENT
  { id: 10, name: "Boiler-01",            location: "Mech Room A",     category: "Equipment",  detail: "Annual Insp.",  intervalDays: 365, pmEnabled: true  },
  { id: 11, name: "Compressor-01",        location: "Roof",            category: "Equipment",  detail: "Belt/Oil Check",intervalDays: 90,  pmEnabled: true  },
  { id: 12, name: "Vent Fan Belt",        location: "Back Maintenance",category: "Equipment",  detail: "Belt Replace",  intervalDays: 180, pmEnabled: true  },
  // ELECTRICAL
  { id: 13, name: "60A Fuse Box",         location: "Welding Shop",    category: "Electrical", detail: "Fuse Panel",    intervalDays: 365, pmEnabled: true  },
  { id: 14, name: "Maint. Elec. Panel",   location: "Maintenance",     category: "Electrical", detail: "Wall Panel",    intervalDays: 365, pmEnabled: true  },
  // ASSETS - no PM interval
  { id: 15, name: "UFO Lights",           location: "Warehouse",       category: "Asset",      detail: "Replace on burn", intervalDays: null, pmEnabled: false },
  { id: 16, name: "Fire Suppression",     location: "TBD — walk bldg", category: "Safety",     detail: "Locations TBD", intervalDays: null, pmEnabled: false },
];

const INITIAL_LOGS = [
  { id: 1, assetId: 1,  date: TODAY, note: "20×25×2 replaced", tech: "CB" },
  { id: 2, assetId: 2,  date: TODAY, note: "16×20×1 replaced", tech: "CB" },
  { id: 3, assetId: 3,  date: TODAY, note: "20×20×1 replaced", tech: "CB" },
  { id: 4, assetId: 4,  date: TODAY, note: "Rinse-out flushed", tech: "CB" },
  { id: 5, assetId: 13, date: TODAY, note: "60A fuse box replaced", tech: "CB" },
  { id: 6, assetId: 14, date: TODAY, note: "Wall electrical panel replaced", tech: "CB" },
];

const CAT_COLOR = {
  Filter: "#7c3aed", Equipment: "#38bdf8", Electrical: "#f87171", Asset: "#f59e0b", Safety: "#34d399"
};
const CAT_ICON = {
  Filter: "⚙", Equipment: "⬡", Electrical: "⚡", Asset: "◎", Safety: "⬟"
};

function fromStr(s) { return new Date(s + "T00:00:00"); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function dStr(d) { return d instanceof Date ? d.toISOString().split("T")[0] : d; }
function diffDays(a, b) { return Math.round((b - a) / 86400000); }

function getPM(asset, logs) {
  if (!asset.pmEnabled) return { label: "Log only", color: "#94a3b8", days: null, next: null };
  const al = logs.filter(l => l.assetId === asset.id);
  if (!al.length) return { label: "Never logged", color: "#f87171", days: null, next: null };
  const last = al.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const next = addDays(fromStr(last.date), asset.intervalDays);
  const diff = diffDays(new Date(), next);
  if (diff < 0) return { label: "Overdue", color: "#f87171", days: diff, next };
  if (diff <= 7) return { label: "Due soon", color: "#f59e0b", days: diff, next };
  return { label: "OK", color: "#10b981", days: diff, next };
}

function load(key, fb) { try { return JSON.parse(localStorage.getItem(key) || "null") || fb; } catch { return fb; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

export default function App() {
  const [assets, setAssets] = useState(() => load("cbv3_assets", INITIAL_ASSETS));
  const [logs, setLogs]     = useState(() => load("cbv3_logs", INITIAL_LOGS));
  const [tab, setTab]       = useState("dashboard");
  const [catFilter, setCat] = useState("All");
  const [logModal, setLog]  = useState(null);
  const [histModal, setHist]= useState(null);
  const [addModal, setAdd]  = useState(false);
  const [logNote, setNote]  = useState("");
  const [logDate, setDate]  = useState(TODAY);
  const [toast, setToast]   = useState(null);
  const [addForm, setForm]  = useState({ name: "", location: "", category: "Filter", detail: "", intervalDays: 30, pmEnabled: true });

  useEffect(() => { save("cbv3_assets", assets); }, [assets]);
  useEffect(() => { save("cbv3_logs", logs); }, [logs]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(null), 2800); }

  function doLog() {
    setLogs(p => [...p, { id: Date.now(), assetId: logModal.id, date: logDate, note: logNote, tech: "CB" }]);
    showToast(`✓ Logged: ${logModal.name}`);
    setLog(null); setNote(""); setDate(TODAY);
  }

  function doAdd() {
    if (!addForm.name.trim()) return;
    setAssets(p => [...p, { ...addForm, id: Date.now(), intervalDays: addForm.pmEnabled ? parseInt(addForm.intervalDays) || 30 : null }]);
    showToast(`✓ Added: ${addForm.name}`);
    setAdd(false);
    setForm({ name: "", location: "", category: "Filter", detail: "", intervalDays: 30, pmEnabled: true });
  }

  function deleteAsset(id) {
    setAssets(p => p.filter(a => a.id !== id));
    setLogs(p => p.filter(l => l.assetId !== id));
    showToast("Asset removed");
  }

  const enriched = assets.map(a => ({ ...a, pm: getPM(a, logs) }));
  const overdue  = enriched.filter(a => a.pm.label === "Overdue" || a.pm.label === "Never logged");
  const dueSoon  = enriched.filter(a => a.pm.label === "Due soon");
  const ok       = enriched.filter(a => a.pm.label === "OK");
  const cats     = ["All", ...Array.from(new Set(assets.map(a => a.category)))];

  const sorted = [...enriched].sort((a, b) => {
    const o = { "Never logged": 0, "Overdue": 1, "Due soon": 2, "OK": 3, "Log only": 4 };
    return o[a.pm.label] - o[b.pm.label];
  });
  const displayed = catFilter === "All" ? sorted : sorted.filter(a => a.category === catFilter);

  return (
    <div style={S.root}>
      <div style={S.bg} />
      <div style={S.blob1} /><div style={S.blob2} /><div style={S.blob3} />

      {toast && <div style={S.toast}>{toast}</div>}

      {/* LOG MODAL */}
      {logModal && (
        <Overlay onClose={() => setLog(null)}>
          <div style={{ ...S.mLabel, color: CAT_COLOR[logModal.category] }}>{CAT_ICON[logModal.category]} {logModal.category}</div>
          <div style={S.mTitle}>{logModal.name}</div>
          <div style={S.mSub}>{logModal.location} · {logModal.detail}</div>
          <Lbl>Date</Lbl>
          <input type="date" value={logDate} onChange={e => setDate(e.target.value)} style={S.inp} />
          <Lbl>Notes</Lbl>
          <textarea value={logNote} onChange={e => setNote(e.target.value)}
            placeholder="Parts, filter brand, condition, notes..." style={{ ...S.inp, height: 80, resize: "none" }} />
          <div style={S.mRow}>
            <GhostBtn onClick={() => setLog(null)}>Cancel</GhostBtn>
            <PurpleBtn onClick={doLog}>Save Log</PurpleBtn>
          </div>
        </Overlay>
      )}

      {/* HISTORY MODAL */}
      {histModal && (
        <Overlay onClose={() => setHist(null)}>
          <div style={{ ...S.mLabel, color: CAT_COLOR[histModal.category] }}>{CAT_ICON[histModal.category]} History</div>
          <div style={S.mTitle}>{histModal.name}</div>
          <div style={{ marginTop: 16, maxHeight: 320, overflowY: "auto" }}>
            {logs.filter(l => l.assetId === histModal.id).length === 0
              ? <div style={{ color: "#94a3b8", fontSize: 13, padding: "12px 0" }}>No logs yet.</div>
              : [...logs.filter(l => l.assetId === histModal.id)]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map(l => (
                    <div key={l.id} style={S.histRow}>
                      <span style={{ color: "#7c3aed", fontWeight: 700 }}>{l.date}</span>
                      <span style={{ color: "#94a3b8", fontSize: 12, margin: "0 8px" }}>CB</span>
                      {l.note && <span style={{ color: "#64748b", fontSize: 12 }}>{l.note}</span>}
                    </div>
                  ))
            }
          </div>
          <GhostBtn onClick={() => setHist(null)} style={{ width: "100%", marginTop: 16 }}>Close</GhostBtn>
        </Overlay>
      )}

      {/* ADD MODAL */}
      {addModal && (
        <Overlay onClose={() => setAdd(false)}>
          <div style={S.mTitle}>Add Asset</div>
          <Lbl>Name *</Lbl>
          <input value={addForm.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. RTU-03" style={S.inp} />
          <Lbl>Location</Lbl>
          <input value={addForm.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Roof South" style={S.inp} />
          <Lbl>Category</Lbl>
          <select value={addForm.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={S.inp}>
            {["Filter","Equipment","Electrical","Asset","Safety"].map(c => <option key={c}>{c}</option>)}
          </select>
          <Lbl>Detail</Lbl>
          <input value={addForm.detail} onChange={e => setForm(p => ({ ...p, detail: e.target.value }))} placeholder="e.g. 16×20×1" style={S.inp} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <input type="checkbox" checked={addForm.pmEnabled} onChange={e => setForm(p => ({ ...p, pmEnabled: e.target.checked }))} id="pmtog" />
            <label htmlFor="pmtog" style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>Has PM schedule</label>
          </div>
          {addForm.pmEnabled && (
            <>
              <Lbl>Interval (days)</Lbl>
              <input type="number" value={addForm.intervalDays} onChange={e => setForm(p => ({ ...p, intervalDays: e.target.value }))} style={S.inp} />
            </>
          )}
          <div style={S.mRow}>
            <GhostBtn onClick={() => setAdd(false)}>Cancel</GhostBtn>
            <PurpleBtn onClick={doAdd}>Add Asset</PurpleBtn>
          </div>
        </Overlay>
      )}

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.hInner}>
          <div style={S.logoRow}>
            <div style={S.logoBox}><span style={S.logoTxt}>CB</span></div>
            <div>
              <div style={S.appName}>Maintenance Portal</div>
              <div style={S.appSub}>I&M Machine Shop · St. Joseph, MO</div>
            </div>
          </div>
          <div style={S.statRow}>
            <Pill n={overdue.length} label="Overdue" color="#f87171" />
            <Pill n={dueSoon.length} label="Due Soon" color="#f59e0b" />
            <Pill n={ok.length} label="OK" color="#10b981" />
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          {[["dashboard","Dashboard"],["history","PM History"],["add","+ Add Asset"]].map(([k,l]) => (
            <button key={k} onClick={() => { if(k==="add") setAdd(true); else setTab(k); }}
              style={{ ...S.navBtn, ...(tab===k && k!=="add" ? S.navOn : {}) }}>{l}</button>
          ))}
        </div>
      </nav>

      <main style={S.main}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <>
            {overdue.length > 0 && (
              <div style={S.alertBar}>
                <span style={{ color: "#f87171", fontWeight: 700, fontSize: 13 }}>⚠ {overdue.length} item{overdue.length>1?"s":""} need attention</span>
                {overdue.slice(0,3).map(a => (
                  <span key={a.id} style={S.alertChip}>{a.name}</span>
                ))}
                {overdue.length > 3 && <span style={S.alertChip}>+{overdue.length-3} more</span>}
              </div>
            )}

            <div style={S.catRow}>
              {cats.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  style={{ ...S.catBtn, ...(catFilter===c ? S.catOn : {}) }}>
                  {c !== "All" && CAT_ICON[c]} {c}
                </button>
              ))}
            </div>

            <div style={S.grid}>
              {displayed.map(a => (
                <Card key={a.id} asset={a}
                  onLog={() => setLog(a)}
                  onHistory={() => setHist(a)}
                  onDelete={() => deleteAsset(a.id)} />
              ))}
            </div>
          </>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div style={S.glassPanel}>
            <div style={S.secLabel}>All PM Completions</div>
            {logs.length === 0
              ? <div style={{ color: "#94a3b8", fontSize: 13 }}>No logs yet.</div>
              : [...logs].sort((a,b) => new Date(b.date)-new Date(a.date)).map(l => {
                  const a = assets.find(x => x.id === l.assetId);
                  return (
                    <div key={l.id} style={S.logRow}>
                      <span style={{ color: "#7c3aed", fontWeight: 700, fontSize: 12, minWidth: 90 }}>{l.date}</span>
                      <span style={{ color: CAT_COLOR[a?.category]||"#94a3b8", fontSize: 15 }}>{CAT_ICON[a?.category||"Asset"]}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1e1b4b" }}>{a?.name||"Unknown"}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{a?.location}</div>
                        {l.note && <div style={{ fontSize: 12, color: "#64748b" }}>{l.note}</div>}
                      </div>
                      <span style={{ fontSize: 11, color: "#cbd5e1" }}>CB</span>
                    </div>
                  );
                })
            }
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ asset, onLog, onHistory, onDelete }) {
  const { pm } = asset;
  return (
    <div style={{
      background: "rgba(255,255,255,0.65)",
      border: `1.5px solid ${pm.color}30`,
      borderRadius: 20,
      padding: 18,
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      boxShadow: `0 4px 24px ${pm.color}12, inset 0 1px 0 rgba(255,255,255,0.9)`,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 22, color: CAT_COLOR[asset.category] }}>{CAT_ICON[asset.category]}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: "3px 9px", borderRadius: 20,
          color: pm.color, background: pm.color+"18", border: `1px solid ${pm.color}30` }}>{pm.label}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: 15, color: "#1e1b4b", lineHeight: 1.2, marginTop: 2 }}>{asset.name}</div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{asset.location}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{asset.detail}</div>
      {asset.pmEnabled && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: "#cbd5e1" }}>Every {asset.intervalDays}d</span>
          {pm.days !== null && (
            <span style={{ fontSize: 11, color: pm.color, fontWeight: 700 }}>
              {pm.days < 0 ? `${Math.abs(pm.days)}d past due` : `${pm.days}d left`}
            </span>
          )}
        </div>
      )}
      {pm.next && (
        <div style={{ fontSize: 10, color: "#cbd5e1" }}>Next: <span style={{ color: pm.color }}>{dStr(pm.next)}</span></div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={onHistory} style={S.cGhost}>History</button>
        <button onClick={onDelete} style={{ ...S.cGhost, color: "#f87171", borderColor: "#f8717130" }}>Remove</button>
        <button onClick={onLog} style={S.cPrimary}>Log PM</button>
      </div>
    </div>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={S.modal}>{children}</div>
    </div>
  );
}
function Lbl({ children }) {
  return <label style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 0.5, display: "block", marginTop: 14, marginBottom: 5, fontWeight: 600 }}>{children}</label>;
}
function PurpleBtn({ children, onClick, style: s }) {
  return <button onClick={onClick} style={{ ...S.btnP, ...s }}>{children}</button>;
}
function GhostBtn({ children, onClick, style: s }) {
  return <button onClick={onClick} style={{ ...S.btnG, ...s }}>{children}</button>;
}
function Pill({ n, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: color+"15", border: `1px solid ${color}30`, borderRadius: 20, padding: "4px 12px" }}>
      <span style={{ color, fontWeight: 800, fontSize: 14 }}>{n}</span>
      <span style={{ color, fontSize: 9, letterSpacing: 1, fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif", position: "relative", overflowX: "hidden" },
  bg:    { position: "fixed", inset: 0, background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f5f0ff 100%)", zIndex: 0 },
  blob1: { position: "fixed", top: -150, left: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.3) 0%, transparent 65%)", zIndex: 0, pointerEvents: "none" },
  blob2: { position: "fixed", bottom: -100, right: -80, width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,181,253,0.25) 0%, transparent 65%)", zIndex: 0, pointerEvents: "none" },
  blob3: { position: "fixed", top: "40%", left: "30%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 65%)", zIndex: 0, pointerEvents: "none" },
  header: { position: "relative", zIndex: 10, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(124,58,237,0.1)", boxShadow: "0 1px 0 rgba(255,255,255,0.8), 0 4px 24px rgba(124,58,237,0.06)" },
  hInner: { maxWidth: 1100, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  logoRow: { display: "flex", alignItems: "center", gap: 14 },
  logoBox: { width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #7c3aed, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" },
  logoTxt: { color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: 1 },
  appName: { fontWeight: 800, fontSize: 16, color: "#1e1b4b" },
  appSub:  { fontSize: 10, color: "#94a3b8", marginTop: 1 },
  statRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  nav: { position: "relative", zIndex: 9, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(124,58,237,0.08)" },
  navInner: { maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", overflowX: "auto" },
  navBtn: { padding: "13px 20px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500, borderBottom: "2px solid transparent", whiteSpace: "nowrap" },
  navOn:  { color: "#7c3aed", borderBottom: "2px solid #7c3aed", fontWeight: 700 },
  main: { position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
  alertBar: { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 },
  alertChip: { background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: 10, fontSize: 11, fontWeight: 600, padding: "3px 10px" },
  catRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 },
  catBtn: { padding: "7px 15px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(124,58,237,0.12)", color: "#64748b", borderRadius: 20, cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
  catOn:  { background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.35)", color: "#7c3aed", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 },
  glassPanel: { background: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(124,58,237,0.1)", borderRadius: 20, padding: 24, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(124,58,237,0.06), inset 0 1px 0 rgba(255,255,255,0.9)" },
  secLabel: { fontSize: 11, letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 16 },
  logRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(124,58,237,0.06)", flexWrap: "wrap" },
  histRow: { padding: "10px 0", borderBottom: "1px solid rgba(124,58,237,0.07)", display: "flex", flexWrap: "wrap", gap: 0 },
  cGhost: { flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(124,58,237,0.15)", color: "#7c3aed", borderRadius: 12, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 },
  cPrimary: { flex: 2, padding: "8px 0", background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.3)", color: "#7c3aed", borderRadius: 12, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 800 },
  overlay: { position: "fixed", inset: 0, background: "rgba(30,27,75,0.2)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal: { background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(124,58,237,0.15)", borderRadius: 24, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(124,58,237,0.2), inset 0 1px 0 #fff", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" },
  mLabel: { fontSize: 10, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 },
  mTitle: { fontSize: 20, fontWeight: 800, color: "#1e1b4b", marginBottom: 4 },
  mSub:   { fontSize: 13, color: "#94a3b8" },
  mRow:   { display: "flex", gap: 10, marginTop: 20 },
  inp: { width: "100%", background: "rgba(124,58,237,0.04)", border: "1.5px solid rgba(124,58,237,0.15)", color: "#1e1b4b", padding: "10px 14px", fontFamily: "inherit", fontSize: 14, borderRadius: 12, boxSizing: "border-box" },
  btnP: { flex: 2, padding: "11px 20px", background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.35)", color: "#7c3aed", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, borderRadius: 14 },
  btnG: { flex: 1, padding: "11px 16px", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(124,58,237,0.15)", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit", fontSize: 13, borderRadius: 14 },
  toast: { position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(124,58,237,0.2)", backdropFilter: "blur(20px)", color: "#7c3aed", fontWeight: 700, padding: "12px 28px", borderRadius: 20, fontSize: 13, zIndex: 999, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(124,58,237,0.2)" },
};
