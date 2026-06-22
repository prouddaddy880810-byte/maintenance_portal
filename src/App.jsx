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
    id:1, assetId:11, timestamp:"2026-06-22T07:03:00",
    pressure:110, temp:163, runHours:38087, loadHours:21598,
    maintenanceIn:1005, status:"On Load", keyMode:"On | pA - Load",
    notes:"", photo:null, source:"manual"
  }
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function load(k, fb) { try { return JSON.parse(localStorage.getItem(k)||"null") || fb; } catch { return fb; } }
function save(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
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
    headers:{"Content-Type":"application/json"},
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

function Pill({ n, label, color }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:5,background:color+"15",border:`1px solid ${color}30`,borderRadius:20,padding:"4px 12px" }}>
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

// ─── ASSET CARD ──────────────────────────────────────────────────────────────
function AssetCard({ asset, onLog, onHistory, onEdit, onDelete }) {
  const { pm } = asset;
  return (
    <div style={{ background:"rgba(255,255,255,0.65)", border:`1.5px solid ${pm.color}30`, borderRadius:20, padding:18, backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", boxShadow:`0 4px 24px ${pm.color}12, inset 0 1px 0 rgba(255,255,255,0.9)`, display:"flex",flexDirection:"column",gap:6 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
        <span style={{ fontSize:22,color:CAT_COLOR[asset.category] }}>{CAT_ICON[asset.category]}</span>
        <span style={{ fontSize:9,fontWeight:800,letterSpacing:1,padding:"3px 9px",borderRadius:20,color:pm.color,background:pm.color+"18",border:`1px solid ${pm.color}30` }}>{pm.label}</span>
      </div>
      <div style={{ fontWeight:800,fontSize:15,color:"#1e1b4b",lineHeight:1.2,marginTop:2 }}>{asset.name}</div>
      <div style={{ fontSize:11,color:"#94a3b8" }}>{asset.location}</div>
      <div style={{ fontSize:12,color:"#64748b" }}>{asset.detail}</div>
      {asset.pmEnabled && (
        <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}>
          <span style={{ fontSize:10,color:"#cbd5e1" }}>Every {asset.intervalDays}d</span>
          {pm.days!==null && <span style={{ fontSize:11,color:pm.color,fontWeight:700 }}>{pm.days<0?`${Math.abs(pm.days)}d past due`:`${pm.days}d left`}</span>}
        </div>
      )}
      {pm.next && <div style={{ fontSize:10,color:"#cbd5e1" }}>Next: <span style={{color:pm.color}}>{dStr(pm.next)}</span></div>}
      <div style={{ display:"flex",gap:6,marginTop:10,flexWrap:"wrap" }}>
        <button onClick={onHistory} style={S.cGhost}>History</button>
        <button onClick={onEdit} style={{ ...S.cGhost,color:"#7c3aed" }}>Edit</button>
        <button onClick={onDelete} style={{ ...S.cGhost,color:"#f87171",borderColor:"#f8717130" }}>✕</button>
        <button onClick={onLog} style={S.cPrimary}>Log PM</button>
      </div>
    </div>
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

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [assets,     setAssets]     = useState(() => load("cbv3_assets",     INITIAL_ASSETS));
  const [logs,       setLogs]       = useState(() => load("cbv3_logs",       INITIAL_LOGS));
  const [machines,   setMachines]   = useState(() => load("cbv3_machines",   INITIAL_MACHINES));
  const [gaugeLogs,  setGaugeLogs]  = useState(() => load("cbv3_gaugeLogs",  INITIAL_GAUGE_LOGS));
  const [tab,        setTab]        = useState("dashboard");
  const [catFilter,  setCat]        = useState("All");
  const [logModal,   setLog]        = useState(null);
  const [histModal,  setHist]       = useState(null);
  const [addModal,   setAdd]        = useState(false);
  const [editAsset,  setEditAsset]  = useState(null);
  const [logNote,    setNote]       = useState("");
  const [logDate,    setDate]       = useState(TODAY);
  const [toast,      setToast]      = useState(null);
  const [addForm,    setForm]       = useState({ name:"",location:"",category:"Filter",detail:"",intervalDays:30,pmEnabled:true });

  useEffect(() => { save("cbv3_assets",    assets);    }, [assets]);
  useEffect(() => { save("cbv3_logs",      logs);      }, [logs]);
  useEffect(() => { save("cbv3_machines",  machines);  }, [machines]);
  useEffect(() => { save("cbv3_gaugeLogs", gaugeLogs); }, [gaugeLogs]);

  function showToast(m) { setToast(m); setTimeout(()=>setToast(null), 2800); }

  function doLog() {
    setLogs(p=>[...p,{ id:Date.now(),assetId:logModal.id,date:logDate,note:logNote,tech:"CB" }]);
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

  function deleteAsset(id) { setAssets(p=>p.filter(a=>a.id!==id)); setLogs(p=>p.filter(l=>l.assetId!==id)); showToast("Asset removed"); }

  const enriched = assets.map(a=>({...a,pm:getPM(a,logs)}));
  const overdue  = enriched.filter(a=>a.pm.label==="Overdue"||a.pm.label==="Never logged");
  const dueSoon  = enriched.filter(a=>a.pm.label==="Due soon");
  const ok       = enriched.filter(a=>a.pm.label==="OK");
  const cats     = ["All",...Array.from(new Set(assets.map(a=>a.category)))];
  const sorted   = [...enriched].sort((a,b)=>{ const o={"Never logged":0,"Overdue":1,"Due soon":2,"OK":3,"Log only":4}; return o[a.pm.label]-o[b.pm.label]; });
  const displayed = catFilter==="All" ? sorted : sorted.filter(a=>a.category===catFilter);

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
    ["machines",   "🏭 Machines"],
    ["gauge",      "⚡ Gauge Log"],
    ["history",    "PM History"],
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
            <div style={S.grid}>
              {displayed.map(a=>(
                <AssetCard key={a.id} asset={a}
                  onLog={()=>setLog(a)}
                  onHistory={()=>setHist(a)}
                  onEdit={()=>setEditAsset(a)}
                  onDelete={()=>deleteAsset(a.id)} />
              ))}
            </div>
          </>
        )}

        {/* MACHINES TAB */}
        {tab==="machines" && (
          <MachineDB machines={machines} setMachines={setMachines} showToast={showToast} />
        )}

        {/* GAUGE LOG TAB */}
        {tab==="gauge" && (
          <GaugeLog gaugeLogs={gaugeLogs} setGaugeLogs={setGaugeLogs} assets={assets} showToast={showToast} />
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
