// src/components/CaregiverAlerts.jsx — v3 (no mockData imports)
import { useState } from "react";
import { authAPI } from "../api/index";

// ─────────────────────────────────────────────────────────────
// PROPS
//   alerts:            CaregiverAlert[]
//   user:              UserObject
//   logs:              DoseLog[]
//   meds:              Medicine[]
//   onResolve:         (alertId) => void
//   onUpdateCaregiver: (cg) => void
//   onBack:            () => void
//   onSOS:             () => void
// ─────────────────────────────────────────────────────────────
export default function CaregiverAlerts({ alerts = [], user, logs = [], meds = [], onResolve, onUpdateCaregiver, onBack, onSOS }) {
  const [tab,              setTab]              = useState("alerts");
  const [editingCaregiver, setEditingCaregiver] = useState(false);
  const [cgForm,           setCgForm]           = useState({ name:"", email:"", relation:"", ...(user?.caregiver || {}) });
  const [busy,             setBusy]             = useState(false);
  const [cgError,          setCgError]          = useState("");

  const activeAlerts   = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a =>  a.resolved);

  const handleCgSave = async () => {
    if (!cgForm.name || !cgForm.email) { setCgError("Name and email required"); return; }
    setBusy(true);
    try {
      await authAPI.updateCaregiver(cgForm);
      onUpdateCaregiver && await onUpdateCaregiver(cgForm);
      setEditingCaregiver(false);
      setCgError("");
    } catch (err) {
      setCgError(err.response?.data?.message || "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const fmtTime = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleString("en", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }); }
    catch { return ts; }
  };

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h1 style={s.pageTitle}>Caregiver</h1>
        <button style={s.sosBtn} onClick={onSOS}>🆘 SOS</button>
      </div>

      {/* Tabs */}
      <div style={s.tabRow}>
        <TabBtn active={tab==="alerts"}    label="Alerts"  badge={activeAlerts.length} onClick={() => setTab("alerts")} />
        <TabBtn active={tab==="caregiver"} label="Contact"                             onClick={() => setTab("caregiver")} />
      </div>

      <div style={s.scrollArea}>

        {/* ─── ALERTS TAB ─── */}
        {tab === "alerts" && (
          <>
            {activeAlerts.length === 0 && resolvedAlerts.length === 0 && (
              <EmptyState icon="🔔" title="No alerts" sub="Your caregiver is only notified after 2+ consecutive missed doses." />
            )}
            {activeAlerts.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <SectionLabel text="Active" />
                {activeAlerts.map(a => (
                  <AlertCard key={a._id||a.id} alert={a} type="active" onResolve={() => onResolve && onResolve(a._id||a.id)} fmtTime={fmtTime} />
                ))}
              </div>
            )}
            {resolvedAlerts.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <SectionLabel text="Resolved" />
                {resolvedAlerts.map(a => (
                  <AlertCard key={a._id||a.id} alert={a} type="resolved" fmtTime={fmtTime} />
                ))}
              </div>
            )}
            <div style={s.infoBox}>
              <p style={s.infoTitle}>How alerts work</p>
              <p style={s.infoText}>Your caregiver receives an email after 2 consecutive missed doses of the same medicine. Critical medicines trigger after 1 missed dose.</p>
            </div>
          </>
        )}

        {/* ─── CAREGIVER TAB ─── */}
        {tab === "caregiver" && (
          <>
            {!editingCaregiver ? (
              <>
                <div style={s.cgCard}>
                  <div style={s.cgAvatar}>{(user?.caregiver?.name?.[0] || "?").toUpperCase()}</div>
                  <div>
                    <p style={s.cgName}>{user?.caregiver?.name || "Not set"}</p>
                    <p style={s.cgRelation}>{user?.caregiver?.relation || "Caregiver"}</p>
                  </div>
                </div>
                <InfoRow label="Email"    value={user?.caregiver?.email    || "Not set"} />
                <InfoRow label="Relation" value={user?.caregiver?.relation || "Not set"} />
                <div style={{ marginTop:16, marginBottom:8 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.07em", margin:"0 0 6px" }}>Alert policy</p>
                  <p style={{ fontSize:14, color:"#1B2B4B", lineHeight:1.6, margin:"0 0 16px" }}>
                    Notified after <strong>2 consecutive missed doses</strong> of any medicine, or <strong>1 miss</strong> for critical medicines.
                  </p>
                </div>
                <button style={s.editBtn} onClick={() => { setCgForm({ ...(user?.caregiver||{}) }); setEditingCaregiver(true); }}>
                  Edit caregiver details
                </button>
              </>
            ) : (
              <div style={s.editCard}>
                <p style={s.editTitle}>Edit caregiver</p>
                {cgError && <div style={s.errorBox}>{cgError}</div>}
                <Field label="Name *">
                  <input style={s.input} value={cgForm.name||""} placeholder="Caregiver name"
                    onChange={e => { setCgForm(p=>({...p,name:e.target.value})); setCgError(""); }} />
                </Field>
                <Field label="Email *">
                  <input style={s.input} type="email" value={cgForm.email||""} placeholder="caregiver@email.com"
                    onChange={e => { setCgForm(p=>({...p,email:e.target.value})); setCgError(""); }} />
                </Field>
                <Field label="Relation">
                  <input style={s.input} value={cgForm.relation||""} placeholder="e.g. Daughter, Spouse"
                    onChange={e => setCgForm(p=>({...p,relation:e.target.value}))} />
                </Field>
                <div style={{ display:"flex", gap:10 }}>
                  <button style={s.cancelBtn} onClick={() => { setEditingCaregiver(false); setCgError(""); }}>Cancel</button>
                  <button style={{ ...s.primaryBtn, flex:1, opacity:busy?0.7:1 }} onClick={handleCgSave} disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function AlertCard({ alert, type, onResolve, fmtTime }) {
  const isActive = type === "active";
  return (
    <div style={{ ...s.alertCard, ...(isActive ? s.alertActive : s.alertResolved) }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:4 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, marginTop:5, background: isActive ? "#DC2626" : "#94A3B8" }} />
        <p style={{ fontSize:13, fontWeight:500, color:"#1B2B4B", margin:0, lineHeight:1.5 }}>{alert.message}</p>
      </div>
      <p style={{ fontSize:11, color:"#64748B", margin:"4px 0 8px 18px" }}>{fmtTime(alert.createdAt || alert.timestamp)}</p>
      {isActive && onResolve && (
        <button style={s.resolveBtn} onClick={onResolve}>Mark resolved</button>
      )}
      {!isActive && <span style={{ marginLeft:18, fontSize:12, color:"#64748B", fontStyle:"italic" }}>Resolved</span>}
    </div>
  );
}
function TabBtn({ active, label, badge, onClick }) {
  return (
    <button style={{ ...s.tabBtn, ...(active ? s.tabBtnActive : {}) }} onClick={onClick}>
      {label}
      {badge > 0 && <span style={s.badge}>{badge}</span>}
    </button>
  );
}
function SectionLabel({ text }) {
  return <p style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px" }}>{text}</p>;
}
function InfoRow({ label, value }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", background:"#FFFFFF", borderRadius:10, marginBottom:8, boxShadow:"0 1px 2px rgba(0,0,0,0.04)" }}>
      <span style={{ fontSize:13, color:"#64748B" }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:500, color:"#1B2B4B" }}>{value}</span>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#1B2B4B", marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"40px 20px" }}>
      <p style={{ fontSize:40, margin:"0 0 12px" }}>{icon}</p>
      <p style={{ fontSize:15, fontWeight:600, color:"#1B2B4B", margin:"0 0 6px" }}>{title}</p>
      <p style={{ fontSize:13, color:"#64748B", lineHeight:1.6, margin:0 }}>{sub}</p>
    </div>
  );
}

const s = {
  root:        { minHeight:"100vh", background:"#F8FAFC", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" },
  topBar:      { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px", background:"#FFFFFF", borderBottom:"1px solid #E2E8F0", position:"sticky", top:0, zIndex:10 },
  pageTitle:   { fontSize:17, fontWeight:700, color:"#1B2B4B", margin:0 },
  backBtn:     { background:"transparent", border:"none", color:"#3B82F6", fontSize:15, cursor:"pointer", fontWeight:500, width:60, textAlign:"left", padding:0 },
  sosBtn:      { padding:"7px 12px", background:"#FEF2F2", color:"#DC2626", border:"1.5px solid #FECACA", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" },
  tabRow:      { display:"flex", borderBottom:"1px solid #E2E8F0", background:"#FFFFFF" },
  tabBtn:      { flex:1, padding:"12px 0", background:"transparent", border:"none", borderBottom:"2.5px solid transparent", fontSize:14, fontWeight:500, color:"#64748B", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 },
  tabBtnActive:{ color:"#1B2B4B", borderBottomColor:"#1B2B4B", fontWeight:700 },
  badge:       { background:"#DC2626", color:"#FFFFFF", fontSize:11, fontWeight:700, borderRadius:999, padding:"1px 6px" },
  scrollArea:  { padding:"14px 14px 48px", maxWidth:480, width:"100%", margin:"0 auto" },
  alertCard:   { borderRadius:12, padding:"12px 14px", marginBottom:10 },
  alertActive: { background:"#FFFFFF", border:"1.5px solid #FECACA", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" },
  alertResolved:{ background:"#F8FAFC", border:"1px solid #E2E8F0" },
  resolveBtn:  { marginLeft:18, padding:"5px 12px", background:"#DCFCE7", color:"#16A34A", border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer" },
  infoBox:     { background:"#F0F9FF", border:"1px solid #BAE6FD", borderRadius:12, padding:"14px 16px", marginTop:4 },
  infoTitle:   { fontSize:13, fontWeight:700, color:"#0369A1", margin:"0 0 4px" },
  infoText:    { fontSize:13, color:"#0369A1", lineHeight:1.6, margin:0 },
  cgCard:      { display:"flex", alignItems:"center", gap:14, background:"#FFFFFF", borderRadius:14, padding:"16px", marginBottom:12, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  cgAvatar:    { width:46, height:46, borderRadius:"50%", background:"#EFF6FF", color:"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, flexShrink:0 },
  cgName:      { fontSize:16, fontWeight:700, color:"#1B2B4B", margin:"0 0 2px" },
  cgRelation:  { fontSize:13, color:"#64748B", margin:0 },
  editBtn:     { width:"100%", padding:"12px", background:"#EFF6FF", color:"#3B82F6", border:"1.5px solid #BFDBFE", borderRadius:12, fontSize:14, fontWeight:600, cursor:"pointer" },
  editCard:    { background:"#FFFFFF", borderRadius:14, padding:"18px 16px", boxShadow:"0 1px 3px rgba(0,0,0,0.07)" },
  editTitle:   { fontSize:16, fontWeight:700, color:"#1B2B4B", margin:"0 0 14px" },
  errorBox:    { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#DC2626", marginBottom:14 },
  input:       { width:"100%", padding:"10px 13px", fontSize:14, border:"1.5px solid #E2E8F0", borderRadius:10, outline:"none", color:"#1B2B4B", background:"#FFFFFF", boxSizing:"border-box", fontFamily:"inherit" },
  primaryBtn:  { padding:"12px", background:"#1B2B4B", color:"#FFFFFF", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer" },
  cancelBtn:   { padding:"12px 18px", background:"transparent", color:"#64748B", border:"1.5px solid #E2E8F0", borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer" },
};
