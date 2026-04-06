// frontend/src/components/Dashboard.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const fmtTime = (t) => { if(!t) return ""; const [h,m]=t.split(":").map(Number); return `${h%12===0?12:h%12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };
const hour = () => new Date().getHours();
const greet = () => hour()<12?"morning":hour()<17?"afternoon":"evening";

function getTodayDoses(logs, today) {
  const tl = logs.filter(l=>l.date===today);
  return {
    taken:   tl.filter(l=>l.status==="taken"),
    missed:  tl.filter(l=>l.status==="missed"),
    pending: tl.filter(l=>l.status==="pending"||l.status==="snoozed"),
  };
}
function calcAdherence(logs) {
  const s = logs.filter(l=>l.status!=="pending"&&l.status!=="snoozed");
  if(!s.length) return 0;
  return Math.round((s.filter(l=>l.status==="taken").length/s.length)*100);
}
function calcStreak(logs, today) {
  const m={}; logs.forEach(l=>{ if(l.status==="pending"||l.status==="snoozed") return; if(!m[l.date]) m[l.date]={t:0,n:0}; m[l.date].n++; if(l.status==="taken") m[l.date].t++; });
  let s=0,d=new Date(today);
  while(true){ const k=d.toISOString().split("T")[0],v=m[k]; if(!v||v.t<v.n) break; s++; d.setDate(d.getDate()-1); }
  return s;
}

export default function Dashboard({ user, logs=[], todayDate, fetching, onMarkTaken, onSnooze, onDeleteLog, onUndoTaken, onAddMed, onViewHistory, onSOS }) {
  const { logout } = useAuth();
  const [snoozeId, setSnoozeId] = useState(null);
  const [menu,     setMenu]     = useState(false);

  const { taken, missed, pending } = getTodayDoses(logs, todayDate);
  const adh   = calcAdherence(logs);
  const streak= calcStreak(logs, todayDate);
  const total = taken.length + missed.length + pending.length;

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.bar}>
        <div>
          <p style={s.greet}>Good {greet()},</p>
          <h1 style={s.name}>{user?.name?.split(" ")[0] || "there"} 👋</h1>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={s.sos} onClick={onSOS}>🆘 SOS</button>
          <button style={s.add} onClick={onAddMed}>+ Add</button>
          <div style={{position:"relative"}}>
            <button style={s.av} onClick={()=>setMenu(v=>!v)}>{user?.name?.[0]?.toUpperCase()||"U"}</button>
            {menu&&(
              <div style={s.menu}>
                <p style={s.mName}>{user?.name}</p>
                <p style={s.mEmail}>{user?.email}</p>
                <hr style={{border:"none",borderTop:"1px solid #E2E8F0",margin:"8px 0"}}/>
                <button style={s.logout} onClick={logout}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={s.scroll}>
        {fetching && <div style={s.syncing}>Syncing with server…</div>}

        {/* Stats */}
        <div style={s.stats}>
          <Stat v={`${adh}%`} l="Overall" c="#1B2B4B"/>
          <Stat v={streak}    l="Streak"  c="#16A34A"/>
          <Stat v={`${taken.length}/${total}`} l="Today" c="#3B82F6"/>
        </div>

        {/* Missed banner */}
        {missed.length>0&&(
          <div style={s.warn}>
            <span>⚠️</span>
            <div>
              <p style={s.wT}>{missed.length} missed dose{missed.length>1?"s":""} today</p>
              <p style={s.wS}>Caregiver may be notified automatically</p>
            </div>
          </div>
        )}

        {/* Pending */}
        {pending.length>0&&(
          <Group title="Due today" count={pending.length}>
            {pending.map(d=>(
              <DoseCard key={d._id} dose={d} type="pending"
                snoozeOpen={snoozeId===d._id}
                onTaken={()=>onMarkTaken(d._id)}
                onSnoozeToggle={()=>setSnoozeId(snoozeId===d._id?null:d._id)}
                onSnooze={m=>{onSnooze(d._id,m);setSnoozeId(null);}}
                onDelete={()=>onDeleteLog(d._id)} />
            ))}
          </Group>
        )}

        {/* Taken */}
        {taken.length>0&&(
          <Group title="Taken" count={taken.length}>
            {taken.map(d=>(
              <DoseCard key={d._id} dose={d} type="taken"
                onUndo={()=>onUndoTaken(d._id)}
                onDelete={()=>onDeleteLog(d._id)} />
            ))}
          </Group>
        )}

        {/* Missed */}
        {missed.length>0&&(
          <Group title="Missed" count={missed.length}>
            {missed.map(d=>(
              <DoseCard key={d._id} dose={d} type="missed"
                onDelete={()=>onDeleteLog(d._id)} />
            ))}
          </Group>
        )}

        {/* Empty */}
        {total===0&&!fetching&&(
          <div style={s.empty}>
            <p style={{fontSize:44,margin:"0 0 12px"}}>💊</p>
            <p style={s.eT}>No medicines scheduled today</p>
            <p style={s.eS}>Add your first medicine to get started</p>
            <button style={s.primary} onClick={onAddMed}>+ Add medicine</button>
          </div>
        )}

        {total>0&&<button style={s.hist} onClick={onViewHistory}>View full history →</button>}
      </div>
    </div>
  );
}

function Group({ title, count, children }) {
  const [open,setOpen]=useState(true);
  return (
    <div style={{marginBottom:18}}>
      <button style={s.gHdr} onClick={()=>setOpen(o=>!o)}>
        <span style={s.gT}>{title}</span>
        <span style={s.gC}>{count}</span>
        <span style={{marginLeft:"auto",color:"#94A3B8",fontSize:11}}>{open?"▲":"▼"}</span>
      </button>
      {open&&children}
    </div>
  );
}

function DoseCard({ dose, type, snoozeOpen, onTaken, onSnoozeToggle, onSnooze, onUndo, onDelete }) {
  const cfg={
    pending:{ bc:"#F59E0B",dc:"#F59E0B"},
    snoozed:{ bc:"#F59E0B",dc:"#F59E0B"},
    taken:{   bc:"#16A34A",dc:"#16A34A"},
    missed:{  bc:"#DC2626",dc:"#DC2626"},
  }[type]||{bc:"#94A3B8",dc:"#94A3B8"};
  const eff = type==="snoozed"?"pending":type;
  return (
    <div style={{...s.dCard,borderLeftColor:cfg.bc}}>
      <div style={s.dRow}>
        <div style={{...s.dot,background:cfg.dc}}/>
        <div style={{flex:1}}>
          <p style={s.dName}>{dose.medicineName}{dose.isCritical?" 🔴":""}</p>
          <p style={s.dTime}>
            {eff==="taken"  ? `Taken at ${fmtTime(dose.actualTime)} · due ${fmtTime(dose.scheduledTime)}` :
             eff==="missed" ? `Missed — was due ${fmtTime(dose.scheduledTime)}` :
                              `Due at ${fmtTime(dose.scheduledTime)}`}
          </p>
        </div>
        {eff==="pending"&&<div style={s.acts}>
          <button style={s.takenB} onClick={onTaken}>✓ Taken</button>
          <button style={s.snoozeB} onClick={onSnoozeToggle}>⏰</button>
          <button style={s.delB} onClick={onDelete}>✕</button>
        </div>}
        {eff==="taken"&&<div style={s.acts}>
          <span style={s.tkBadge}>✓</span>
          <button style={s.undoB} onClick={onUndo} title="Undo">↩</button>
        </div>}
        {eff==="missed"&&<div style={s.acts}>
          <span style={s.msBadge}>✕</span>
          <button style={s.delB} onClick={onDelete} title="Remove">🗑</button>
        </div>}
      </div>
      {snoozeOpen&&(
        <div style={s.snRow}>
          <span style={s.snLbl}>Snooze:</span>
          {[5,10,15,30].map(m=><button key={m} style={s.snPill} onClick={()=>onSnooze(m)}>{m}m</button>)}
        </div>
      )}
    </div>
  );
}

function Stat({ v, l, c }) {
  return (
    <div style={s.stat}>
      <p style={{...s.sv,color:c}}>{v}</p>
      <p style={s.sl}>{l}</p>
    </div>
  );
}

const s = {
  root:    {minHeight:"100vh",background:"#F8FAFC",fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",flexDirection:"column"},
  bar:     {display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"18px 16px 14px",background:"#FFF",borderBottom:"1px solid #E2E8F0"},
  greet:   {fontSize:12,color:"#64748B",margin:"0 0 2px"},
  name:    {fontSize:20,fontWeight:700,color:"#1B2B4B",margin:0},
  sos:     {padding:"7px 11px",background:"#FEF2F2",color:"#DC2626",border:"1.5px solid #FECACA",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"},
  add:     {padding:"7px 13px",background:"#1B2B4B",color:"#FFF",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"},
  av:      {width:32,height:32,borderRadius:"50%",background:"#EFF6FF",color:"#3B82F6",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"},
  menu:    {position:"absolute",right:0,top:38,background:"#FFF",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 16px",minWidth:180,zIndex:99,boxShadow:"0 4px 16px rgba(0,0,0,0.1)"},
  mName:   {fontSize:14,fontWeight:600,color:"#1B2B4B",margin:"0 0 2px"},
  mEmail:  {fontSize:12,color:"#64748B",margin:0},
  logout:  {background:"transparent",border:"none",color:"#DC2626",fontSize:13,fontWeight:600,cursor:"pointer",padding:0},
  scroll:  {padding:"14px 14px 40px",maxWidth:480,width:"100%",margin:"0 auto"},
  syncing: {background:"#EFF6FF",color:"#3B82F6",fontSize:12,padding:"6px 12px",borderRadius:6,marginBottom:12,textAlign:"center"},
  stats:   {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14},
  stat:    {background:"#FFF",borderRadius:12,padding:"12px 10px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",textAlign:"center"},
  sv:      {fontSize:19,fontWeight:700,margin:"0 0 3px"},
  sl:      {fontSize:11,color:"#64748B",margin:0},
  warn:    {display:"flex",alignItems:"center",gap:10,background:"#FEF3C7",border:"1.5px solid #FCD34D",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:18},
  wT:      {fontSize:13,fontWeight:600,color:"#92400E",margin:"0 0 2px"},
  wS:      {fontSize:11,color:"#B45309",margin:0},
  gHdr:    {display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:8,width:"100%"},
  gT:      {fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.07em"},
  gC:      {background:"#E2E8F0",color:"#64748B",fontSize:11,fontWeight:700,borderRadius:999,padding:"2px 7px"},
  dCard:   {background:"#FFF",borderRadius:12,borderLeft:"4px solid transparent",padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"},
  dRow:    {display:"flex",alignItems:"center",gap:10},
  dot:     {width:9,height:9,borderRadius:"50%",flexShrink:0},
  dName:   {fontSize:14,fontWeight:600,color:"#1B2B4B",margin:"0 0 2px"},
  dTime:   {fontSize:11,color:"#64748B",margin:0},
  acts:    {display:"flex",gap:5,flexShrink:0,alignItems:"center"},
  takenB:  {padding:"6px 10px",background:"#DCFCE7",color:"#16A34A",border:"none",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer"},
  snoozeB: {padding:"6px 9px",background:"#FEF3C7",color:"#92400E",border:"none",borderRadius:7,fontSize:12,cursor:"pointer"},
  delB:    {padding:"5px 8px",background:"#FEF2F2",color:"#DC2626",border:"none",borderRadius:7,fontSize:11,cursor:"pointer"},
  undoB:   {padding:"5px 8px",background:"#F1F5F9",color:"#64748B",border:"none",borderRadius:7,fontSize:12,cursor:"pointer"},
  tkBadge: {width:24,height:24,borderRadius:"50%",background:"#DCFCE7",color:"#16A34A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700},
  msBadge: {width:24,height:24,borderRadius:"50%",background:"#FEE2E2",color:"#DC2626",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700},
  snRow:   {display:"flex",alignItems:"center",gap:6,marginTop:10,paddingTop:8,borderTop:"1px solid #E2E8F0",flexWrap:"wrap"},
  snLbl:   {fontSize:12,color:"#64748B",fontWeight:500},
  snPill:  {padding:"4px 10px",border:"1.5px solid #E2E8F0",borderRadius:999,background:"transparent",fontSize:12,color:"#1B2B4B",fontWeight:600,cursor:"pointer"},
  empty:   {textAlign:"center",padding:"48px 20px"},
  eT:      {fontSize:16,fontWeight:600,color:"#1B2B4B",margin:"0 0 6px"},
  eS:      {fontSize:13,color:"#64748B",margin:"0 0 20px"},
  primary: {padding:"11px 22px",background:"#1B2B4B",color:"#FFF",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"},
  hist:    {display:"block",width:"100%",padding:"13px",background:"transparent",color:"#3B82F6",border:"1.5px solid #E2E8F0",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"center",marginTop:8},
};
