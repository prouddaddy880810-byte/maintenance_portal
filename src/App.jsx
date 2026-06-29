import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split("T")[0];

const CAT_COLOR = { Filter:"#7c3aed", Equipment:"#38bdf8", Electrical:"#f87171", Asset:"#f59e0b", Safety:"#34d399", Machine:"#a855f7" };
const CAT_ICON  = { Filter:"⚙", Equipment:"⬡", Electrical:"⚡", Asset:"◎", Safety:"⬟", Machine:"🏭" };

const INITIAL_ASSETS = [
  { id:1,  name:"Upstairs Back Trane",   location:"Upstairs",        category:"Filter",    detail:"20×25×2",        intervalDays:30,  pmEnabled:true  },
  { id:2,  name:"Upstairs Front Trane",  location:"Upstairs",        category:"Filter",    detail:"16×20×1",        intervalDays:30,  pmEnabled:true  },
  { id:3,  name:"Break Room Unit",       location:"Break Room",      category:"Filter",    detail:"20×20×1",        intervalDays:30,  pmEnabled:true  },
  { id:4,  name:"Office Basement Trane", location:"Basement",        category:"Filter",    detail:"Rinse-out",      intervalDays:30,  pmEnabled:true  },
  { id:5,  name:"AHU-01",               location:"Roof North",      category:"Filter",    detail:"20×25×2",        intervalDays:30,  pmEnabled:true  },
  { id:6,  name:"AHU-02",               location:"Roof South",      category:"Filter",    detail:"20×25×2",        intervalDays:30,  pmEnabled:true  },
  { id:7,  name:"RTU-01",               location:"Roof East",       category:"Filter",    detail:"16×20×1",        intervalDays:60,  pmEnabled:true  },
  { id:8,  name:"RTU-02",               location:"Roof West",       category:"Filter",    detail:"16×20×1",        intervalDays:60,  pmEnabled:true  },
  { id:9,  name:"MAU-01",               location:"Mech Room B",     category:"Filter",    detail:"24×24×4",        intervalDays:90,  pmEnabled:true  },
  { id:10, name:"Boiler-01",            location:"Mech Room A",     category:"Equipment", detail:"Annual Insp.",   intervalDays:365, pmEnabled:true  },
  { id:11, name:"Kaeser Compressor-01", location:"Compressor Room", category:"Equipment", detail:"Belt/Oil Check", intervalDays:90,  pmEnabled:true  },
  { id:12, name:"Vent Fan Belt",        location:"Back Maintenance",category:"Equipment", detail:"Belt Replace",   intervalDays:180, pmEnabled:true  },
  { id:13, name:"60A Fuse Box",         location:"Welding Shop",    category:"Electrical",detail:"Fuse Panel",     intervalDays:365, pmEnabled:true  },
  { id:14, name:"Maint. Elec. Panel",   location:"Maintenance",     category:"Electrical",detail:"Wall Panel",     intervalDays:365, pmEnabled:true  },
  { id:15, name:"UFO Lights",           location:"Warehouse",       category:"Asset",     detail:"Replace on burn",intervalDays:null,pmEnabled:false },
  { id:16, name:"Fire Suppression",     location:"TBD",             category:"Safety",    detail:"Locations TBD",  intervalDays:null,pmEnabled:false },
];

const INITIAL_LOGS = [
  { id:7, assetId:11, date:TODAY, note:"🔴 FAULT E403 — Compressor Discharge Temp. WARNING A602 also active. Run hrs: 40,056. Service due in 7hrs. CFM=0 at time of fault. Check: oil level, oil separator element, cooling fan, air/oil cooler. Do NOT restart without inspection.", tech:"CB" },
  { id:1, assetId:1,  date:TODAY, note:"20×25×2 replaced", tech:"CB" },
  { id:2, assetId:2,  date:TODAY, note:"16×20×1 replaced", tech:"CB" },
  { id:3, assetId:3,  date:TODAY, note:"20×20×1 replaced", tech:"CB" },
  { id:4, assetId:4,  date:TODAY, note:"Rinse-out flushed", tech:"CB" },
  { id:5, assetId:13, date:TODAY, note:"60A fuse box checked", tech:"CB" },
  { id:6, assetId:14, date:TODAY, note:"Wall electrical panel checked", tech:"CB" },
];

const INITIAL_MACHINES = [];

const INITIAL_GAUGE_LOGS = [
  {
    id:3, assetId:11, timestamp:"2026-06-24T07:16:00",
    pressure:108, temp:null, runHours:40056, loadHours:35202,
    maintenanceIn:7, status:"FAULT — E403 Compressor Discharge Temp", keyMode:"Remote Start Enabled | Auto Restart Enabled",
    notes:"🔴 FAULT E403: Compressor Discharge Temp. ⚠️ WARNING A602: Compressor Discharge Temp. CFM=0. Service due in 7 hours. Immediate inspection required — check oil level, oil separator element, cooling fan, and air/oil cooler for blockage.", photo:null, source:"manual"
  },
  {
    id:2, assetId:11, timestamp:"2026-06-24T07:16:00",
    pressure:111, temp:171, runHours:38135, loadHours:21616,
    maintenanceIn:957, status:"On Load", keyMode:"On | pA - Load",
    notes:"Routine morning reading. All values normal.", photo:null, source:"manual"
  },
  {
    id:1, assetId:11, timestamp:"2026-06-22T07:03:00",
    pressure:110, temp:163, runHours:38087, loadHours:21598,
    maintenanceIn:1005, status:"On Load", keyMode:"On | pA - Load",
    notes:"", photo:null, source:"manual"
  }
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function load(k, fb) { try { return JSON.parse(localStorage.getItem(k)||"null") || fb; } catch { return fb; } }
function save(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// ─── GOOGLE SHEETS BACKEND ───────────────────────────────────────────────────
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbyNZWEL8Ro0hTqBZfqEEaR13QGfEFqJhHSlULs841nDx-107gfetZN7ow87d-p-KRpFbA/exec";

async function sheetsPost(action, data) {
  try {
    const res = await fetch(SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, data }),
    });
    return await res.json();
  } catch (err) {
    console.warn("Sheets sync failed:", err);
    return { success: false, error: err.toString() };
  }
}

function fromStr(s)  { return new Date(s+"T00:00:00"); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function dStr(d)     { return d instanceof Date ? d.toISOString().split("T")[0] : d; }
function diffDays(a,b){ return Math.round((b-a)/86400000); }
function fmtDT(iso)  { if(!iso) return "—"; const d=new Date(iso); return d.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}); }

function getPM(asset, logs) {
  if (!asset.pmEnabled) return { label:"Log only", color:"#94a3b8", days:null, next:null };
  const al = logs.filter(l => l.assetId===asset.id);
  if (!al.length) return { label:"Never logged", color:"#f87171", days:null, next:null };
  const last = al.sort((a,b) => new Date(b.date)-new Date(a.date))[0];
  const next = addDays(fromStr(last.date), asset.intervalDays);
  const diff = diffDays(new Date(), next);
  if (diff<0) return { label:"Overdue", color:"#f87171", days:diff, next };
  if (diff<=7) return { label:"Due soon", color:"#f59e0b", days:diff, next };
  return { label:"OK", color:"#10b981", days:diff, next };
}

// ─── AI HELPERS ──────────────────────────────────────────────────────────────
async function aiParseImage(base64, prompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model:"claude-sonnet-4-6", max_tokens:1000,
      messages:[{ role:"user", content:[
        { type:"image", source:{ type:"base64", media_type:"image/jpeg", data:base64 }},
        { type:"text", text:prompt }
      ]}]
    })
  });
  const data = await resp.json();
  const text = data.content?.find(b=>b.type==="text")?.text || "{}";
  try { return JSON.parse(text.replace(/```json|```/g,"").trim()); }
  catch { return null; }
}

const GAUGE_PROMPT = `Parse this compressor/equipment display and return ONLY valid JSON, no markdown:
{"pressure":null,"temp":null,"timeDisplay":null,"status":null,"keyMode":null,"runHours":null,"loadHours":null,"maintenanceIn":null,"extraFields":{}}
Fill in any values visible. Use null for anything not shown.`;

const NAMEPLATE_PROMPT = `Parse this machine/equipment nameplate and return ONLY valid JSON, no markdown:
{"make":null,"model":null,"serialNumber":null,"partNumber":null,"voltage":null,"amperage":null,"horsepower":null,"rpm":null,"phase":null,"hz":null,"weight":null,"year":null,"category":null,"description":null,"suggestedName":null,"suggestedId":null,"pmIntervalDays":null,"additionalSpecs":{}}
- suggestedName: short operational name like "CNC Mill-01" or "Tube Laser-01"  
- suggestedId: short tag like "MILL-01", "TL-01", "COMP-02"
- category: one of Filter/Equipment/Electrical/Asset/Safety/Machine
- pmIntervalDays: suggested PM interval based on equipment type (null if unknown)
Fill everything visible. Use null for missing fields.`;


// ─── DEFAULT PM TASKS PER CATEGORY ──────────────────────────────────────────
const DEFAULT_PM_TASKS = {
  Filter:     ["Replace/rinse filter", "Check housing seal", "Log filter brand & size"],
  Equipment:  ["Inspect belts & tensioners", "Check fluid levels", "Lubricate fittings", "Test operation", "Log any abnormalities"],
  Electrical: ["Visual inspection – no signs of heat/burn", "Check breaker tightness", "Test GFCI if present", "Confirm labeling is accurate"],
  Machine:    ["Check oil/coolant level", "Inspect guards & safety devices", "Clean debris from machine", "Lubricate per spec", "Run test cycle"],
  Asset:      ["Visual condition check", "Test operation", "Note any wear or damage"],
  Safety:     ["Verify accessibility (not blocked)", "Check expiry dates", "Log inspection per code"],
};

// ─── ASSET PM TASKS MODAL ────────────────────────────────────────────────────
function PMTaskModal({ asset, onClose, onLogPM }) {
  const [checked, setChecked] = useState({});
  const [note, setNote]       = useState("");
  const [photo, setPhoto]     = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const tasks = asset.pmTasks || DEFAULT_PM_TASKS[asset.category] || DEFAULT_PM_TASKS["Asset"];

  const toggle = (i) => setChecked(p => ({ ...p, [i]: !p[i] }));
  const allDone = tasks.every((_, i) => checked[i]);

  const handlePhoto = (base64, dataUrl) => { setPhoto(base64); setPhotoUrl(dataUrl); };

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight:800, fontSize:16, color:"#7c3aed", marginBottom:4 }}>🔩 PM Checklist</div>
      <div style={{ fontWeight:700, fontSize:14, color:"#1e1b4b", marginBottom:2 }}>{asset.name}</div>
      <div style={{ fontSize:11, color:"#94a3b8", marginBottom:16 }}>{asset.location} · {asset.category}</div>

      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
        {tasks.map((task, i) => (
          <div key={i} onClick={() => toggle(i)}
            style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 14px",
              background: checked[i] ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.7)",
              border: `1.5px solid ${checked[i] ? "#10b981" : "rgba(124,58,237,0.15)"}`,
              borderRadius:12, cursor:"pointer", transition:"all 0.15s" }}>
            <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked[i]?"#10b981":"#cbd5e1"}`,
              background: checked[i] ? "#10b981" : "transparent", display:"flex", alignItems:"center",
              justifyContent:"center", flexShrink:0, marginTop:1 }}>
              {checked[i] && <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ fontSize:13, color: checked[i] ? "#065f46" : "#334155", fontWeight: checked[i] ? 600 : 400, lineHeight:1.4 }}>{task}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:6 }}>NOTES (optional)</div>
      <textarea value={note} onChange={e => setNote(e.target.value)}
        placeholder="Parts used, condition notes, anything unusual..."
        style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid rgba(124,58,237,0.2)",
          background:"rgba(255,255,255,0.8)", fontSize:13, resize:"none", height:72,
          fontFamily:"inherit", color:"#334155", boxSizing:"border-box" }} />

      <div style={{ marginTop:12, marginBottom:4, fontSize:11, color:"#94a3b8", fontWeight:600 }}>PHOTO (optional)</div>
      {photoUrl
        ? <div style={{ position:"relative", marginBottom:12 }}>
            <img src={photoUrl} alt="pm" style={{ width:"100%", maxHeight:110, objectFit:"cover", borderRadius:10, opacity:0.88 }} />
            <button onClick={() => { setPhoto(null); setPhotoUrl(null); }}
              style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.55)", border:"none", borderRadius:20,
                color:"#fff", fontSize:11, padding:"3px 8px", cursor:"pointer" }}>✕</button>
          </div>
        : <PhotoCapture onCapture={handlePhoto} label="📸 Add Photo" />
      }

      {!allDone && (
        <div style={{ marginTop:14, padding:"8px 12px", background:"rgba(245,158,11,0.1)",
          border:"1px solid rgba(245,158,11,0.3)", borderRadius:8, fontSize:12, color:"#92400e", textAlign:"center" }}>
          {tasks.filter((_, i) => !checked[i]).length} task(s) remaining
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginTop:16 }}>
        <button onClick={onClose}
          style={{ flex:1, padding:"12px 0", borderRadius:12, border:"1.5px solid rgba(148,163,184,0.3)",
            background:"rgba(255,255,255,0.7)", color:"#64748b", fontWeight:600, fontSize:13, cursor:"pointer" }}>
          Cancel
        </button>
        <button onClick={() => onLogPM({ note, photo, photoUrl, checkedCount: Object.values(checked).filter(Boolean).length, totalTasks: tasks.length })}
          style={{ flex:2, padding:"12px 0", borderRadius:12, border:"none",
            background: allDone ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
            color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          {allDone ? "✅ Log PM Complete" : "⚡ Log Partial PM"}
        </button>
      </div>
    </Overlay>
  );
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal}>{children}</div>
    </div>
  );
}

function Badge({ label, color }) {
  const colors = { High:"#f87171",Medium:"#f59e0b",Low:"#10b981",Open:"#7c3aed","In Progress":"#f59e0b",Closed:"#94a3b8",photo:"#a855f7",manual:"#38bdf8" };
  const c = color || colors[label] || "#7c3aed";
  return <span style={{ background:c+"20", color:c, border:`1px solid ${c}40`, borderRadius:4, padding:"2px 8px", fontSize:10, fontWeight:700, letterSpacing:0.5 }}>{label}</span>;
}

function Pill({ n, label, color, onClick }) {
  return (
    <div onClick={onClick} style={{ display:"flex",alignItems:"center",gap:5,background:color+"15",border:`1px solid ${color}30`,borderRadius:20,padding:"4px 12px",cursor:onClick?"pointer":"default" }}>
      <span style={{ color,fontWeight:800,fontSize:14 }}>{n}</span>
      <span style={{ color,fontSize:9,letterSpacing:1,fontWeight:600,textTransform:"uppercase" }}>{label}</span>
    </div>
  );
}

function Lbl({ children }) {
  return <label style={{ fontSize:11,color:"#94a3b8",letterSpacing:0.5,display:"block",marginTop:14,marginBottom:5,fontWeight:600 }}>{children}</label>;
}

// ─── PHOTO CAPTURE BUTTON ────────────────────────────────────────────────────
function PhotoCapture({ onCapture, label="📸 Scan", loading=false, accept="image/*" }) {
  const ref = useRef();
  return (
    <>
      <input type="file" accept={accept} capture="environment" ref={ref} onChange={e=>{const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>onCapture(ev.target.result.split(",")[1], ev.target.result); r.readAsDataURL(f); e.target.value="";}} style={{display:"none"}} />
      <button onClick={()=>ref.current?.click()} disabled={loading} style={{ padding:"12px 20px", background:"linear-gradient(135deg,#7c3aed,#a855f7)", border:"none", borderRadius:12, color:"#fff", fontWeight:700, fontSize:13, cursor:loading?"not-allowed":"pointer", opacity:loading?0.6:1, whiteSpace:"nowrap" }}>
        {loading ? "⏳ Parsing..." : label}
      </button>
    </>
  );
}

// ─── EDIT MODAL (generic) ────────────────────────────────────────────────────
function EditModal({ item, fields, title, onSave, onClose }) {
  const [form, setForm] = useState({...item});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <Overlay onClose={onClose}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <span style={{ fontWeight:800,fontSize:17,color:"#1e1b4b" }}>✏️ {title}</span>
        <button onClick={onClose} style={{ background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#94a3b8" }}>✕</button>
      </div>
      <div style={{ maxHeight:"60vh",overflowY:"auto" }}>
        {fields.map(f=>(
          <div key={f.key}>
            <Lbl>{f.label}</Lbl>
            {f.type==="select" ? (
              <select value={form[f.key]||""} onChange={e=>set(f.key,e.target.value)} style={S.inp}>
                {f.options.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type==="textarea" ? (
              <textarea value={form[f.key]||""} onChange={e=>set(f.key,e.target.value)} rows={3} style={{...S.inp,resize:"vertical"}} />
            ) : f.type==="checkbox" ? (
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                <input type="checkbox" checked={!!form[f.key]} onChange={e=>set(f.key,e.target.checked)} id={f.key} />
                <label htmlFor={f.key} style={{fontSize:13,color:"#475569",cursor:"pointer"}}>{f.checkLabel||f.label}</label>
              </div>
            ) : (
              <input type={f.type||"text"} value={form[f.key]||""} onChange={e=>set(f.key,e.target.value)} style={S.inp} />
            )}
          </div>
        ))}
      </div>
      <div style={S.mRow}>
        <button onClick={onClose} style={S.btnG}>Cancel</button>
        <button onClick={()=>onSave(form)} style={S.btnP}>Save Changes</button>
      </div>
    </Overlay>
  );
}

// ─── CONFIRM DELETE MODAL ────────────────────────────────────────────────────
function ConfirmDelete({ name, onConfirm, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:40,marginBottom:12 }}>🗑</div>
        <div style={{ fontWeight:800,fontSize:18,color:"#1e1b4b",marginBottom:8 }}>Delete Permanently?</div>
        <div style={{ fontSize:14,color:"#64748b",marginBottom:6 }}>
          <strong style={{color:"#1e1b4b"}}>{name}</strong>
        </div>
        <div style={{ fontSize:13,color:"#94a3b8",marginBottom:24 }}>
          This removes the asset and all its PM history forever.<br/>
          Use <strong>Hide</strong> instead to just remove it from the dashboard.
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ ...S.btnG,flex:1 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:2,padding:"11px 20px",background:"rgba(239,68,68,0.1)",border:"1.5px solid rgba(239,68,68,0.4)",color:"#ef4444",cursor:"pointer",fontFamily:"inherit",fontWeight:800,fontSize:13,borderRadius:14 }}>
            Yes, Delete Forever
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── ASSET CARD ──────────────────────────────────────────────────────────────
function AssetCard({ asset, onLog, onPMTask, onHistory, onEdit, onDismiss, onDelete, dismissed, photos, onAddPhoto, onAddWatch }) {
  const { pm } = asset;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cardPhotos = photos || [];
  return (
    <>
      {confirmingDelete && (
        <ConfirmDelete
          name={asset.name}
          onConfirm={onDelete}
          onClose={()=>setConfirmingDelete(false)}
        />
      )}
      <div style={{ background: dismissed ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.65)", border:`1.5px solid ${dismissed ? "rgba(148,163,184,0.2)" : pm.color+"30"}`, borderRadius:20, padding:18, backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", boxShadow:`0 4px 24px ${pm.color}12, inset 0 1px 0 rgba(255,255,255,0.9)`, display:"flex",flexDirection:"column",gap:6, opacity: dismissed ? 0.65 : 1 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
          <span style={{ fontSize:22,color:CAT_COLOR[asset.category] }}>{CAT_ICON[asset.category]}</span>
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            {dismissed && <span style={{ fontSize:9,fontWeight:800,letterSpacing:1,padding:"3px 9px",borderRadius:20,color:"#94a3b8",background:"rgba(148,163,184,0.15)",border:"1px solid rgba(148,163,184,0.3)" }}>Hidden</span>}
            {!dismissed && <span style={{ fontSize:9,fontWeight:800,letterSpacing:1,padding:"3px 9px",borderRadius:20,color:pm.color,background:pm.color+"18",border:`1px solid ${pm.color}30` }}>{pm.label}</span>}
          </div>
        </div>
        <div style={{ fontWeight:800,fontSize:15,color:"#1e1b4b",lineHeight:1.2,marginTop:2 }}>{asset.name}</div>
        <div style={{ fontSize:11,color:"#94a3b8" }}>{asset.location}</div>
        <div style={{ fontSize:12,color:"#64748b" }}>{asset.detail}</div>

        {/* Photo strip */}
        {cardPhotos.length > 0 && (
          <div style={{ display:"flex",gap:5,overflowX:"auto",paddingBottom:2,marginTop:2 }}>
            {cardPhotos.slice(0,4).map((p,i)=>(
              <div key={i} style={{ position:"relative",flexShrink:0 }}>
                <img src={p.url} alt={p.label||`photo ${i+1}`} style={{ width:52,height:52,objectFit:"cover",borderRadius:8,border:"1.5px solid rgba(124,58,237,0.15)" }} />
                {cardPhotos.length>4 && i===3 && (
                  <div style={{ position:"absolute",inset:0,background:"rgba(30,27,75,0.55)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:800 }}>+{cardPhotos.length-3}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {!dismissed && asset.pmEnabled && (
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}>
            <span style={{ fontSize:10,color:"#cbd5e1" }}>Every {asset.intervalDays}d</span>
            {pm.days!==null && <span style={{ fontSize:11,color:pm.color,fontWeight:700 }}>{pm.days<0?`${Math.abs(pm.days)}d past due`:`${pm.days}d left`}</span>}
          </div>
        )}
        {!dismissed && pm.next && <div style={{ fontSize:10,color:"#cbd5e1" }}>Next: <span style={{color:pm.color}}>{dStr(pm.next)}</span></div>}
        <div style={{ display:"flex",gap:6,marginTop:10,flexWrap:"wrap" }}>
          {!dismissed && <button onClick={onHistory} style={S.cGhost}>History</button>}
          <button onClick={onEdit} style={{ ...S.cGhost,color:"#7c3aed" }}>Edit</button>
          {dismissed
            ? <button onClick={onDismiss} style={{ ...S.cGhost,color:"#10b981",borderColor:"rgba(16,185,129,0.3)" }}>↩ Restore</button>
            : <button onClick={onDismiss} style={{ ...S.cGhost,color:"#f59e0b",borderColor:"rgba(245,158,11,0.3)" }}>Hide</button>
          }
          <button onClick={()=>setConfirmingDelete(true)} style={{ ...S.cGhost,color:"#f87171",borderColor:"#f8717130" }}>🗑 Delete</button>
          {!dismissed && (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap", width:"100%" }}>
      <button onClick={onPMTask} style={{ ...S.cPrimary, fontSize:11, padding:"8px 12px" }}>🔩 PM Tasks</button>
      <button onClick={onLog} style={{ ...S.cPrimary, background:"rgba(124,58,237,0.08)", color:"#7c3aed", border:"1.5px solid rgba(124,58,237,0.25)", fontSize:11, padding:"8px 12px" }}>📋 Quick Log</button>
      <button onClick={onAddPhoto} style={{ ...S.cGhost, color:"#a855f7", borderColor:"rgba(168,85,247,0.3)", fontSize:11, padding:"6px 10px" }}>📷 {cardPhotos.length>0?`Photos (${cardPhotos.length})`:"Add Photo"}</button>
      <button onClick={onAddWatch} style={{ ...S.cGhost, color:"#f59e0b", borderColor:"rgba(245,158,11,0.35)", fontSize:11, padding:"6px 10px" }}>👁 Watch</button>
    </div>
  )}
        </div>
      </div>
    </>
  );
}

// ─── MACHINE DATABASE TAB ────────────────────────────────────────────────────
const MACHINE_EDIT_FIELDS = [
  { key:"name",          label:"Machine Name" },
  { key:"assetTag",      label:"Asset Tag / ID" },
  { key:"location",      label:"Location / Building" },
  { key:"make",          label:"Make / Manufacturer" },
  { key:"model",         label:"Model" },
  { key:"serialNumber",  label:"Serial Number" },
  { key:"partNumber",    label:"Part Number" },
  { key:"voltage",       label:"Voltage" },
  { key:"amperage",      label:"Amperage" },
  { key:"horsepower",    label:"Horsepower" },
  { key:"rpm",           label:"RPM" },
  { key:"phase",         label:"Phase" },
  { key:"year",          label:"Year" },
  { key:"category",      label:"Category", type:"select", options:["Machine","Equipment","Electrical","Asset","Safety","Filter"] },
  { key:"pmIntervalDays",label:"PM Interval (days)", type:"number" },
  { key:"description",   label:"Notes / Description", type:"textarea" },
];

function parsedToMachine(preview) {
  return {
    id: Date.now(),
    name: preview.suggestedName || "",
    assetTag: preview.suggestedId || "",
    make: preview.make || "", model: preview.model || "",
    serialNumber: preview.serialNumber || "", partNumber: preview.partNumber || "",
    voltage: preview.voltage || "", amperage: preview.amperage || "",
    horsepower: preview.horsepower || "", rpm: preview.rpm || "",
    phase: preview.phase || "", hz: preview.hz || "",
    weight: preview.weight || "", year: preview.year || "",
    category: preview.category || "Machine",
    description: preview.description || "",
    pmIntervalDays: preview.pmIntervalDays || "",
    additionalSpecs: preview.additionalSpecs || {},
    photos: preview._photo ? [{ url: preview._photo, addedAt: new Date().toISOString(), label: "Nameplate" }] : [],
    addedAt: new Date().toISOString(),
    location: "",
  };
}

// Merge new parsed data into an existing machine (add photo, fill in blanks)
function mergeIntoMachine(existing, preview) {
  const newPhoto = preview._photo ? { url: preview._photo, addedAt: new Date().toISOString(), label: "Additional nameplate" } : null;
  return {
    ...existing,
    // Only fill in fields that are currently empty
    make:         existing.make         || preview.make         || "",
    model:        existing.model        || preview.model        || "",
    serialNumber: existing.serialNumber || preview.serialNumber || "",
    partNumber:   existing.partNumber   || preview.partNumber   || "",
    voltage:      existing.voltage      || preview.voltage      || "",
    amperage:     existing.amperage     || preview.amperage     || "",
    horsepower:   existing.horsepower   || preview.horsepower   || "",
    rpm:          existing.rpm          || preview.rpm          || "",
    phase:        existing.phase        || preview.phase        || "",
    year:         existing.year         || preview.year         || "",
    photos: newPhoto ? [...(existing.photos||[]), newPhoto] : (existing.photos||[]),
    updatedAt: new Date().toISOString(),
  };
}

function MachineDB({ machines, setMachines, showToast }) {
  const [scanning,    setScanning]    = useState(false);
  const [preview,     setPreview]     = useState(null);   // parsed AI result waiting for decision
  const [decision,    setDecision]    = useState(null);   // "new" | "existing"
  const [editM,       setEditM]       = useState(null);   // machine open in edit modal
  const [mergeTarget, setMergeTarget] = useState(null);   // machine to merge into
  const [filter,      setFilter]      = useState("All");
  const [search,      setSearch]      = useState("");
  const [sessionLog,  setSessionLog]  = useState([]);     // today's scan session
  const [sessionMode, setSessionMode] = useState(false);

  const handleScan = useCallback(async (base64, dataUrl) => {
    setScanning(true);
    setPreview(null);
    setDecision(null);
    setMergeTarget(null);
    try {
      const parsed = await aiParseImage(base64, NAMEPLATE_PROMPT);
      if (!parsed) throw new Error("parse failed");
      setPreview({ ...parsed, _photo: dataUrl });
    } catch {
      showToast("⚠️ Couldn't read nameplate — try better lighting or angle");
    }
    setScanning(false);
  }, [showToast]);

  // ── CONFIRM NEW MACHINE ──
  const confirmNew = (formData) => {
    const m = { ...parsedToMachine(preview), ...formData, id: Date.now() };
    setMachines(p => [m, ...p]);
    setSessionLog(s => [{ action:"created", name:m.name, ts:new Date().toISOString() }, ...s]);
    setPreview(null); setDecision(null);
    showToast(`✅ "${m.name}" created`);
  };

  // ── CONFIRM MERGE INTO EXISTING ──
  const confirmMerge = (targetId) => {
    const target = machines.find(m => m.id === targetId);
    if (!target) return;
    const merged = mergeIntoMachine(target, preview);
    setMachines(p => p.map(m => m.id === targetId ? merged : m));
    setSessionLog(s => [{ action:"updated", name:target.name, ts:new Date().toISOString() }, ...s]);
    setPreview(null); setDecision(null); setMergeTarget(null);
    showToast(`✅ Photo & data added to "${target.name}"`);
  };

  const cats     = ["All", ...Array.from(new Set(machines.map(m => m.category || "Machine")))];
  const filtered = machines
    .filter(m => filter === "All" || (m.category || "Machine") === filter)
    .filter(m => !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.make?.toLowerCase().includes(search.toLowerCase()) || m.assetTag?.toLowerCase().includes(search.toLowerCase()));

  // ── DECISION SCREEN: what do we do with this scan? ──
  const DecisionScreen = () => (
    <div style={{ background:"rgba(124,58,237,0.07)",border:"2px solid rgba(124,58,237,0.35)",borderRadius:18,padding:20,marginBottom:20 }}>
      {/* Parsed summary */}
      <div style={{ fontWeight:800,color:"#7c3aed",fontSize:15,marginBottom:10 }}>📸 Nameplate Scanned</div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:14 }}>
        {[["Name",preview.suggestedName],["Tag",preview.suggestedId],["Make",preview.make],["Model",preview.model],["Serial",preview.serialNumber],["Voltage",preview.voltage],["HP",preview.horsepower],["RPM",preview.rpm],["Phase",preview.phase],["Year",preview.year]].filter(([,v])=>v).map(([k,v])=>(
          <div key={k} style={{ background:"rgba(255,255,255,0.7)",borderRadius:8,padding:"6px 10px" }}>
            <div style={{ color:"#94a3b8",fontSize:9,fontWeight:600 }}>{k}</div>
            <div style={{ color:"#1e1b4b",fontWeight:700,fontSize:12 }}>{v}</div>
          </div>
        ))}
      </div>
      {preview._photo && <img src={preview._photo} alt="nameplate" style={{ width:"100%",maxHeight:100,objectFit:"cover",borderRadius:10,marginBottom:14,opacity:0.85 }} />}

      {/* THE DECISION */}
      {!decision && (
        <>
          <div style={{ fontSize:13,color:"#64748b",fontWeight:600,marginBottom:10,textAlign:"center" }}>What do you want to do with this?</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <button onClick={()=>setDecision("new")} style={{ padding:"16px 10px",background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",lineHeight:1.4 }}>
              ➕ Create New Asset
              <div style={{ fontSize:10,fontWeight:400,opacity:0.85,marginTop:4 }}>Add this as a brand new machine</div>
            </button>
            <button onClick={()=>setDecision("existing")} style={{ padding:"16px 10px",background:"rgba(56,189,248,0.12)",border:"2px solid rgba(56,189,248,0.4)",borderRadius:14,color:"#0ea5e9",fontWeight:800,fontSize:13,cursor:"pointer",lineHeight:1.4 }}>
              🔗 Add to Existing
              <div style={{ fontSize:10,fontWeight:400,opacity:0.85,marginTop:4 }}>Attach photo/data to a machine already in your DB</div>
            </button>
          </div>
          <button onClick={()=>setPreview(null)} style={{ width:"100%",marginTop:10,padding:"9px 0",background:"transparent",border:"1px solid rgba(148,163,184,0.3)",borderRadius:10,color:"#94a3b8",cursor:"pointer",fontSize:12 }}>Discard</button>
        </>
      )}

      {/* NEW ASSET — inline quick-confirm with name/tag/location editable */}
      {decision === "new" && (
        <NewAssetForm preview={preview} onConfirm={confirmNew} onBack={()=>setDecision(null)} />
      )}

      {/* ADD TO EXISTING — pick from list */}
      {decision === "existing" && (
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
            <button onClick={()=>setDecision(null)} style={{ background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontSize:13,fontWeight:600 }}>← Back</button>
            <span style={{ fontSize:13,color:"#64748b" }}>Pick the machine to update:</span>
          </div>
          <div style={{ maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:8 }}>
            {machines.length === 0 && <div style={{ color:"#94a3b8",fontSize:13,padding:12 }}>No machines in DB yet — create a new one first.</div>}
            {machines.map(m=>(
              <button key={m.id} onClick={()=>confirmMerge(m.id)} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(255,255,255,0.7)",border:"1.5px solid rgba(124,58,237,0.15)",borderRadius:12,cursor:"pointer",textAlign:"left",width:"100%" }}>
                {m.photos?.[0] && <img src={m.photos[0].url} alt="" style={{ width:40,height:40,objectFit:"cover",borderRadius:8,flexShrink:0 }} />}
                <div>
                  <div style={{ fontWeight:700,fontSize:13,color:"#1e1b4b" }}>{m.name}</div>
                  <div style={{ fontSize:11,color:"#94a3b8" }}>{m.assetTag} · {m.make} {m.model}</div>
                  {m.location && <div style={{ fontSize:10,color:"#94a3b8" }}>📍 {m.location}</div>}
                </div>
                <div style={{ marginLeft:"auto",color:"#7c3aed",fontSize:13 }}>→</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {editM && (
        <EditModal item={editM} fields={MACHINE_EDIT_FIELDS} title={`Edit: ${editM.name}`}
          onSave={updated=>{ setMachines(p=>p.map(m=>m.id===updated.id?{...m,...updated}:m)); setEditM(null); showToast("✅ Machine updated"); }}
          onClose={()=>setEditM(null)} />
      )}

      {/* SESSION MODE BANNER */}
      {sessionMode && (
        <div style={{ background:"linear-gradient(135deg,rgba(124,58,237,0.12),rgba(168,85,247,0.08))",border:"1.5px solid rgba(124,58,237,0.3)",borderRadius:14,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
          <div>
            <span style={{ fontWeight:800,color:"#7c3aed",fontSize:14 }}>🏃 Scan Session Active</span>
            <span style={{ color:"#94a3b8",fontSize:12,marginLeft:10 }}>{sessionLog.length} scanned this session</span>
            {sessionLog.slice(0,3).map((l,i)=>(
              <div key={i} style={{ fontSize:11,color:"#64748b",marginTop:2 }}>{l.action==="created"?"➕":"🔗"} {l.name}</div>
            ))}
          </div>
          <button onClick={()=>{ setSessionMode(false); setSessionLog([]); }} style={{ padding:"7px 14px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,color:"#f87171",fontSize:12,cursor:"pointer" }}>End Session</button>
        </div>
      )}

      {/* SCAN + SESSION CONTROLS */}
      <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
        <PhotoCapture onCapture={handleScan} label={scanning?"⏳ Reading...":"📸 Scan Nameplate"} loading={scanning} />
        {!sessionMode && (
          <button onClick={()=>setSessionMode(true)} style={{ padding:"12px 18px",background:"rgba(255,255,255,0.7)",border:"1.5px solid rgba(124,58,237,0.2)",borderRadius:12,color:"#7c3aed",fontWeight:700,fontSize:13,cursor:"pointer" }}>
            🏃 Start Scan Session
          </button>
        )}
        {sessionMode && (
          <PhotoCapture onCapture={handleScan} label="📸 Next Plate" loading={scanning} />
        )}
        <div style={{ fontSize:12,color:"#94a3b8",alignSelf:"center",flex:1,minWidth:120 }}>
          {machines.length} machine{machines.length!==1?"s":""} in database
        </div>
      </div>

      {/* DECISION SCREEN */}
      {preview && <DecisionScreen />}

      {/* SEARCH + FILTER */}
      {machines.length > 0 && !preview && (
        <>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search machines, makes, tags..."
            style={{ ...S.inp,marginBottom:12,fontSize:13 }} />
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:16 }}>
            {cats.map(c=>(
              <button key={c} onClick={()=>setFilter(c)} style={{ padding:"6px 14px",borderRadius:20,border:`1px solid ${filter===c?"#7c3aed":"rgba(124,58,237,0.15)"}`,background:filter===c?"rgba(124,58,237,0.1)":"rgba(255,255,255,0.6)",color:filter===c?"#7c3aed":"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>{c}</button>
            ))}
          </div>
        </>
      )}

      {/* MACHINE GRID */}
      {!preview && (filtered.length === 0 ? (
        <div style={{ textAlign:"center",padding:"60px 20px",color:"#94a3b8" }}>
          <div style={{ fontSize:48,marginBottom:12 }}>🏭</div>
          <div style={{ fontWeight:800,fontSize:17,color:"#1e1b4b",marginBottom:6 }}>
            {machines.length === 0 ? "Machine Database is Empty" : "No results"}
          </div>
          <div style={{ fontSize:13 }}>
            {machines.length === 0 ? "Tap \"Scan Nameplate\" or \"Start Scan Session\" to build your database" : "Try a different search or filter"}
          </div>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14 }}>
          {filtered.map(m=>(
            <MachineCard key={m.id} machine={m}
              onEdit={()=>setEditM(m)}
              onDelete={()=>{ setMachines(p=>p.filter(x=>x.id!==m.id)); showToast("🗑 Machine removed"); }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── QUICK NEW ASSET FORM (inline in decision screen) ──
function NewAssetForm({ preview, onConfirm, onBack }) {
  const [form, setForm] = useState({
    name:     preview.suggestedName || "",
    assetTag: preview.suggestedId   || "",
    location: "",
    category: preview.category      || "Machine",
    pmIntervalDays: preview.pmIntervalDays || "",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div style={{ marginTop:14 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontSize:13,fontWeight:600 }}>← Back</button>
        <span style={{ fontWeight:700,color:"#1e1b4b",fontSize:14 }}>New Asset Details</span>
      </div>
      {[
        { k:"name",     l:"Machine Name *", ph:"e.g. CNC Mill-01" },
        { k:"assetTag", l:"Asset Tag",      ph:"e.g. MILL-01" },
        { k:"location", l:"Location",       ph:"e.g. Main Building Bay 3" },
      ].map(({k,l,ph})=>(
        <div key={k} style={{ marginBottom:10 }}>
          <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4,fontWeight:600 }}>{l}</div>
          <input value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} style={S.inp} />
        </div>
      ))}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
        <div>
          <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4,fontWeight:600 }}>Category</div>
          <select value={form.category} onChange={e=>set("category",e.target.value)} style={S.inp}>
            {["Machine","Equipment","Electrical","Asset","Safety","Filter"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4,fontWeight:600 }}>PM Interval (days)</div>
          <input type="number" value={form.pmIntervalDays} onChange={e=>set("pmIntervalDays",e.target.value)} placeholder="e.g. 90" style={S.inp} />
        </div>
      </div>
      <div style={{ display:"flex",gap:8,marginTop:4 }}>
        <button onClick={()=>onConfirm(form)} disabled={!form.name.trim()} style={{ flex:1,padding:"12px 0",background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:form.name.trim()?"pointer":"not-allowed",opacity:form.name.trim()?1:0.5 }}>
          ✅ Create Asset
        </button>
      </div>
    </div>
  );
}

function MachineCard({ machine: m, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const photos = m.photos || (m.photo ? [{ url: m.photo, label: "Nameplate" }] : []);
  return (
    <div style={{ background:"rgba(255,255,255,0.65)",border:"1.5px solid rgba(168,85,247,0.2)",borderRadius:20,padding:18,backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",boxShadow:"0 4px 24px rgba(168,85,247,0.08), inset 0 1px 0 rgba(255,255,255,0.9)" }}>
      {/* Photo strip */}
      {photos.length > 0 && (
        <div style={{ display:"flex",gap:6,marginBottom:12,overflowX:"auto" }}>
          {photos.map((p,i)=>(
            <div key={i} style={{ position:"relative",flexShrink:0 }}>
              <img src={p.url} alt={p.label||"nameplate"} style={{ width:photos.length===1?"100%":72,height:72,objectFit:"cover",borderRadius:8,opacity:0.88 }} />
              {photos.length > 1 && <div style={{ position:"absolute",bottom:2,left:2,background:"rgba(0,0,0,0.55)",color:"#fff",fontSize:8,padding:"1px 4px",borderRadius:4 }}>{p.label||`Photo ${i+1}`}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6 }}>
        <div>
          <div style={{ fontWeight:800,fontSize:15,color:"#1e1b4b" }}>{m.name}</div>
          <div style={{ fontSize:11,color:"#a855f7",fontWeight:600,marginTop:1 }}>{m.assetTag}</div>
        </div>
        <Badge label={m.category||"Machine"} color={CAT_COLOR[m.category]||"#a855f7"} />
      </div>
      {m.location && <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>📍 {m.location}</div>}
      <div style={{ fontSize:12,color:"#64748b",marginBottom:8 }}>{[m.make,m.model].filter(Boolean).join(" ") || "—"}</div>

      {expanded && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:10 }}>
          {[
            ["Serial #",  m.serialNumber],["Part #",   m.partNumber],
            ["Voltage",   m.voltage],     ["Amperage", m.amperage],
            ["HP",        m.horsepower],  ["RPM",      m.rpm],
            ["Phase",     m.phase],       ["Hz",       m.hz],
            ["Year",      m.year],        ["Weight",   m.weight],
            ["PM Every",  m.pmIntervalDays?`${m.pmIntervalDays}d`:null],
            ["Photos",    photos.length>0?`${photos.length} on file`:null],
          ].filter(([,v])=>v).map(([k,v])=>(
            <div key={k} style={{ background:"rgba(124,58,237,0.04)",borderRadius:8,padding:"6px 10px" }}>
              <div style={{ color:"#94a3b8",fontSize:9 }}>{k}</div>
              <div style={{ color:"#1e1b4b",fontWeight:600,fontSize:12 }}>{v}</div>
            </div>
          ))}
          {m.description && <div style={{ gridColumn:"1/-1",background:"rgba(124,58,237,0.04)",borderRadius:8,padding:"8px 10px" }}><div style={{ color:"#94a3b8",fontSize:9,marginBottom:2 }}>Notes</div><div style={{ color:"#1e1b4b",fontSize:12 }}>{m.description}</div></div>}
        </div>
      )}

      <div style={{ display:"flex",gap:6,marginTop:8 }}>
        <button onClick={()=>setExpanded(e=>!e)} style={S.cGhost}>{expanded?"▲ Less":"▼ Details"}</button>
        <button onClick={onEdit} style={{ ...S.cGhost,color:"#7c3aed" }}>✏️ Edit</button>
        <button onClick={onDelete} style={{ ...S.cGhost,color:"#f87171",borderColor:"#f8717130" }}>✕</button>
      </div>
    </div>
  );
}

// ─── GAUGE LOG TAB ───────────────────────────────────────────────────────────
function GaugeLog({ gaugeLogs, setGaugeLogs, assets, showToast }) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview]   = useState(null);
  const [editLog, setEditLog]   = useState(null);

  const handleScan = useCallback(async (base64, dataUrl) => {
    setScanning(true);
    try {
      const parsed = await aiParseImage(base64, GAUGE_PROMPT);
      if (!parsed) throw new Error();
      setPreview({ ...parsed, _photo: dataUrl, _ts: new Date().toISOString() });
    } catch {
      showToast("⚠️ Couldn't parse display — try manual entry");
    }
    setScanning(false);
  }, [showToast]);

  const confirmLog = () => {
    if (!preview) return;
    const entry = {
      id: Date.now(), assetId: 11,
      timestamp: preview._ts,
      pressure: preview.pressure, temp: preview.temp,
      runHours: preview.runHours, loadHours: preview.loadHours,
      maintenanceIn: preview.maintenanceIn,
      status: preview.status || "On Load",
      keyMode: preview.keyMode || "",
      notes: "", photo: preview._photo, source: "photo"
    };
    setGaugeLogs(p=>[entry,...p]);
    sheetsPost("logGauge", { ...entry, assetName: assets.find(a=>a.id===entry.assetId)?.name || "" });
    setPreview(null);
    showToast("✅ Gauge reading logged");
  };

  const logFields = [
    { key:"timestamp", label:"Date/Time", type:"datetime-local" },
    { key:"pressure", label:"Pressure (psi)", type:"number" },
    { key:"temp", label:"Temperature (°F)", type:"number" },
    { key:"runHours", label:"Run Hours", type:"number" },
    { key:"loadHours", label:"Load Hours", type:"number" },
    { key:"maintenanceIn", label:"Maintenance In (h)", type:"number" },
    { key:"status", label:"Status", type:"select", options:["On Load","Off Load","Standby","Idle","Fault"] },
    { key:"keyMode", label:"Key Mode" },
    { key:"notes", label:"Notes", type:"textarea" },
  ];

  const latest = gaugeLogs[0];

  return (
    <div>
      {editLog && (
        <EditModal item={editLog} fields={logFields} title="Edit Gauge Reading"
          onSave={updated=>{ setGaugeLogs(p=>p.map(l=>l.id===updated.id?updated:l)); setEditLog(null); showToast("✅ Reading updated"); }}
          onClose={()=>setEditLog(null)} />
      )}

      {/* STAT STRIP */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20 }}>
        {[
          { label:"Latest PSI",   value:latest?.pressure?`${latest.pressure} psi`:"—", alert:latest?.pressure>120 },
          { label:"Latest Temp",  value:latest?.temp?`${latest.temp}°F`:"—",            alert:latest?.temp>180 },
          { label:"Maint. In",    value:latest?.maintenanceIn?`${latest.maintenanceIn}h`:"—", alert:latest?.maintenanceIn<200 },
        ].map(s=>(
          <div key={s.label} style={{ background:s.alert?"rgba(248,113,113,0.08)":"rgba(255,255,255,0.6)",border:`1.5px solid ${s.alert?"rgba(248,113,113,0.3)":"rgba(124,58,237,0.1)"}`,borderRadius:14,padding:"12px 14px",backdropFilter:"blur(16px)" }}>
            <div style={{ color:"#94a3b8",fontSize:10,marginBottom:3 }}>{s.label}</div>
            <div style={{ color:s.alert?"#f87171":"#7c3aed",fontWeight:800,fontSize:18 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* CONTROLS */}
      <div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap" }}>
        <PhotoCapture onCapture={handleScan} label="📸 Scan Gauge Display" loading={scanning} />
        <button onClick={()=>setEditLog({ id:Date.now(),assetId:11,timestamp:new Date().toISOString().slice(0,16),pressure:"",temp:"",runHours:"",loadHours:"",maintenanceIn:"",status:"On Load",keyMode:"",notes:"",photo:null,source:"manual" })} style={{ padding:"12px 20px",background:"rgba(255,255,255,0.7)",border:"1.5px solid rgba(124,58,237,0.2)",borderRadius:12,color:"#7c3aed",fontWeight:700,fontSize:13,cursor:"pointer" }}>
          ✍️ Manual Entry
        </button>
      </div>

      {/* PREVIEW */}
      {preview && (
        <div style={{ background:"rgba(124,58,237,0.08)",border:"2px solid rgba(124,58,237,0.35)",borderRadius:16,padding:18,marginBottom:20 }}>
          <div style={{ fontWeight:800,color:"#7c3aed",marginBottom:10 }}>⚡ Parsed — Review & Confirm</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12 }}>
            {[["Pressure",`${preview.pressure} psi`],["Temp",`${preview.temp}°F`],["Status",preview.status],["Run Hrs",`${preview.runHours?.toLocaleString()}h`],["Load Hrs",`${preview.loadHours?.toLocaleString()}h`],["Maint In",`${preview.maintenanceIn}h`]].map(([k,v])=>(
              <div key={k} style={{ background:"rgba(255,255,255,0.5)",borderRadius:8,padding:"8px 10px" }}>
                <div style={{ color:"#94a3b8",fontSize:9 }}>{k}</div>
                <div style={{ color:"#1e1b4b",fontWeight:700,fontSize:13 }}>{v||"—"}</div>
              </div>
            ))}
          </div>
          {preview._photo && <img src={preview._photo} alt="gauge" style={{ width:"100%",maxHeight:100,objectFit:"cover",borderRadius:8,marginBottom:12,opacity:0.85 }} />}
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={confirmLog} style={{ flex:1,background:"#10b981",border:"none",borderRadius:10,color:"#fff",padding:"10px 0",fontWeight:700,cursor:"pointer" }}>✅ Log It</button>
            <button onClick={()=>{ const e={...preview,id:Date.now(),assetId:11,timestamp:preview._ts,photo:preview._photo,source:"photo",notes:""}; setEditLog(e); setPreview(null); }} style={{ flex:1,background:"rgba(124,58,237,0.15)",border:"1px solid #7c3aed",borderRadius:10,color:"#7c3aed",padding:"10px 0",cursor:"pointer" }}>✏️ Edit</button>
            <button onClick={()=>setPreview(null)} style={{ background:"rgba(248,113,113,0.1)",border:"1px solid #f87171",borderRadius:10,color:"#f87171",padding:"10px 14px",cursor:"pointer" }}>✕</button>
          </div>
        </div>
      )}

      {/* LOG LIST */}
      <div style={{ fontSize:11,color:"#94a3b8",marginBottom:12 }}>{gaugeLogs.length} reading{gaugeLogs.length!==1?"s":""} logged · Kaeser Compressor-01</div>
      {gaugeLogs.map(log=>(
        <div key={log.id} style={{ background:"rgba(255,255,255,0.65)",border:"1.5px solid rgba(124,58,237,0.1)",borderRadius:16,padding:16,marginBottom:10,backdropFilter:"blur(20px)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
            <div>
              <div style={{ fontWeight:700,fontSize:13,color:"#1e1b4b" }}>{fmtDT(log.timestamp)}</div>
              <div style={{ display:"flex",gap:6,marginTop:4 }}>
                <Badge label={log.source||"manual"} />
                {log.status && <Badge label={log.status} color="#7c3aed" />}
              </div>
            </div>
            <div style={{ display:"flex",gap:6 }}>
              <button onClick={()=>setEditLog(log)} style={{ padding:"4px 10px",background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:6,color:"#7c3aed",fontSize:11,cursor:"pointer" }}>✏️ Edit</button>
              <button onClick={()=>{ setGaugeLogs(p=>p.filter(x=>x.id!==log.id)); showToast("🗑 Log removed"); }} style={{ padding:"4px 10px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:6,color:"#f87171",fontSize:11,cursor:"pointer" }}>🗑</button>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
            {[
              { k:"Pressure", v:log.pressure?`${log.pressure} psi`:null, alert:log.pressure>120 },
              { k:"Temp",     v:log.temp?`${log.temp}°F`:null,           alert:log.temp>180 },
              { k:"Run Hrs",  v:log.runHours?`${Number(log.runHours).toLocaleString()}h`:null },
              { k:"Load Hrs", v:log.loadHours?`${Number(log.loadHours).toLocaleString()}h`:null },
              { k:"Maint In", v:log.maintenanceIn?`${log.maintenanceIn}h`:null, alert:log.maintenanceIn<200 },
              { k:"Key Mode", v:log.keyMode||null },
            ].filter(x=>x.v).map(x=>(
              <div key={x.k} style={{ background:x.alert?"rgba(248,113,113,0.08)":"rgba(124,58,237,0.04)",border:`1px solid ${x.alert?"rgba(248,113,113,0.25)":"rgba(124,58,237,0.1)"}`,borderRadius:8,padding:"7px 10px" }}>
                <div style={{ color:"#94a3b8",fontSize:9 }}>{x.k}</div>
                <div style={{ color:x.alert?"#f87171":"#1e1b4b",fontWeight:700,fontSize:13 }}>{x.v}</div>
              </div>
            ))}
          </div>
          {log.notes && <div style={{ marginTop:8,fontSize:12,color:"#64748b" }}>📝 {log.notes}</div>}
          {log.photo && <img src={log.photo} alt="gauge" style={{ width:"100%",maxHeight:100,objectFit:"cover",borderRadius:8,marginTop:10,opacity:0.8 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── REPAIR MODAL ────────────────────────────────────────────────────────────
function RepairModal({ assets, setAssets, setLogs, showToast, onClose }) {
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState(null);  // existing asset
  const [newMode,     setNewMode]     = useState(false); // creating new asset
  const [note,        setNote]        = useState("");
  const [date,        setDate]        = useState(TODAY);
  const [newAsset,    setNewAsset]    = useState({ name:"", location:"", category:"Equipment", detail:"", intervalDays:90, pmEnabled:true });

  const filtered = search.trim().length > 1
    ? assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.location.toLowerCase().includes(search.toLowerCase()))
    : [];

  function handleSelectAsset(a) {
    setSelected(a);
    setSearch(a.name);
    setNewMode(false);
  }

  function handleNewMode() {
    setNewMode(true);
    setSelected(null);
    setNewAsset(p => ({ ...p, name: search.trim() }));
  }

  function save() {
    if (!note.trim()) return;
    let assetId;
    if (newMode) {
      if (!newAsset.name.trim()) return;
      const freshAsset = { ...newAsset, id: Date.now(), intervalDays: newAsset.pmEnabled ? parseInt(newAsset.intervalDays)||90 : null };
      setAssets(p => [...p, freshAsset]);
      assetId = freshAsset.id;
      showToast(`✅ Asset added & repair logged: ${freshAsset.name}`);
    } else if (selected) {
      assetId = selected.id;
      showToast(`✅ Repair logged: ${selected.name}`);
    } else {
      return;
    }
    setLogs(p => [{ id: Date.now()+1, assetId, date, note: "🔧 " + note.trim(), tech:"CB" }, ...p]);
    onClose();
  }

  const canSave = note.trim() && (selected || (newMode && newAsset.name.trim()));

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...S.mLabel, color:"#f87171" }}>🔧 Log a Repair</div>
      <div style={S.mTitle}>What did you fix?</div>

      {/* SEARCH */}
      {!selected && !newMode && (
        <>
          <Lbl>Search asset or type a new one</Lbl>
          <input
            autoFocus
            value={search}
            onChange={e=>{ setSearch(e.target.value); setSelected(null); }}
            placeholder="e.g. Forklift, Tube Laser, Panel..."
            style={S.inp}
          />
          {/* RESULTS */}
          {filtered.length > 0 && (
            <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
              {filtered.map(a => (
                <button key={a.id} onClick={()=>handleSelectAsset(a)} style={{
                  textAlign:"left", padding:"10px 14px", borderRadius:12,
                  border:"1.5px solid rgba(124,58,237,0.2)", background:"rgba(124,58,237,0.05)",
                  cursor:"pointer", fontFamily:"inherit"
                }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{a.name}</span>
                  <span style={{ fontSize:11, color:"#94a3b8", marginLeft:8 }}>{a.location}</span>
                </button>
              ))}
            </div>
          )}
          {/* NEW ASSET PROMPT */}
          {search.trim().length > 1 && (
            <button onClick={handleNewMode} style={{
              marginTop:10, width:"100%", padding:"10px 14px", borderRadius:12,
              border:"1.5px dashed rgba(124,58,237,0.35)", background:"rgba(124,58,237,0.04)",
              color:"#7c3aed", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13
            }}>
              + Add "{search.trim()}" as a new asset
            </button>
          )}
        </>
      )}

      {/* SELECTED EXISTING ASSET */}
      {selected && !newMode && (
        <div style={{ background:"rgba(124,58,237,0.06)", border:"1.5px solid rgba(124,58,237,0.2)", borderRadius:12, padding:"10px 14px", marginBottom:4, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#1e1b4b" }}>{selected.name}</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>{selected.location} · {selected.category}</div>
          </div>
          <button onClick={()=>{ setSelected(null); setSearch(""); }} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
      )}

      {/* NEW ASSET FORM */}
      {newMode && (
        <div style={{ background:"rgba(124,58,237,0.04)", border:"1.5px solid rgba(124,58,237,0.18)", borderRadius:14, padding:14, marginBottom:4 }}>
          <div style={{ fontSize:11, color:"#7c3aed", fontWeight:700, letterSpacing:1, marginBottom:10 }}>NEW ASSET</div>
          <Lbl>Name *</Lbl>
          <input value={newAsset.name} onChange={e=>setNewAsset(p=>({...p,name:e.target.value}))} placeholder="e.g. Forklift #2" style={S.inp} />
          <Lbl>Location</Lbl>
          <input value={newAsset.location} onChange={e=>setNewAsset(p=>({...p,location:e.target.value}))} placeholder="e.g. Warehouse, Shop Floor" style={S.inp} />
          <Lbl>Category</Lbl>
          <select value={newAsset.category} onChange={e=>setNewAsset(p=>({...p,category:e.target.value}))} style={S.inp}>
            {["Equipment","Filter","Electrical","Asset","Safety","Machine"].map(c=><option key={c}>{c}</option>)}
          </select>
          <Lbl>Detail / Notes</Lbl>
          <input value={newAsset.detail} onChange={e=>setNewAsset(p=>({...p,detail:e.target.value}))} placeholder="e.g. Directional Valve, 480V, 3-phase" style={S.inp} />
          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:12, marginBottom:4 }}>
            <input type="checkbox" checked={newAsset.pmEnabled} onChange={e=>setNewAsset(p=>({...p,pmEnabled:e.target.checked}))} id="newpm" />
            <label htmlFor="newpm" style={{ fontSize:13, color:"#475569", cursor:"pointer" }}>Add PM schedule</label>
          </div>
          {newAsset.pmEnabled && (
            <>
              <Lbl>PM Interval (days)</Lbl>
              <input type="number" value={newAsset.intervalDays} onChange={e=>setNewAsset(p=>({...p,intervalDays:e.target.value}))} style={S.inp} />
            </>
          )}
          <button onClick={()=>{ setNewMode(false); setSearch(""); }} style={{ marginTop:10, background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>← Back to search</button>
        </div>
      )}

      {/* REPAIR NOTE — shown once asset is picked/created */}
      {(selected || newMode) && (
        <>
          <Lbl>Repair Notes *</Lbl>
          <textarea
            autoFocus={!!selected}
            value={note}
            onChange={e=>setNote(e.target.value)}
            placeholder="What was wrong, what you did, parts used..."
            style={{ ...S.inp, height:90, resize:"none", marginBottom:4 }}
          />
          <Lbl>Date</Lbl>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.inp} />
        </>
      )}

      <div style={S.mRow}>
        <button onClick={onClose} style={S.btnG}>Cancel</button>
        <button onClick={save} disabled={!canSave} style={{ ...S.btnP, opacity: canSave ? 1 : 0.4 }}>
          {newMode ? "Add Asset + Log Repair" : "Log Repair"}
        </button>
      </div>
    </Overlay>
  );
}


// ─── FACILITY MAP TAB ────────────────────────────────────────────────────────
const LOCATION_GROUPS = [
  "Upstairs", "Roof North", "Roof South", "Roof East", "Roof West",
  "Mech Room A", "Mech Room B", "Compressor Room", "Welding Shop",
  "Warehouse", "Basement", "Break Room", "Maintenance", "Back Maintenance", "TBD"
];

function FacilityMap({ assets, logs, onLog, onHistory, onEdit, showToast }) {
  const [mapImage, setMapImage]       = useState(() => { try { return localStorage.getItem("cbv3_mapImage") || null; } catch { return null; } });
  const [zones, setZones]             = useState(() => { try { return JSON.parse(localStorage.getItem("cbv3_mapZones") || "[]"); } catch { return []; } });
  const [mode, setMode]               = useState("view");   // view | placePin | drawRect | nameZone
  const [pendingZone, setPending]     = useState(null);     // zone being named
  const [selectedZone, setSelected]   = useState(null);     // zone whose dashboard is open
  const [rectStart, setRectStart]     = useState(null);     // for rect drawing
  const [drawing, setDrawing]         = useState(null);     // live rect preview
  const [editingZone, setEditingZone] = useState(null);     // zone being repositioned
  const imgRef = useRef();

  useEffect(() => { try { localStorage.setItem("cbv3_mapZones", JSON.stringify(zones)); } catch {} }, [zones]);
  useEffect(() => { try { if (mapImage) localStorage.setItem("cbv3_mapImage", mapImage); } catch {} }, [mapImage]);

  // ── UPLOAD MAP IMAGE ──
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setMapImage(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── GET RELATIVE COORDS FROM CLICK ──
  const getRelCoords = (e) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    };
  };

  // ── HANDLE MAP CLICK ──
  const handleMapClick = (e) => {
    if (!mapImage) return;
    const coords = getRelCoords(e);
    if (!coords) return;

    if (mode === "placePin") {
      setPending({ type: "pin", x: coords.x, y: coords.y, name: "", locations: [] });
      setMode("nameZone");
    } else if (mode === "view") {
      // Check if clicked on a zone
      const hit = zones.find(z => {
        if (z.type === "pin") {
          return Math.hypot(coords.x - z.x, coords.y - z.y) < 4;
        } else {
          return coords.x >= z.x && coords.x <= z.x + z.w &&
                 coords.y >= z.y && coords.y <= z.y + z.h;
        }
      });
      if (hit) setSelected(hit);
      else setSelected(null);
    }
  };

  // ── RECT DRAW HANDLERS ──
  const handleMouseDown = (e) => {
    if (mode !== "drawRect") return;
    const coords = getRelCoords(e);
    if (!coords) return;
    setRectStart(coords);
    setDrawing(null);
  };

  const handleMouseMove = (e) => {
    if (mode !== "drawRect" || !rectStart) return;
    const coords = getRelCoords(e);
    if (!coords) return;
    setDrawing({
      x: Math.min(rectStart.x, coords.x),
      y: Math.min(rectStart.y, coords.y),
      w: Math.abs(coords.x - rectStart.x),
      h: Math.abs(coords.y - rectStart.y),
    });
  };

  const handleMouseUp = (e) => {
    if (mode !== "drawRect" || !rectStart) return;
    const coords = getRelCoords(e);
    if (!coords) return;
    const rect = {
      x: Math.min(rectStart.x, coords.x),
      y: Math.min(rectStart.y, coords.y),
      w: Math.abs(coords.x - rectStart.x),
      h: Math.abs(coords.y - rectStart.y),
    };
    if (rect.w < 2 || rect.h < 2) { setRectStart(null); setDrawing(null); return; }
    setPending({ type: "rect", ...rect, name: "", locations: [] });
    setRectStart(null);
    setDrawing(null);
    setMode("nameZone");
  };

  // ── SAVE ZONE ──
  const saveZone = (name, locations) => {
    if (!name.trim()) return;
    const newZone = { ...pendingZone, id: Date.now(), name: name.trim(), locations };
    setZones(p => [...p, newZone]);
    setPending(null);
    setMode("view");
    showToast(`✅ Zone "${name}" added`);
  };

  const deleteZone = (id) => {
    setZones(p => p.filter(z => z.id !== id));
    setSelected(null);
    showToast("🗑 Zone removed");
  };

  // ── GET ASSETS FOR ZONE ──
  const zoneAssets = (zone) => {
    if (!zone?.locations?.length) return [];
    return assets.filter(a => zone.locations.includes(a.location));
  };

  // ── GET PM STATUS ──
  const getPMStatus = (asset) => {
    const al = logs.filter(l => l.assetId === asset.id);
    if (!asset.pmEnabled) return "ok";
    if (!al.length) return "overdue";
    const last = al.sort((a,b) => new Date(b.date)-new Date(a.date))[0];
    const next = new Date(last.date);
    next.setDate(next.getDate() + asset.intervalDays);
    const diff = Math.round((next - new Date()) / 86400000);
    if (diff < 0) return "overdue";
    if (diff <= 7) return "soon";
    return "ok";
  };

  const statusColor = { overdue: "#f87171", soon: "#f59e0b", ok: "#10b981" };
  const statusLabel = { overdue: "Overdue", soon: "Due Soon", ok: "OK" };

  const fileRef = useRef();

  // ─── ZONE NAME MODAL ───
  if (mode === "nameZone" && pendingZone) {
    return <ZoneNameModal
      pending={pendingZone}
      allLocations={LOCATION_GROUPS}
      onSave={saveZone}
      onCancel={() => { setPending(null); setMode("view"); }}
    />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* TOOLBAR */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} style={{ padding: "10px 18px", borderRadius: 12, border: "1.5px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.08)", color: "#7c3aed", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          📸 {mapImage ? "Replace Map" : "Upload Aerial Photo"}
        </button>
        {mapImage && (<>
          <button onClick={() => setMode(mode === "placePin" ? "view" : "placePin")}
            style={{ padding: "10px 16px", borderRadius: 12, border: `1.5px solid ${mode==="placePin" ? "#7c3aed" : "rgba(124,58,237,0.2)"}`, background: mode==="placePin" ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.7)", color: mode==="placePin" ? "#7c3aed" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            📍 {mode === "placePin" ? "Tap map to pin..." : "Place Pin"}
          </button>
          <button onClick={() => { setMode(mode === "drawRect" ? "view" : "drawRect"); setRectStart(null); setDrawing(null); }}
            style={{ padding: "10px 16px", borderRadius: 12, border: `1.5px solid ${mode==="drawRect" ? "#f59e0b" : "rgba(124,58,237,0.2)"}`, background: mode==="drawRect" ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.7)", color: mode==="drawRect" ? "#f59e0b" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ▭ {mode === "drawRect" ? "Drag on map..." : "Draw Zone"}
          </button>
          {zones.length > 0 && (
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>{zones.length} zone{zones.length!==1?"s":""} placed</span>
          )}
        </>)}
      </div>

      {/* MODE HINT */}
      {mode !== "view" && (
        <div style={{ padding: "10px 16px", background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12, fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>
          {mode === "placePin" && "👆 Tap anywhere on the map to drop a pin"}
          {mode === "drawRect" && "↖️ Click and drag on the map to draw a building zone"}
        </div>
      )}

      {/* MAP AREA */}
      {!mapImage ? (
        <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed rgba(124,58,237,0.3)", borderRadius: 20, padding: "60px 20px", textAlign: "center", cursor: "pointer", background: "rgba(124,58,237,0.03)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#1e1b4b", marginBottom: 6 }}>Upload Your Facility Map</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Tap here to upload an aerial photo or floor plan</div>
        </div>
      ) : (
        <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: "1.5px solid rgba(124,58,237,0.15)", boxShadow: "0 8px 32px rgba(124,58,237,0.1)", cursor: mode === "placePin" ? "crosshair" : mode === "drawRect" ? "crosshair" : "default", userSelect: "none" }}
          onClick={handleMapClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <img ref={imgRef} src={mapImage} alt="facility" style={{ width: "100%", display: "block", pointerEvents: "none" }} />

          {/* LIVE RECT PREVIEW */}
          {drawing && (
            <div style={{ position: "absolute", left: `${drawing.x}%`, top: `${drawing.y}%`, width: `${drawing.w}%`, height: `${drawing.h}%`, border: "2px dashed #f59e0b", background: "rgba(245,158,11,0.12)", pointerEvents: "none" }} />
          )}

          {/* ZONES */}
          {zones.map(zone => {
            const za = zoneAssets(zone);
            const overdue = za.filter(a => getPMStatus(a) === "overdue").length;
            const soon    = za.filter(a => getPMStatus(a) === "soon").length;
            const dotColor = overdue > 0 ? "#f87171" : soon > 0 ? "#f59e0b" : "#10b981";
            const isSelected = selectedZone?.id === zone.id;

            if (zone.type === "pin") return (
              <div key={zone.id} onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : zone); }}
                style={{ position: "absolute", left: `${zone.x}%`, top: `${zone.y}%`, transform: "translate(-50%,-100%)", cursor: "pointer", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ background: isSelected ? "#7c3aed" : "rgba(255,255,255,0.95)", border: `2px solid ${isSelected ? "#7c3aed" : dotColor}`, borderRadius: 10, padding: "4px 10px", fontSize: 11, fontWeight: 800, color: isSelected ? "#fff" : "#1e1b4b", whiteSpace: "nowrap", boxShadow: "0 2px 12px rgba(0,0,0,0.2)", backdropFilter: "blur(8px)" }}>
                  {zone.name}
                  {za.length > 0 && <span style={{ marginLeft: 6, color: isSelected ? "rgba(255,255,255,0.8)" : dotColor }}>({za.length})</span>}
                </div>
                <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `8px solid ${isSelected ? "#7c3aed" : dotColor}` }} />
                {overdue > 0 && <div style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#f87171", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{overdue}</div>}
              </div>
            );

            return (
              <div key={zone.id} onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : zone); }}
                style={{ position: "absolute", left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%`, border: `2px solid ${isSelected ? "#7c3aed" : dotColor}`, background: isSelected ? "rgba(124,58,237,0.15)" : `${dotColor}18`, borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 800, color: "#1e1b4b", backdropFilter: "blur(8px)", textAlign: "center", pointerEvents: "none" }}>
                  {zone.name}
                  {za.length > 0 && <div style={{ fontSize: 10, color: dotColor, fontWeight: 700 }}>{overdue > 0 ? `⚠ ${overdue} overdue` : soon > 0 ? `${soon} due soon` : `✓ ${za.length} OK`}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ZONE MINI DASHBOARD */}
      {selectedZone && (
        <ZoneDashboard
          zone={selectedZone}
          assets={zoneAssets(selectedZone)}
          logs={logs}
          getPMStatus={getPMStatus}
          statusColor={statusColor}
          statusLabel={statusLabel}
          onLog={onLog}
          onHistory={onHistory}
          onEdit={onEdit}
          onDelete={() => deleteZone(selectedZone.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ─── ZONE NAME MODAL ─────────────────────────────────────────────────────────
function ZoneNameModal({ pending, allLocations, onSave, onCancel }) {
  const [name, setName]       = useState("");
  const [selected, setSelected] = useState([]);
  const toggle = (loc) => setSelected(p => p.includes(loc) ? p.filter(x=>x!==loc) : [...p, loc]);
  return (
    <div style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(124,58,237,0.2)", borderRadius: 20, padding: 24, boxShadow: "0 8px 40px rgba(124,58,237,0.15)" }}>
      <div style={{ fontWeight: 800, fontSize: 17, color: "#1e1b4b", marginBottom: 4 }}>
        {pending.type === "pin" ? "📍 Name This Pin" : "▭ Name This Zone"}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Give it a name and link your asset locations to it</div>

      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>ZONE NAME</div>
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. Main Building, North Roof, Compressor Room"
        style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid rgba(124,58,237,0.2)", background: "rgba(124,58,237,0.04)", fontSize: 14, fontFamily: "inherit", color: "#1e1b4b", boxSizing: "border-box", marginBottom: 16 }} />

      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>LINK ASSET LOCATIONS ({selected.length} selected)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }}>
        {allLocations.map(loc => (
          <button key={loc} onClick={() => toggle(loc)} style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${selected.includes(loc) ? "#7c3aed" : "rgba(124,58,237,0.15)"}`, background: selected.includes(loc) ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.7)", color: selected.includes(loc) ? "#7c3aed" : "#64748b", fontSize: 12, fontWeight: selected.includes(loc) ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
            {selected.includes(loc) ? "✓ " : ""}{loc}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", background: "rgba(255,255,255,0.7)", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={() => onSave(name, selected)} disabled={!name.trim()} style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: name.trim() ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(148,163,184,0.3)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          Save Zone
        </button>
      </div>
    </div>
  );
}

// ─── ZONE MINI DASHBOARD ─────────────────────────────────────────────────────
function ZoneDashboard({ zone, assets, logs, getPMStatus, statusColor, statusLabel, onLog, onHistory, onEdit, onDelete, onClose }) {
  const overdue = assets.filter(a => getPMStatus(a) === "overdue");
  const soon    = assets.filter(a => getPMStatus(a) === "soon");
  const ok      = assets.filter(a => getPMStatus(a) === "ok");

  return (
    <div style={{ background: "rgba(255,255,255,0.9)", border: "1.5px solid rgba(124,58,237,0.2)", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 40px rgba(124,58,237,0.12)", backdropFilter: "blur(20px)" }}>
      {/* HEADER */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(124,58,237,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg,rgba(124,58,237,0.06),rgba(168,85,247,0.04))" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#1e1b4b" }}>{zone.name}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{assets.length} asset{assets.length!==1?"s":""} in this zone</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onDelete} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#f87171", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🗑 Remove</button>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
        </div>
      </div>

      {/* STAT ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderBottom: "1px solid rgba(124,58,237,0.08)" }}>
        {[["⚠", overdue.length, "Overdue", "#f87171"], ["⏱", soon.length, "Due Soon", "#f59e0b"], ["✓", ok.length, "OK", "#10b981"]].map(([icon, n, label, color]) => (
          <div key={label} style={{ padding: "14px 0", textAlign: "center", borderRight: label!=="OK" ? "1px solid rgba(124,58,237,0.06)" : "none" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{n}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ASSET LIST */}
      <div style={{ padding: "12px 16px", maxHeight: 320, overflowY: "auto" }}>
        {assets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>No assets linked to this zone yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...assets].sort((a,b) => {
              const o = { overdue:0, soon:1, ok:2 };
              return o[getPMStatus(a)] - o[getPMStatus(b)];
            }).map(asset => {
              const st = getPMStatus(asset);
              const color = statusColor[st];
              return (
                <div key={asset.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(255,255,255,0.7)", border: `1.5px solid ${color}25`, borderLeft: `4px solid ${color}`, borderRadius: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1e1b4b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{asset.name}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{asset.location} · <span style={{ color, fontWeight: 600 }}>{statusLabel[st]}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => onHistory(asset)} style={{ padding: "4px 9px", borderRadius: 7, border: "1px solid rgba(124,58,237,0.2)", background: "rgba(124,58,237,0.06)", color: "#7c3aed", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>History</button>
                    <button onClick={() => onLog(asset)} style={{ padding: "4px 9px", borderRadius: 7, border: "none", background: "rgba(124,58,237,0.12)", color: "#7c3aed", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Log</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [assets,     setAssets]     = useState(() => load("cbv3_assets",     INITIAL_ASSETS));
  const [logs,       setLogs]       = useState(() => load("cbv3_logs",       INITIAL_LOGS));
  const [machines,   setMachines]   = useState(() => load("cbv3_machines",   INITIAL_MACHINES));
  const [gaugeLogs,  setGaugeLogs]  = useState(() => load("cbv3_gaugeLogs",  INITIAL_GAUGE_LOGS));
  const [workEntries, setWorkEntries] = useState(() => load("cbv3_workEntries", []));
  const [tab,        setTab]        = useState("dashboard");
  const [catFilter,  setCat]        = useState("All");
  const [logModal,   setLog]        = useState(null);
  const [pmTaskModal, setPMTask]    = useState(null);
  const [histModal,  setHist]       = useState(null);
  const [addModal,   setAdd]        = useState(false);
  const [editAsset,  setEditAsset]  = useState(null);
  const [logNote,    setNote]       = useState("");
  const [logDate,    setDate]       = useState(TODAY);
  const [toast,      setToast]      = useState(null);
  const [showHidden, setShowHidden] = useState(false);
  const [addForm,    setForm]       = useState({ name:"",location:"",category:"Filter",detail:"",intervalDays:30,pmEnabled:true });
  const [watchItems, setWatchItems]   = useState(() => load("cbv3_watchItems", []));
  const [assetPhotos, setAssetPhotos] = useState(() => load("cbv3_assetPhotos", {}));
  const [watchModal, setWatchModal]   = useState(null); // asset to add to watch list
  const [photoModal, setPhotoModal]   = useState(null); // asset to add photos to

  useEffect(() => { save("cbv3_assets",    assets);    }, [assets]);
  useEffect(() => { save("cbv3_logs",      logs);      }, [logs]);
  useEffect(() => { save("cbv3_machines",  machines);  }, [machines]);
  useEffect(() => { save("cbv3_gaugeLogs", gaugeLogs); }, [gaugeLogs]);
  useEffect(() => { save("cbv3_watchItems",  watchItems);  }, [watchItems]);
  useEffect(() => { save("cbv3_assetPhotos", assetPhotos); }, [assetPhotos]);

  function showToast(m) { setToast(m); setTimeout(()=>setToast(null), 2800); }

  function doLog() {
    const newLog = { id:Date.now(), assetId:logModal.id, date:logDate, note:logNote, tech:"CB" };
    setLogs(p=>[...p, newLog]);
    sheetsPost("logWorkOrder", { ...newLog, assetName: logModal.name });
    showToast(`✓ Logged: ${logModal.name}`);
    setLog(null); setNote(""); setDate(TODAY);
  }

  function doAdd() {
    if (!addForm.name.trim()) return;
    setAssets(p=>[...p,{ ...addForm,id:Date.now(),intervalDays:addForm.pmEnabled?parseInt(addForm.intervalDays)||30:null }]);
    showToast(`✓ Added: ${addForm.name}`);
    setAdd(false);
    setForm({ name:"",location:"",category:"Filter",detail:"",intervalDays:30,pmEnabled:true });
  }

  function dismissAsset(id) { setAssets(p=>p.map(a=>a.id===id?{...a,dismissed:!a.dismissed}:a)); }
  function deleteAsset(id)  { setAssets(p=>p.filter(a=>a.id!==id)); setLogs(p=>p.filter(l=>l.assetId!==id)); showToast("Asset permanently deleted"); }

  const enriched = assets.map(a=>({...a,pm:getPM(a,logs)}));
  const overdue  = enriched.filter(a=>a.pm.label==="Overdue"||a.pm.label==="Never logged");
  const dueSoon  = enriched.filter(a=>a.pm.label==="Due soon");
  const ok       = enriched.filter(a=>a.pm.label==="OK");
  const cats     = ["All",...Array.from(new Set(assets.map(a=>a.category)))];
  const sorted   = [...enriched].sort((a,b)=>{ const o={"Never logged":0,"Overdue":1,"Due soon":2,"OK":3,"Log only":4}; return o[a.pm.label]-o[b.pm.label]; });
  const visibleSorted = showHidden ? sorted : sorted.filter(a=>!a.dismissed);
  const displayed = catFilter==="All" ? visibleSorted : visibleSorted.filter(a=>a.category===catFilter);
  const hiddenCount = enriched.filter(a=>a.dismissed).length;

  const assetEditFields = [
    { key:"name",        label:"Name" },
    { key:"location",    label:"Location" },
    { key:"category",    label:"Category", type:"select", options:["Filter","Equipment","Electrical","Asset","Safety","Machine"] },
    { key:"detail",      label:"Detail / Notes" },
    { key:"pmEnabled",   label:"Has PM Schedule", type:"checkbox", checkLabel:"Enable PM schedule" },
    { key:"intervalDays",label:"PM Interval (days)", type:"number" },
  ];

  const TABS = [
    ["dashboard",  "Dashboard"],
    ["watchlist",  "👁 Watch List"],
    ["map",        "🗺 Facility Map"],
    ["machines",   "🏭 Machines"],
    ["gauge",      "⚡ Gauge Log"],
    ["history",    "PM History"],
    ["worklog",    "📋 Daily Log"],
    ["add",        "+ Add Asset"],
  ];

  return (
    <div style={S.root}>
      <div style={S.bg} />
      <div style={S.blob1} /><div style={S.blob2} /><div style={S.blob3} />

      {toast && <div style={S.toast}>{toast}</div>}

      {/* EDIT ASSET MODAL */}
      {editAsset && (
        <EditModal item={editAsset} fields={assetEditFields} title={`Edit: ${editAsset.name}`}
          onSave={updated=>{ setAssets(p=>p.map(a=>a.id===updated.id?{...updated,intervalDays:updated.pmEnabled?parseInt(updated.intervalDays)||30:null}:a)); setEditAsset(null); showToast("✅ Asset updated"); }}
          onClose={()=>setEditAsset(null)} />
      )}

      {/* PM TASK MODAL */}
      {pmTaskModal && (
        <PMTaskModal
          asset={pmTaskModal}
          onClose={() => setPMTask(null)}
          onLogPM={({ note, photo, photoUrl, checkedCount, totalTasks }) => {
            const newLog = {
              id: Date.now(),
              assetId: pmTaskModal.id,
              date: TODAY,
              note: note || `PM checklist: ${checkedCount}/${totalTasks} tasks completed`,
              tech: "CB",
              photo: photoUrl || null,
            };
            setLogs(p => [newLog, ...p]);
            sheetsPost("logPM", {
              id: newLog.id, assetId: pmTaskModal.id, assetName: pmTaskModal.name,
              date: TODAY, tech: "CB", tasksCompleted: checkedCount,
              totalTasks, note, photoUrl
            });
            showToast(`✅ PM logged for ${pmTaskModal.name}`);
            setPMTask(null);
          }}
        />
      )}

      {/* LOG MODAL */}
      {logModal && (
        <Overlay onClose={()=>setLog(null)}>
          <div style={{ ...S.mLabel,color:CAT_COLOR[logModal.category] }}>{CAT_ICON[logModal.category]} {logModal.category}</div>
          <div style={S.mTitle}>{logModal.name}</div>
          <div style={S.mSub}>{logModal.location} · {logModal.detail}</div>
          <Lbl>Date</Lbl>
          <input type="date" value={logDate} onChange={e=>setDate(e.target.value)} style={S.inp} />
          <Lbl>Notes</Lbl>
          <textarea value={logNote} onChange={e=>setNote(e.target.value)} placeholder="Parts, filter brand, condition..." style={{...S.inp,height:80,resize:"none"}} />
          <div style={S.mRow}>
            <button onClick={()=>setLog(null)} style={S.btnG}>Cancel</button>
            <button onClick={doLog} style={S.btnP}>Save Log</button>
          </div>
        </Overlay>
      )}

      {/* HISTORY MODAL */}
      {histModal && (
        <Overlay onClose={()=>setHist(null)}>
          <div style={{ ...S.mLabel,color:CAT_COLOR[histModal.category] }}>{CAT_ICON[histModal.category]} History</div>
          <div style={S.mTitle}>{histModal.name}</div>
          <div style={{ marginTop:16,maxHeight:320,overflowY:"auto" }}>
            {logs.filter(l=>l.assetId===histModal.id).length===0
              ? <div style={{ color:"#94a3b8",fontSize:13,padding:"12px 0" }}>No logs yet.</div>
              : [...logs.filter(l=>l.assetId===histModal.id)].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(l=>(
                  <div key={l.id} style={S.histRow}>
                    <span style={{ color:"#7c3aed",fontWeight:700 }}>{l.date}</span>
                    <span style={{ color:"#94a3b8",fontSize:12,margin:"0 8px" }}>CB</span>
                    {l.note && <span style={{ color:"#64748b",fontSize:12 }}>{l.note}</span>}
                  </div>
                ))
            }
          </div>
          <button onClick={()=>setHist(null)} style={{ ...S.btnG,width:"100%",marginTop:16 }}>Close</button>
        </Overlay>
      )}

      {/* ADD MODAL */}
      {addModal && (
        <Overlay onClose={()=>setAdd(false)}>
          <div style={S.mTitle}>Add Asset</div>
          <Lbl>Name *</Lbl>
          <input value={addForm.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. RTU-03" style={S.inp} />
          <Lbl>Location</Lbl>
          <input value={addForm.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="e.g. Roof South" style={S.inp} />
          <Lbl>Category</Lbl>
          <select value={addForm.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={S.inp}>
            {["Filter","Equipment","Electrical","Asset","Safety","Machine"].map(c=><option key={c}>{c}</option>)}
          </select>
          <Lbl>Detail</Lbl>
          <input value={addForm.detail} onChange={e=>setForm(p=>({...p,detail:e.target.value}))} placeholder="e.g. 16×20×1" style={S.inp} />
          <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:14 }}>
            <input type="checkbox" checked={addForm.pmEnabled} onChange={e=>setForm(p=>({...p,pmEnabled:e.target.checked}))} id="pmtog" />
            <label htmlFor="pmtog" style={{ fontSize:13,color:"#475569",cursor:"pointer" }}>Has PM schedule</label>
          </div>
          {addForm.pmEnabled && (<><Lbl>Interval (days)</Lbl><input type="number" value={addForm.intervalDays} onChange={e=>setForm(p=>({...p,intervalDays:e.target.value}))} style={S.inp} /></>)}
          <div style={S.mRow}>
            <button onClick={()=>setAdd(false)} style={S.btnG}>Cancel</button>
            <button onClick={doAdd} style={S.btnP}>Add Asset</button>
          </div>
        </Overlay>
      )}

      {/* REPAIR MODAL */}
      {repairModal && (
        <RepairModal
          assets={assets}
          setAssets={setAssets}
          setLogs={setLogs}
          showToast={showToast}
          onClose={()=>setRepairModal(false)}
        />
      )}

      {/* ASSET PHOTO MODAL */}
      {photoModal && (
        <AssetPhotoModal
          asset={photoModal}
          photos={assetPhotos[photoModal.id] || []}
          onAdd={(photo) => {
            setAssetPhotos(prev => ({
              ...prev,
              [photoModal.id]: [...(prev[photoModal.id] || []), photo]
            }));
            showToast(`📷 Photo added to ${photoModal.name}`);
          }}
          onDelete={(idx) => {
            setAssetPhotos(prev => ({
              ...prev,
              [photoModal.id]: (prev[photoModal.id] || []).filter((_,i)=>i!==idx)
            }));
            showToast("🗑 Photo removed");
          }}
          onClose={()=>setPhotoModal(null)}
        />
      )}

      {/* ADD TO WATCH LIST MODAL */}
      {watchModal && (
        <AddWatchModal
          asset={watchModal}
          onConfirm={(item) => {
            setWatchItems(prev => [item, ...prev]);
            showToast(`👁 Added to Watch List`);
            setWatchModal(null);
          }}
          onClose={()=>setWatchModal(null)}
        />
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
            <Pill n={overdue.length}  label="Overdue"  color="#f87171" />
            <Pill n={dueSoon.length}  label="Due Soon" color="#f59e0b" />
            <Pill n={watchItems.filter(w=>!w.resolved).length} label="Watch" color="#f59e0b" onClick={()=>setTab("watchlist")} />
            <Pill n={machines.length} label="Machines" color="#a855f7" />
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          {TABS.map(([k,l])=>(
            <button key={k} onClick={()=>{ if(k==="add") setAdd(true); else setTab(k); }}
              style={{ ...S.navBtn,...(tab===k&&k!=="add"?S.navOn:{}) }}>{l}</button>
          ))}
        </div>
      </nav>

      <main style={S.main}>

        {/* DASHBOARD */}
        {tab==="dashboard" && (
          <>
            {overdue.length>0 && (
              <div style={S.alertBar}>
                <span style={{ color:"#f87171",fontWeight:700,fontSize:13 }}>⚠ {overdue.length} item{overdue.length>1?"s":""} need attention</span>
                {overdue.slice(0,3).map(a=><span key={a.id} style={S.alertChip}>{a.name}</span>)}
                {overdue.length>3 && <span style={S.alertChip}>+{overdue.length-3} more</span>}
              </div>
            )}
            <div style={S.catRow}>
              {cats.map(c=><button key={c} onClick={()=>setCat(c)} style={{...S.catBtn,...(catFilter===c?S.catOn:{})}}>{c!=="All"&&CAT_ICON[c]} {c}</button>)}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <button onClick={()=>setRepairModal(true)} style={{
                padding:"9px 20px", borderRadius:20, border:"1.5px solid rgba(248,113,113,0.4)",
                background:"rgba(248,113,113,0.08)", color:"#f87171", fontSize:13,
                cursor:"pointer", fontFamily:"inherit", fontWeight:700, letterSpacing:0.3
              }}>🔧 Log Repair</button>
              {hiddenCount > 0 && (
                <button onClick={()=>setShowHidden(h=>!h)} style={{ padding:"6px 14px",borderRadius:20,border:"1px solid rgba(245,158,11,0.3)",background: showHidden?"rgba(245,158,11,0.1)":"rgba(255,255,255,0.6)",color:showHidden?"#f59e0b":"#94a3b8",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>
                  {showHidden ? `👁 Hiding ${hiddenCount} shown` : `👁 ${hiddenCount} hidden`}
                </button>
              )}
            </div>
            <div style={S.grid}>
              {displayed.map(a=>(
                <AssetCard key={a.id} asset={a}
                  dismissed={!!a.dismissed}
                  photos={assetPhotos[a.id] || []}
                  onLog={()=>setLog(a)}
                  onPMTask={()=>setPMTask(a)}
                  onHistory={()=>setHist(a)}
                  onEdit={()=>setEditAsset(a)}
                  onDismiss={()=>dismissAsset(a.id)}
                  onDelete={()=>deleteAsset(a.id)}
                  onAddPhoto={()=>setPhotoModal(a)}
                  onAddWatch={()=>setWatchModal(a)} />
              ))}
            </div>
          </>
        )}

        {/* WATCH LIST TAB */}
        {tab==="watchlist" && (
          <WatchList
            watchItems={watchItems}
            setWatchItems={setWatchItems}
            assets={assets}
            showToast={showToast}
          />
        )}

        {/* MACHINES TAB */}
        {tab==="machines" && (
          <MachineDB machines={machines} setMachines={setMachines} showToast={showToast} />
        )}

        {/* GAUGE LOG TAB */}
        {tab==="gauge" && (
          <GaugeLog gaugeLogs={gaugeLogs} setGaugeLogs={setGaugeLogs} assets={assets} showToast={showToast} />
        )}

        {/* DAILY WORK LOG */}
        {tab==="worklog" && (
          <DailyWorkLog workEntries={workEntries} setWorkEntries={setWorkEntries} showToast={showToast} />
        )}

        {/* FACILITY MAP */}
        {tab==="map" && (
          <FacilityMap
            assets={assets}
            logs={logs}
            onLog={a=>setLog(a)}
            onHistory={a=>setHist(a)}
            onEdit={a=>setEditAsset(a)}
            showToast={showToast}
          />
        )}

        {/* PM HISTORY */}
        {tab==="history" && (
          <div style={S.glassPanel}>
            <div style={S.secLabel}>All PM Completions</div>
            {logs.length===0
              ? <div style={{ color:"#94a3b8",fontSize:13 }}>No logs yet.</div>
              : [...logs].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(l=>{
                  const a=assets.find(x=>x.id===l.assetId);
                  return (
                    <div key={l.id} style={S.logRow}>
                      <span style={{ color:"#7c3aed",fontWeight:700,fontSize:12,minWidth:90 }}>{l.date}</span>
                      <span style={{ color:CAT_COLOR[a?.category]||"#94a3b8",fontSize:15 }}>{CAT_ICON[a?.category||"Asset"]}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600,fontSize:13,color:"#1e1b4b" }}>{a?.name||"Unknown"}</div>
                        <div style={{ fontSize:11,color:"#94a3b8" }}>{a?.location}</div>
                        {l.note && <div style={{ fontSize:12,color:"#64748b" }}>{l.note}</div>}
                      </div>
                      <span style={{ fontSize:11,color:"#cbd5e1" }}>CB</span>
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

// ─── ASSET PHOTO MODAL ───────────────────────────────────────────────────────
function AssetPhotoModal({ asset, photos, onAdd, onDelete, onClose }) {
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState(null);

  function handleCapture(base64, dataUrl) {
    setPreview({ url: dataUrl, base64, label: label.trim() || "Photo" });
  }

  function confirmAdd() {
    if (!preview) return;
    onAdd({ url: preview.url, label: preview.label, addedAt: new Date().toISOString() });
    setPreview(null);
    setLabel("");
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize:10,letterSpacing:2,fontWeight:700,textTransform:"uppercase",color:"#a855f7",marginBottom:6 }}>📷 Photos</div>
      <div style={S.mTitle}>{asset.name}</div>
      <div style={{ fontSize:12,color:"#94a3b8",marginBottom:18 }}>{asset.location}</div>

      {/* Existing photos */}
      {photos.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>On File — {photos.length} photo{photos.length!==1?"s":""}</div>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {photos.map((p,i)=>(
              <div key={i} style={{ display:"flex",gap:12,alignItems:"center",background:"rgba(168,85,247,0.05)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:12,padding:"8px 12px" }}>
                <img src={p.url} alt={p.label} style={{ width:56,height:56,objectFit:"cover",borderRadius:8,flexShrink:0 }} />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:13,color:"#1e1b4b" }}>{p.label}</div>
                  <div style={{ fontSize:10,color:"#94a3b8" }}>{new Date(p.addedAt).toLocaleDateString()}</div>
                </div>
                <button onClick={()=>onDelete(i)} style={{ padding:"4px 10px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,color:"#f87171",fontSize:11,cursor:"pointer" }}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new photo */}
      <div style={{ background:"rgba(168,85,247,0.05)",border:"1.5px dashed rgba(168,85,247,0.3)",borderRadius:16,padding:16,marginBottom:12 }}>
        <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:12 }}>Add New Photo</div>
        <input
          value={label}
          onChange={e=>setLabel(e.target.value)}
          placeholder='Label (e.g. "Oil leak — bottom left")'
          style={{ ...S.inp, marginBottom:12, fontSize:13 }}
        />
        {preview ? (
          <div>
            <img src={preview.url} alt="preview" style={{ width:"100%",maxHeight:140,objectFit:"cover",borderRadius:10,marginBottom:10 }} />
            <div style={{ fontSize:12,color:"#7c3aed",fontWeight:600,marginBottom:10 }}>"{preview.label}"</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setPreview(null)} style={S.btnG}>Retake</button>
              <button onClick={confirmAdd} style={S.btnP}>✅ Save Photo</button>
            </div>
          </div>
        ) : (
          <PhotoCapture onCapture={handleCapture} label="📷 Take / Choose Photo" />
        )}
      </div>

      <button onClick={onClose} style={{ ...S.btnG, width:"100%", marginTop:4 }}>Done</button>
    </Overlay>
  );
}

// ─── ADD TO WATCH LIST MODAL ─────────────────────────────────────────────────
const WATCH_PRIORITY = [
  { key:"low",    label:"👀 Keep an Eye On",   color:"#10b981", desc:"Not urgent — note it for slow days" },
  { key:"medium", label:"⚠️ Getting Worse",     color:"#f59e0b", desc:"Trending bad — check soon" },
  { key:"high",   label:"🔴 Needs Fixing Soon", color:"#f87171", desc:"Will fail — schedule before it does" },
];

function AddWatchModal({ asset, onConfirm, onClose }) {
  const [priority, setPriority] = useState("low");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);

  function confirm() {
    if (!note.trim()) return;
    onConfirm({
      id: Date.now(),
      assetId: asset.id,
      assetName: asset.name,
      assetLocation: asset.location,
      assetCategory: asset.category,
      priority,
      note: note.trim(),
      photoUrl,
      addedAt: new Date().toISOString(),
      resolved: false,
    });
  }

  const pObj = WATCH_PRIORITY.find(p=>p.key===priority);

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize:10,letterSpacing:2,fontWeight:700,textTransform:"uppercase",color:"#f59e0b",marginBottom:6 }}>👁 Watch List</div>
      <div style={S.mTitle}>{asset.name}</div>
      <div style={{ fontSize:12,color:"#94a3b8",marginBottom:20 }}>{asset.location} · {asset.category}</div>

      <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>How bad is it?</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:18 }}>
        {WATCH_PRIORITY.map(p=>(
          <button key={p.key} onClick={()=>setPriority(p.key)} style={{
            textAlign:"left", padding:"12px 16px", borderRadius:14,
            background: priority===p.key ? p.color+"18" : "rgba(255,255,255,0.5)",
            border: `2px solid ${priority===p.key ? p.color : "rgba(124,58,237,0.1)"}`,
            cursor:"pointer", fontFamily:"inherit",
          }}>
            <div style={{ fontWeight:700, fontSize:13, color: priority===p.key ? p.color : "#1e1b4b" }}>{p.label}</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>What did you see?</div>
      <textarea
        value={note}
        onChange={e=>setNote(e.target.value)}
        placeholder={`e.g. "Bearing making a faint squeal at startup — not bad yet but worth watching. Check lube next PM."`}
        rows={3}
        style={{ ...S.inp, resize:"none", fontSize:13, marginBottom:14 }}
      />

      {photoUrl
        ? <div style={{ marginBottom:14, position:"relative" }}>
            <img src={photoUrl} alt="watch" style={{ width:"100%",maxHeight:110,objectFit:"cover",borderRadius:10 }} />
            <button onClick={()=>setPhotoUrl(null)} style={{ position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",borderRadius:8,padding:"3px 8px",fontSize:11,cursor:"pointer" }}>✕</button>
          </div>
        : <div style={{ marginBottom:14 }}><PhotoCapture onCapture={(_,url)=>setPhotoUrl(url)} label="📷 Add Photo (optional)" /></div>
      }

      <div style={S.mRow}>
        <button onClick={onClose} style={S.btnG}>Cancel</button>
        <button onClick={confirm} disabled={!note.trim()} style={{ ...S.btnP, opacity:note.trim()?1:0.5 }}>
          👁 Add to Watch List
        </button>
      </div>
    </Overlay>
  );
}

// ─── WATCH LIST TAB ──────────────────────────────────────────────────────────
function WatchList({ watchItems, setWatchItems, assets, showToast }) {
  const [filter, setFilter] = useState("active"); // "active" | "all" | "slow"
  const [expandId, setExpandId] = useState(null);

  const active   = watchItems.filter(w=>!w.resolved);
  const resolved = watchItems.filter(w=>w.resolved);

  const PRIORITY_ORDER = { high:0, medium:1, low:2 };

  const displayed = filter==="slow"
    ? active.filter(w=>w.priority==="low").sort((a,b)=>new Date(b.addedAt)-new Date(a.addedAt))
    : filter==="active"
    ? [...active].sort((a,b)=>PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority])
    : [...watchItems].sort((a,b)=>PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority] || (a.resolved?1:-1));

  function toggleResolve(id) {
    setWatchItems(prev=>prev.map(w=>w.id===id?{...w,resolved:!w.resolved,resolvedAt:w.resolved?null:new Date().toISOString()}:w));
    showToast(watchItems.find(w=>w.id===id)?.resolved ? "↩ Re-opened" : "✅ Marked fixed");
  }

  function deleteItem(id) {
    setWatchItems(prev=>prev.filter(w=>w.id!==id));
    showToast("🗑 Removed");
  }

  const pColor = { low:"#10b981", medium:"#f59e0b", high:"#f87171" };
  const pLabel = { low:"👀 Keep Eye On", medium:"⚠️ Getting Worse", high:"🔴 Fix Soon" };

  return (
    <div>
      {/* Header + Slow Day CTA */}
      <div style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.04))",border:"1.5px solid rgba(245,158,11,0.2)",borderRadius:20,padding:"18px 20px",marginBottom:20 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12 }}>
          <div>
            <div style={{ fontWeight:800,fontSize:18,color:"#1e1b4b" }}>👁 Watch List</div>
            <div style={{ fontSize:12,color:"#94a3b8",marginTop:2 }}>Things you see but aren't broken yet</div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <div style={{ background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:12,padding:"6px 14px",textAlign:"center" }}>
              <div style={{ fontWeight:800,fontSize:18,color:"#f87171" }}>{active.filter(w=>w.priority==="high").length}</div>
              <div style={{ fontSize:9,color:"#f87171",letterSpacing:1,fontWeight:600 }}>FIX SOON</div>
            </div>
            <div style={{ background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"6px 14px",textAlign:"center" }}>
              <div style={{ fontWeight:800,fontSize:18,color:"#f59e0b" }}>{active.filter(w=>w.priority==="medium").length}</div>
              <div style={{ fontSize:9,color:"#f59e0b",letterSpacing:1,fontWeight:600 }}>WATCH</div>
            </div>
            <div style={{ background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:12,padding:"6px 14px",textAlign:"center" }}>
              <div style={{ fontWeight:800,fontSize:18,color:"#10b981" }}>{active.filter(w=>w.priority==="low").length}</div>
              <div style={{ fontSize:9,color:"#10b981",letterSpacing:1,fontWeight:600 }}>EYE ON</div>
            </div>
          </div>
        </div>

        {/* Slow Day Button */}
        <button onClick={()=>setFilter(f=>f==="slow"?"active":"slow")} style={{
          marginTop:14, width:"100%", padding:"13px 0",
          background: filter==="slow" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.7)",
          border: `2px solid ${filter==="slow" ? "#10b981" : "rgba(245,158,11,0.25)"}`,
          borderRadius:14, cursor:"pointer", fontFamily:"inherit",
          color: filter==="slow" ? "#10b981" : "#f59e0b",
          fontWeight:800, fontSize:14, transition:"all 0.2s",
        }}>
          {filter==="slow" ? "✅ Showing Slow Day Tasks" : "🛋️ Slow Day? Show Me What To Tackle"}
        </button>
        {filter==="slow" && active.filter(w=>w.priority==="low").length===0 && (
          <div style={{ marginTop:10,textAlign:"center",fontSize:12,color:"#94a3b8" }}>Nothing in the "keep an eye on" bucket yet — add some from the dashboard.</div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
        {[["active",`Active (${active.length})`],["all",`All (${watchItems.length})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{
            padding:"7px 16px",borderRadius:20,fontSize:12,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit",
            background: filter===k?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.6)",
            border: `1px solid ${filter===k?"rgba(245,158,11,0.4)":"rgba(124,58,237,0.12)"}`,
            color: filter===k?"#f59e0b":"#64748b",
          }}>{l}</button>
        ))}
        {resolved.length>0 && (
          <div style={{ marginLeft:"auto",fontSize:11,color:"#94a3b8",display:"flex",alignItems:"center",gap:4 }}>
            ✅ {resolved.length} resolved
          </div>
        )}
      </div>

      {/* Items */}
      {displayed.length===0 && filter!=="slow" && (
        <div style={{ textAlign:"center",padding:"40px 20px",color:"#94a3b8" }}>
          <div style={{ fontSize:32,marginBottom:12 }}>👁</div>
          <div style={{ fontWeight:700,fontSize:15,color:"#1e1b4b",marginBottom:6 }}>Nothing on the Watch List yet</div>
          <div style={{ fontSize:13 }}>Tap <strong style={{color:"#f59e0b"}}>👁 Watch</strong> on any asset card to add something that isn't broken all the way but you know it's coming.</div>
        </div>
      )}

      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {displayed.map(item=>{
          const isExpanded = expandId===item.id;
          const pc = pColor[item.priority];
          return (
            <div key={item.id} style={{
              background: item.resolved ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.72)",
              border:`1.5px solid ${item.resolved?"rgba(148,163,184,0.2)":pc+"35"}`,
              borderLeft:`4px solid ${item.resolved?"#cbd5e1":pc}`,
              borderRadius:16, overflow:"hidden",
              opacity: item.resolved ? 0.65 : 1,
              backdropFilter:"blur(20px)",
            }}>
              {/* Card header — always visible */}
              <div
                onClick={()=>setExpandId(isExpanded?null:item.id)}
                style={{ padding:"14px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start" }}
              >
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4 }}>
                    <span style={{ fontSize:10,fontWeight:800,letterSpacing:0.5,padding:"2px 9px",borderRadius:20,color:pc,background:pc+"18",border:`1px solid ${pc}30` }}>
                      {pLabel[item.priority]}
                    </span>
                    {item.resolved && <span style={{ fontSize:10,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,0.1)",padding:"2px 8px",borderRadius:20 }}>✅ Fixed</span>}
                    <span style={{ fontSize:10,color:"#94a3b8" }}>{CAT_ICON[item.assetCategory]} {item.assetLocation}</span>
                  </div>
                  <div style={{ fontWeight:800,fontSize:14,color:"#1e1b4b",marginBottom:2 }}>{item.assetName}</div>
                  <div style={{ fontSize:12,color:"#64748b",lineHeight:1.45 }}>
                    {isExpanded ? item.note : (item.note.length>80 ? item.note.slice(0,80)+"…" : item.note)}
                  </div>
                  <div style={{ fontSize:10,color:"#cbd5e1",marginTop:4 }}>
                    Added {new Date(item.addedAt).toLocaleDateString()}
                    {item.resolvedAt && ` · Fixed ${new Date(item.resolvedAt).toLocaleDateString()}`}
                  </div>
                </div>
                <span style={{ color:"#94a3b8",fontSize:14,flexShrink:0,marginTop:2 }}>{isExpanded?"▲":"▼"}</span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop:"1px solid rgba(124,58,237,0.08)",padding:"12px 16px",background:"rgba(255,255,255,0.4)" }}>
                  {item.photoUrl && (
                    <img src={item.photoUrl} alt="watch" style={{ width:"100%",maxHeight:180,objectFit:"cover",borderRadius:10,marginBottom:12 }} />
                  )}
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                    <button
                      onClick={()=>toggleResolve(item.id)}
                      style={{ flex:2,padding:"10px 0",background:item.resolved?"rgba(245,158,11,0.1)":"rgba(16,185,129,0.1)",border:`1.5px solid ${item.resolved?"rgba(245,158,11,0.4)":"rgba(16,185,129,0.4)"}`,borderRadius:12,color:item.resolved?"#f59e0b":"#10b981",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"inherit" }}
                    >
                      {item.resolved ? "↩ Re-open" : "✅ Mark Fixed"}
                    </button>
                    <button
                      onClick={()=>deleteItem(item.id)}
                      style={{ flex:1,padding:"10px 0",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:12,color:"#f87171",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit" }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  root: { minHeight:"100vh", fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',sans-serif", position:"relative", overflowX:"hidden" },
  bg:    { position:"fixed", inset:0, background:"linear-gradient(135deg,#f0f4ff 0%,#faf5ff 50%,#f5f0ff 100%)", zIndex:0 },
  blob1: { position:"fixed", top:-150, left:-100, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(167,139,250,0.3) 0%,transparent 65%)", zIndex:0, pointerEvents:"none" },
  blob2: { position:"fixed", bottom:-100, right:-80, width:450, height:450, borderRadius:"50%", background:"radial-gradient(circle,rgba(196,181,253,0.25) 0%,transparent 65%)", zIndex:0, pointerEvents:"none" },
  blob3: { position:"fixed", top:"40%", left:"30%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(124,58,237,0.06) 0%,transparent 65%)", zIndex:0, pointerEvents:"none" },
  header: { position:"relative", zIndex:10, background:"rgba(255,255,255,0.7)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", borderBottom:"1px solid rgba(124,58,237,0.1)", boxShadow:"0 1px 0 rgba(255,255,255,0.8),0 4px 24px rgba(124,58,237,0.06)" },
  hInner: { maxWidth:1100, margin:"0 auto", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 },
  logoRow: { display:"flex", alignItems:"center", gap:14 },
  logoBox: { width:44, height:44, borderRadius:14, background:"linear-gradient(135deg,#7c3aed,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 20px rgba(124,58,237,0.4)" },
  logoTxt: { color:"#fff", fontWeight:900, fontSize:14, letterSpacing:1 },
  appName: { fontWeight:800, fontSize:16, color:"#1e1b4b" },
  appSub:  { fontSize:10, color:"#94a3b8", marginTop:1 },
  statRow: { display:"flex", gap:8, flexWrap:"wrap" },
  nav: { position:"relative", zIndex:9, background:"rgba(255,255,255,0.55)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderBottom:"1px solid rgba(124,58,237,0.08)" },
  navInner: { maxWidth:1100, margin:"0 auto", padding:"0 20px", display:"flex", overflowX:"auto" },
  navBtn: { padding:"13px 20px", background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:13, fontFamily:"inherit", fontWeight:500, borderBottom:"2px solid transparent", whiteSpace:"nowrap" },
  navOn:  { color:"#7c3aed", borderBottom:"2px solid #7c3aed", fontWeight:700 },
  main: { position:"relative", zIndex:1, maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
  alertBar: { background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:20 },
  alertChip: { background:"rgba(248,113,113,0.12)", border:"1px solid rgba(248,113,113,0.25)", color:"#f87171", borderRadius:10, fontSize:11, fontWeight:600, padding:"3px 10px" },
  catRow: { display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 },
  catBtn: { padding:"7px 15px", background:"rgba(255,255,255,0.6)", border:"1px solid rgba(124,58,237,0.12)", color:"#64748b", borderRadius:20, cursor:"pointer", fontSize:12, fontFamily:"inherit" },
  catOn:  { background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.35)", color:"#7c3aed", fontWeight:700 },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 },
  glassPanel: { background:"rgba(255,255,255,0.65)", border:"1.5px solid rgba(124,58,237,0.1)", borderRadius:20, padding:24, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", boxShadow:"0 4px 24px rgba(124,58,237,0.06),inset 0 1px 0 rgba(255,255,255,0.9)" },
  secLabel: { fontSize:11, letterSpacing:1.5, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", marginBottom:16 },
  logRow: { display:"flex", alignItems:"flex-start", gap:12, padding:"12px 0", borderBottom:"1px solid rgba(124,58,237,0.06)", flexWrap:"wrap" },
  histRow: { padding:"10px 0", borderBottom:"1px solid rgba(124,58,237,0.07)", display:"flex", flexWrap:"wrap", gap:0 },
  cGhost: { flex:1, padding:"8px 0", background:"rgba(255,255,255,0.5)", border:"1px solid rgba(124,58,237,0.15)", color:"#7c3aed", borderRadius:12, cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:600 },
  cPrimary: { flex:2, padding:"8px 0", background:"rgba(124,58,237,0.12)", border:"1.5px solid rgba(124,58,237,0.3)", color:"#7c3aed", borderRadius:12, cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:800 },
  overlay: { position:"fixed", inset:0, background:"rgba(30,27,75,0.2)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 },
  modal: { background:"rgba(255,255,255,0.92)", border:"1.5px solid rgba(124,58,237,0.15)", borderRadius:24, padding:28, width:"100%", maxWidth:420, boxShadow:"0 24px 64px rgba(124,58,237,0.2),inset 0 1px 0 #fff", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", maxHeight:"85vh", overflowY:"auto" },
  mLabel: { fontSize:10, letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:6 },
  mTitle: { fontSize:20, fontWeight:800, color:"#1e1b4b", marginBottom:4 },
  mSub:   { fontSize:13, color:"#94a3b8" },
  mRow:   { display:"flex", gap:10, marginTop:20 },
  inp: { width:"100%", background:"rgba(124,58,237,0.04)", border:"1.5px solid rgba(124,58,237,0.15)", color:"#1e1b4b", padding:"10px 14px", fontFamily:"inherit", fontSize:14, borderRadius:12, boxSizing:"border-box" },
  btnP: { flex:2, padding:"11px 20px", background:"rgba(124,58,237,0.12)", border:"1.5px solid rgba(124,58,237,0.35)", color:"#7c3aed", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13, borderRadius:14 },
  btnG: { flex:1, padding:"11px 16px", background:"rgba(255,255,255,0.5)", border:"1px solid rgba(124,58,237,0.15)", color:"#94a3b8", cursor:"pointer", fontFamily:"inherit", fontSize:13, borderRadius:14 },
  toast: { position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:"rgba(255,255,255,0.92)", border:"1px solid rgba(124,58,237,0.2)", backdropFilter:"blur(20px)", color:"#7c3aed", fontWeight:700, padding:"12px 28px", borderRadius:20, fontSize:13, zIndex:999, whiteSpace:"nowrap", boxShadow:"0 8px 32px rgba(124,58,237,0.2)" },
};

// ─── DAILY WORK LOG ──────────────────────────────────────────────────────────
const WORK_TAGS = [
  { label:"🔧 Repair",      color:"#f87171" },
  { label:"🔩 PM",          color:"#7c3aed" },
  { label:"📸 Inspection",  color:"#38bdf8" },
  { label:"🏭 Machine",     color:"#a855f7" },
  { label:"⚡ Electrical",  color:"#f59e0b" },
  { label:"🧹 Housekeeping",color:"#10b981" },
  { label:"📦 Parts",       color:"#64748b" },
  { label:"🚨 Emergency",   color:"#ef4444" },
  { label:"💬 Comms",       color:"#06b6d4" },
  { label:"Other",          color:"#94a3b8" },
];

function DailyWorkLog({ workEntries, setWorkEntries, showToast }) {
  const [text,     setText]     = useState("");
  const [tag,      setTag]      = useState("🔧 Repair");
  const [filterDay,setFilterDay]= useState(TODAY);
  const [editEntry,setEditEntry]= useState(null);
  const [editText, setEditText] = useState("");
  const textRef = useRef();

  const todayEntries = workEntries
    .filter(e => e.date === filterDay)
    .sort((a,b) => b.timestamp - a.timestamp);

  const allDays = [...new Set(workEntries.map(e=>e.date))].sort((a,b)=>b.localeCompare(a));

  function submit() {
    if (!text.trim()) return;
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      date: TODAY,
      time: new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),
      text: text.trim(),
      tag,
      tech: "CB",
    };
    setWorkEntries(p => [entry, ...p]);
    sheetsPost("logDaily", entry);
    setText("");
    showToast("✅ Logged");
    textRef.current?.focus();
  }

  function deleteEntry(id) {
    setWorkEntries(p => p.filter(e => e.id !== id));
    showToast("🗑 Entry removed");
  }

  function saveEdit() {
    setWorkEntries(p => p.map(e => e.id===editEntry.id ? {...e, text:editText} : e));
    setEditEntry(null);
    showToast("✅ Updated");
  }

  const tagColor = (t) => WORK_TAGS.find(x=>x.label===t)?.color || "#94a3b8";

  return (
    <div>
      {/* EDIT MODAL */}
      {editEntry && (
        <Overlay onClose={()=>setEditEntry(null)}>
          <div style={S.mTitle}>Edit Entry</div>
          <div style={{ marginTop:12,fontSize:11,color:"#94a3b8",marginBottom:6 }}>
            {editEntry.time} · {editEntry.date}
          </div>
          <textarea
            value={editText}
            onChange={e=>setEditText(e.target.value)}
            rows={5}
            autoFocus
            style={{...S.inp, resize:"vertical", marginTop:8}}
          />
          <div style={S.mRow}>
            <button onClick={()=>setEditEntry(null)} style={S.btnG}>Cancel</button>
            <button onClick={saveEdit} style={S.btnP}>Save</button>
          </div>
        </Overlay>
      )}

      {/* QUICK ENTRY BOX */}
      <div style={{ background:"rgba(255,255,255,0.75)", border:"1.5px solid rgba(124,58,237,0.15)", borderRadius:20, padding:18, marginBottom:20, backdropFilter:"blur(20px)", boxShadow:"0 4px 24px rgba(124,58,237,0.06)" }}>
        <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>
          📋 What did you just do?
        </div>

        {/* TAG ROW */}
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
          {WORK_TAGS.map(t=>(
            <button key={t.label} onClick={()=>setTag(t.label)} style={{
              padding:"5px 11px", borderRadius:20, fontSize:11, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit",
              background: tag===t.label ? t.color+"22" : "rgba(255,255,255,0.5)",
              border: `1.5px solid ${tag===t.label ? t.color : "rgba(124,58,237,0.12)"}`,
              color: tag===t.label ? t.color : "#94a3b8",
            }}>{t.label}</button>
          ))}
        </div>

        {/* TEXT INPUT */}
        <textarea
          ref={textRef}
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)) submit(); }}
          placeholder="e.g. Replaced HVAC filter in break room, 20x20x1 MERV-8. Found duct tape on return — removed it."
          rows={3}
          style={{...S.inp, resize:"none", fontSize:14, marginBottom:12}}
        />

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
          <div style={{ fontSize:11,color:"#94a3b8" }}>
            {new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} · {TODAY} · CB
            <span style={{ marginLeft:8,color:"#cbd5e1" }}>Cmd+Enter to save</span>
          </div>
          <button
            onClick={submit}
            disabled={!text.trim()}
            style={{ padding:"10px 28px", background:"linear-gradient(135deg,#7c3aed,#a855f7)", border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:text.trim()?"pointer":"not-allowed", opacity:text.trim()?1:0.5 }}
          >
            Log It →
          </button>
        </div>
      </div>

      {/* DAY FILTER */}
      <div style={{ display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4 }}>
        {allDays.length === 0
          ? <div style={{ fontSize:12,color:"#94a3b8" }}>No entries yet — log your first task above</div>
          : allDays.map(d=>(
            <button key={d} onClick={()=>setFilterDay(d)} style={{
              padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
              background: filterDay===d ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.6)",
              border: `1px solid ${filterDay===d ? "#7c3aed" : "rgba(124,58,237,0.15)"}`,
              color: filterDay===d ? "#7c3aed" : "#64748b",
            }}>
              {d===TODAY ? "Today" : d}
              <span style={{ marginLeft:6,fontSize:10,opacity:0.7 }}>
                ({workEntries.filter(e=>e.date===d).length})
              </span>
            </button>
          ))
        }
      </div>

      {/* ENTRY LIST */}
      {todayEntries.length === 0 && allDays.length > 0 && (
        <div style={{ textAlign:"center",padding:"30px 0",color:"#94a3b8",fontSize:13 }}>No entries for {filterDay===TODAY?"today":filterDay}</div>
      )}

      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {todayEntries.map((entry,i)=>(
          <div key={entry.id} style={{
            background:"rgba(255,255,255,0.7)",
            border:"1.5px solid rgba(124,58,237,0.1)",
            borderLeft:`4px solid ${tagColor(entry.tag)}`,
            borderRadius:14, padding:"14px 16px",
            backdropFilter:"blur(16px)",
            display:"flex", gap:12, alignItems:"flex-start",
          }}>
            {/* Timeline dot */}
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,paddingTop:2,flexShrink:0 }}>
              <div style={{ width:10,height:10,borderRadius:"50%",background:tagColor(entry.tag),flexShrink:0 }} />
              {i < todayEntries.length-1 && <div style={{ width:2,height:"100%",minHeight:20,background:"rgba(124,58,237,0.1)",borderRadius:2 }} />}
            </div>

            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6 }}>
                <div style={{ display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
                  <span style={{ fontSize:11,fontWeight:700,color:tagColor(entry.tag),background:tagColor(entry.tag)+"18",padding:"2px 8px",borderRadius:20 }}>{entry.tag}</span>
                  <span style={{ fontSize:11,color:"#94a3b8" }}>{entry.time}</span>
                </div>
                <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                  <button onClick={()=>{ setEditEntry(entry); setEditText(entry.text); }} style={{ padding:"3px 8px",background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:6,color:"#7c3aed",fontSize:11,cursor:"pointer" }}>✏️</button>
                  <button onClick={()=>deleteEntry(entry.id)} style={{ padding:"3px 8px",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,color:"#f87171",fontSize:11,cursor:"pointer" }}>🗑</button>
                </div>
              </div>
              <div style={{ fontSize:14,color:"#1e1b4b",lineHeight:1.5,wordBreak:"break-word" }}>{entry.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* DAILY SUMMARY */}
      {todayEntries.length > 0 && (
        <div style={{ marginTop:20,background:"rgba(124,58,237,0.05)",border:"1px solid rgba(124,58,237,0.12)",borderRadius:14,padding:"14px 16px" }}>
          <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>
            {filterDay===TODAY?"Today's":"Day"} Summary — {todayEntries.length} task{todayEntries.length!==1?"s":""}
          </div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {WORK_TAGS.filter(t=>todayEntries.some(e=>e.tag===t.label)).map(t=>{
              const count = todayEntries.filter(e=>e.tag===t.label).length;
              return (
                <div key={t.label} style={{ background:t.color+"15",border:`1px solid ${t.color}30`,borderRadius:20,padding:"4px 12px",display:"flex",gap:6,alignItems:"center" }}>
                  <span style={{ color:t.color,fontWeight:800,fontSize:13 }}>{count}</span>
                  <span style={{ color:t.color,fontSize:11 }}>{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
