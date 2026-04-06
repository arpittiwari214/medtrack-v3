// frontend/src/App.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth }  from "./context/AuthContext";
import { medicinesAPI, logsAPI, alertsAPI, authAPI } from "./api/index";

import Auth               from "./components/Auth";
import Onboarding         from "./components/Onboarding";
import Dashboard          from "./components/Dashboard";
import AddMedicine        from "./components/AddMedicine";
import ReminderModal      from "./components/ReminderModal";
import AdherenceAnalytics from "./components/AdherenceAnalytics";
import CaregiverAlerts    from "./components/CaregiverAlerts";
import MedicineList       from "./components/MedicineList";
import HistoryView        from "./components/HistoryView";

const SC = {
  DASHBOARD:"dashboard", ADD:"add_medicine", EDIT:"edit_medicine",
  LIST:"medicine_list", ANALYTICS:"analytics", CAREGIVER:"caregiver", HISTORY:"history",
};

const getToday   = () => new Date().toISOString().split("T")[0];
const getNowHHMM = () => { const n=new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; };

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang="en-IN"; u.rate=0.92;
  window.speechSynthesis.speak(u);
}
function fireNotif(title, body) {
  if (!("Notification" in window)) return;
  const go = () => new Notification(title, { body, icon:"/favicon.ico" });
  if (Notification.permission==="granted") go();
  else if (Notification.permission!=="denied") Notification.requestPermission().then(p=>{ if(p==="granted") go(); });
}

export default function App() {
  const { user, loading, refreshUser } = useAuth();

  const [medicines,      setMedicines]      = useState([]);
  const [logs,           setLogs]           = useState([]);
  const [alerts,         setAlerts]         = useState([]);
  const [fetching,       setFetching]       = useState(false);
  const [screen,         setScreen]         = useState(SC.DASHBOARD);
  const [editTarget,     setEditTarget]     = useState(null);
  const [activeReminder, setActiveReminder] = useState(null);
  const [dupError,       setDupError]       = useState("");
  const firedRef = useRef(new Set());
  const TODAY = getToday();

  // ── Load all data ────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const ago30 = new Date(); ago30.setDate(ago30.getDate()-30);
      const from  = ago30.toISOString().split("T")[0];
      const [mR, lR, aR] = await Promise.all([
        medicinesAPI.getAll(),
        logsAPI.getAll({ from, to: TODAY }),
        alertsAPI.getAll(),
      ]);
      setMedicines(mR.data.medicines);
      setLogs(lR.data.logs);
      setAlerts(aR.data.alerts);
    } catch (err) {
      console.error("Load error:", err.message);
    } finally {
      setFetching(false);
    }
  }, [user, TODAY]);

  useEffect(() => { if (user) loadAll(); }, [user]);

  // ── Reminder scheduler ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      const [nowH,nowM] = getNowHHMM().split(":").map(Number);
      const nowTot = nowH*60+nowM;
      logs.forEach(log => {
        if (log.date!==TODAY || log.status!=="pending") return;
        const [sH,sM] = log.scheduledTime.split(":").map(Number);
        const diff = nowTot-(sH*60+sM);
        if (diff>=0 && diff<2 && !firedRef.current.has(log._id)) {
          firedRef.current.add(log._id);
          setActiveReminder(log);
          speak(`Time to take ${log.medicineName}`);
          fireNotif("💊 MedTrack", `Time to take ${log.medicineName}`);
        }
      });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [logs, TODAY, user]);

  // ── Auth gates ───────────────────────────────────────────────
  if (loading) return <Loader />;
  if (!user)   return <Auth />;
  if (!user.caregiver) {
    return <Onboarding onComplete={async () => { await loadAll(); }} />;
  }

  // ── Handlers ─────────────────────────────────────────────────
  const saveMed = async (med) => {
    setDupError("");
    try {
      if (med._id) {
        const r = await medicinesAPI.update(med._id, med);
        setMedicines(p=>p.map(m=>m._id===med._id?r.data.medicine:m));
      } else {
        const r = await medicinesAPI.create(med);
        setMedicines(p=>[...p, r.data.medicine]);
      }
      const lR = await logsAPI.getAll({ date: TODAY });
      setLogs(p=>[...p.filter(l=>l.date!==TODAY), ...lR.data.logs]);
      setEditTarget(null);
      setScreen(SC.DASHBOARD);
    } catch (err) {
      setDupError(err.response?.data?.message || "Failed to save medicine");
    }
  };

  const deleteMed = async (id) => {
    try {
      await medicinesAPI.delete(id);
      setMedicines(p=>p.filter(m=>m._id!==id));
      setLogs(p=>p.filter(l=>l.medicineId!==id));
      setAlerts(p=>p.filter(a=>a.medicineId!==id));
    } catch (err) { console.error(err.message); }
  };

  const completeMed = async (id) => {
    try {
      const r = await medicinesAPI.complete(id);
      setMedicines(p=>p.map(m=>m._id===id?r.data.medicine:m));
      setLogs(p=>p.filter(l=>!(l.medicineId===id&&l.status==="pending")));
    } catch (err) { console.error(err.message); }
  };

  const markTaken = async (logId) => {
    try { const r=await logsAPI.markTaken(logId); setLogs(p=>p.map(l=>l._id===logId?r.data.log:l)); }
    catch (err) { console.error(err.message); }
    setActiveReminder(null);
  };

  const snooze = async (logId, mins) => {
    try { const r=await logsAPI.snooze(logId,mins); setLogs(p=>p.map(l=>l._id===logId?r.data.log:l)); firedRef.current.delete(logId); }
    catch (err) { console.error(err.message); }
    setActiveReminder(null);
  };

  const skip = async (logId) => {
    try { const r=await logsAPI.skip(logId); setLogs(p=>p.map(l=>l._id===logId?r.data.log:l)); }
    catch (err) { console.error(err.message); }
    setActiveReminder(null);
  };

  const undoTaken = async (logId) => {
    try { const r=await logsAPI.undo(logId); setLogs(p=>p.map(l=>l._id===logId?r.data.log:l)); }
    catch (err) { console.error(err.message); }
  };

  const deleteLog = async (logId) => {
    try { await logsAPI.delete(logId); setLogs(p=>p.filter(l=>l._id!==logId)); firedRef.current.delete(logId); }
    catch (err) { console.error(err.message); }
  };

  const resolveAlert = async (id) => {
    try { const r=await alertsAPI.resolve(id); setAlerts(p=>p.map(a=>a._id===id?r.data.alert:a)); }
    catch (err) { console.error(err.message); }
  };

  const updateCaregiver = async (cg) => {
    try { await authAPI.updateCaregiver(cg); await refreshUser(); await loadAll(); }
    catch (err) { console.error(err.message); }
  };

  const handleSOS = async () => {
    if (!window.confirm("Send emergency SOS alert to your caregiver?")) return;
    try {
      const r = await alertsAPI.sos();
      setAlerts(p=>[r.data.alert,...p]);
      speak("SOS alert sent to your caregiver.");
      fireNotif("🆘 SOS Sent", `Caregiver ${user.caregiver?.name} has been notified`);
      alert(`✅ SOS sent to ${user.caregiver?.name} — ${r.data.emailSent?"Email delivered":"Alert logged (email failed — check config)"}`);
    } catch (err) {
      alert("SOS failed: " + (err.response?.data?.message || err.message));
    }
  };

  // ── Nav ──────────────────────────────────────────────────────
  const mainSC  = [SC.DASHBOARD,SC.LIST,SC.ANALYTICS,SC.CAREGIVER,SC.HISTORY];
  const showNav = mainSC.includes(screen);
  const NAV = [
    { s:SC.DASHBOARD, icon:"🏠", label:"Home" },
    { s:SC.LIST,      icon:"💊", label:"Medicines" },
    { s:SC.ANALYTICS, icon:"📊", label:"Analytics" },
    { s:SC.HISTORY,   icon:"📅", label:"History" },
    { s:SC.CAREGIVER, icon:"🔔", label:"Caregiver", badge: alerts.filter(a=>!a.resolved).length },
  ];

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={st.shell}>
      <div style={{...st.area, paddingBottom: showNav ? 68 : 0}}>

        {screen===SC.DASHBOARD&&(
          <Dashboard user={user} logs={logs} todayDate={TODAY} fetching={fetching}
            onMarkTaken={markTaken} onSnooze={snooze} onDeleteLog={deleteLog} onUndoTaken={undoTaken}
            onAddMed={()=>setScreen(SC.ADD)} onViewHistory={()=>setScreen(SC.HISTORY)} onSOS={handleSOS} />
        )}

        {(screen===SC.ADD||screen===SC.EDIT)&&(
          <AddMedicine editing={screen===SC.EDIT?editTarget:null} dupError={dupError}
            onSave={saveMed}
            onCancel={()=>{ setDupError(""); setEditTarget(null); setScreen(screen===SC.EDIT?SC.LIST:SC.DASHBOARD); }} />
        )}

        {screen===SC.LIST&&(
          <MedicineList meds={medicines} logs={logs}
            onAdd={()=>setScreen(SC.ADD)}
            onEdit={med=>{ setEditTarget(med); setDupError(""); setScreen(SC.EDIT); }}
            onDelete={deleteMed} onMarkComplete={completeMed}
            onBack={()=>setScreen(SC.DASHBOARD)} />
        )}

        {screen===SC.ANALYTICS&&(
          <AdherenceAnalytics logs={logs} meds={medicines} todayDate={TODAY}
            onBack={()=>setScreen(SC.DASHBOARD)} />
        )}

        {screen===SC.CAREGIVER&&(
          <CaregiverAlerts alerts={alerts} user={user} logs={logs} meds={medicines}
            onResolve={resolveAlert} onUpdateCaregiver={updateCaregiver}
            onBack={()=>setScreen(SC.DASHBOARD)} onSOS={handleSOS} />
        )}

        {screen===SC.HISTORY&&(
          <HistoryView logs={logs} todayDate={TODAY} onBack={()=>setScreen(SC.DASHBOARD)} />
        )}
      </div>

      {showNav&&(
        <nav style={st.nav}>
          {NAV.map(item=>{
            const active=screen===item.s;
            return (
              <button key={item.s} style={st.ni} onClick={()=>setScreen(item.s)}>
                <div style={{position:"relative",display:"inline-block"}}>
                  <span style={st.nIcon}>{item.icon}</span>
                  {item.badge>0&&<span style={st.nBadge}>{item.badge}</span>}
                </div>
                <span style={{...st.nLabel,...(active?st.nActive:{})}}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {activeReminder&&(
        <ReminderModal dose={activeReminder}
          onTaken={()=>markTaken(activeReminder._id)}
          onSnooze={(_,m)=>snooze(activeReminder._id,m)}
          onSkip={()=>skip(activeReminder._id)}
          onDismiss={()=>setActiveReminder(null)} />
      )}
    </div>
  );
}

function Loader() {
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",background:"#F8FAFC"}}>
      <div style={{fontSize:44,marginBottom:16}}>💊</div>
      <p style={{fontSize:16,color:"#64748B",fontWeight:500}}>Loading MedTrack…</p>
    </div>
  );
}

const st = {
  shell:   {position:"relative",minHeight:"100vh",background:"#F8FAFC",fontFamily:"'DM Sans',system-ui,sans-serif",maxWidth:480,margin:"0 auto",boxShadow:"0 0 40px rgba(0,0,0,0.08)"},
  area:    {minHeight:"100vh",overflowY:"auto"},
  nav:     {position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,display:"flex",background:"#FFF",borderTop:"1px solid #E2E8F0",padding:"8px 0 12px",zIndex:100},
  ni:      {flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0"},
  nIcon:   {fontSize:20},
  nLabel:  {fontSize:10,fontWeight:500,color:"#94A3B8",letterSpacing:"0.02em"},
  nActive: {color:"#1B2B4B",fontWeight:700},
  nBadge:  {position:"absolute",top:-4,right:-6,background:"#DC2626",color:"#FFF",fontSize:9,fontWeight:700,borderRadius:999,padding:"1px 5px",minWidth:16,textAlign:"center",lineHeight:1.6},
};
