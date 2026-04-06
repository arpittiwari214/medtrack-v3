// src/components/MedicineList.jsx — v3 (no mockData imports)
import { useState } from "react";

// ─── Helpers (inline — no external imports needed) ───────────
const FREQ = {
  once_daily:   "Once daily",
  twice_daily:  "Twice daily",
  thrice_daily: "3× daily",
  once_weekly:  "Once weekly",
  custom:       "Custom",
};
const fmtFreq = (v) => FREQ[v] || v;
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
};
const rateColor = (r) => r >= 80 ? "#16A34A" : r >= 50 ? "#D97706" : "#DC2626";
const rateBg    = (r) => r >= 80 ? "#DCFCE7" : r >= 50 ? "#FEF3C7" : "#FEE2E2";
const getMedIcon = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("insulin")) return "💉";
  if (n.includes("vitamin")) return "🟡";
  if (n.includes("syrup") || n.includes("ml")) return "🧪";
  return "💊";
};

// ─── Per-medicine adherence (calculated from logs prop) ───────
function calcPerMed(logs) {
  const map = {};
  logs.forEach(log => {
    if (log.status === "pending" || log.status === "snoozed") return;
    const id = log.medicineId;
    if (!map[id]) map[id] = { medicineId: id, medicineName: log.medicineName, taken: 0, total: 0 };
    map[id].total++;
    if (log.status === "taken") map[id].taken++;
  });
  return Object.values(map).map(m => ({
    ...m,
    rate: m.total === 0 ? 0 : Math.round((m.taken / m.total) * 100),
  }));
}

// ─────────────────────────────────────────────────────────────
// PROPS
//   meds:           Medicine[]   (from App state, loaded via API)
//   logs:           DoseLog[]
//   onAdd, onEdit, onDelete, onMarkComplete, onBack
// ─────────────────────────────────────────────────────────────
export default function MedicineList({ meds = [], logs = [], onAdd, onEdit, onDelete, onMarkComplete, onBack }) {
  const [tab,        setTab]       = useState("active");
  const [confirmId,  setConfirmId] = useState(null);
  const [expandedId, setExpandedId]= useState(null);

  const adhMap    = Object.fromEntries(calcPerMed(logs).map(m => [m.medicineId, m]));
  const activeMeds    = meds.filter(m =>  m.active);
  const completedMeds = meds.filter(m => !m.active);
  const displayed     = tab === "active" ? activeMeds : completedMeds;

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h1 style={s.pageTitle}>Medicines</h1>
        <button style={s.addBtn} onClick={onAdd}>+ Add</button>
      </div>

      {/* Tabs */}
      <div style={s.tabRow}>
        <TabBtn active={tab === "active"}    label={`Active (${activeMeds.length})`}       onClick={() => setTab("active")} />
        <TabBtn active={tab === "completed"} label={`Completed (${completedMeds.length})`} onClick={() => setTab("completed")} />
      </div>

      <div style={s.scrollArea}>
        {displayed.length === 0 && (
          <div style={s.empty}>
            <p style={{ fontSize:40, margin:"0 0 12px" }}>💊</p>
            <p style={s.emptyTitle}>{tab === "active" ? "No active medicines" : "No completed medicines"}</p>
            {tab === "active" && <button style={s.primaryBtn} onClick={onAdd}>Add your first medicine</button>}
          </div>
        )}

        {displayed.map(med => {
          const adh        = adhMap[med._id] || adhMap[med.id];
          const isExpanded = expandedId === (med._id || med.id);
          const medId      = med._id || med.id;

          return (
            <div key={medId} style={s.medCard}>
              {/* Card header */}
              <div style={s.medHeader} onClick={() => setExpandedId(isExpanded ? null : medId)}>
                <div style={s.medIcon}>{getMedIcon(med.name)}</div>
                <div style={{ flex:1 }}>
                  <p style={s.medName}>{med.name}{med.isCritical ? " 🔴" : ""}</p>
                  <p style={s.medSummary}>{med.dosage} · {fmtFreq(med.frequency)}</p>
                </div>
                {adh && (
                  <span style={{ ...s.adherencePill, color:rateColor(adh.rate), background:rateBg(adh.rate) }}>
                    {adh.rate}%
                  </span>
                )}
                <span style={s.chevron}>{isExpanded ? "▲" : "▼"}</span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={s.expandedBody}>
                  <div style={s.detailGrid}>
                    <DetailItem label="Times"        value={(med.times || []).map(fmtTime).join(", ")} />
                    <DetailItem label="Start date"   value={med.startDate || "—"} />
                    <DetailItem label="End date"     value={med.endDate || "Ongoing"} />
                    <DetailItem label="Instructions" value={med.instructions || "None"} />
                  </div>

                  {adh && (
                    <div style={s.adhRow}>
                      <span style={s.adhLabel}>Adherence</span>
                      <div style={s.adhTrack}>
                        <div style={{ ...s.adhFill, width:`${adh.rate}%`, background:rateColor(adh.rate) }} />
                      </div>
                      <span style={{ ...s.adhPct, color:rateColor(adh.rate) }}>{adh.rate}%</span>
                    </div>
                  )}

                  <div style={s.actionRow}>
                    {tab === "active" && (
                      <>
                        <button style={s.editBtn}     onClick={() => onEdit && onEdit(med)}>✏️ Edit</button>
                        <button style={s.completeBtn} onClick={() => onMarkComplete && onMarkComplete(medId)}>✓ Complete</button>
                        <button style={s.deleteBtn}   onClick={() => setConfirmId(medId)}>🗑</button>
                      </>
                    )}
                    {tab === "completed" && (
                      <p style={s.completedNote}>Course completed · Read-only</p>
                    )}
                  </div>
                </div>
              )}

              {/* Delete confirm */}
              {confirmId === medId && (
                <div style={s.confirmBox}>
                  <p style={s.confirmText}>Delete <strong>{med.name}</strong>? All dose history will also be deleted.</p>
                  <div style={s.confirmActions}>
                    <button style={s.cancelBtn}        onClick={() => setConfirmId(null)}>Cancel</button>
                    <button style={s.confirmDeleteBtn} onClick={() => { onDelete && onDelete(medId); setConfirmId(null); }}>Delete</button>
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

// ─── Sub-components ──────────────────────────────────────────
function TabBtn({ active, label, onClick }) {
  return (
    <button style={{ ...s.tabBtn, ...(active ? s.tabBtnActive : {}) }} onClick={onClick}>
      {label}
    </button>
  );
}
function DetailItem({ label, value }) {
  return (
    <div>
      <p style={s.detailLabel}>{label}</p>
      <p style={s.detailValue}>{value}</p>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const C = { navy:"#1B2B4B", slate:"#64748B", border:"#E2E8F0", bg:"#F8FAFC", white:"#FFFFFF", red:"#DC2626", green:"#16A34A", accent:"#3B82F6" };
const s = {
  root:        { minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" },
  topBar:      { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", background:C.white, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:10 },
  pageTitle:   { fontSize:17, fontWeight:700, color:C.navy, margin:0 },
  backBtn:     { background:"transparent", border:"none", color:C.accent, fontSize:15, cursor:"pointer", fontWeight:500, width:60, textAlign:"left", padding:0 },
  addBtn:      { padding:"8px 14px", background:C.navy, color:C.white, border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer" },
  tabRow:      { display:"flex", borderBottom:`1px solid ${C.border}`, background:C.white },
  tabBtn:      { flex:1, padding:"12px 0", background:"transparent", border:"none", borderBottom:"2.5px solid transparent", fontSize:13, fontWeight:500, color:C.slate, cursor:"pointer" },
  tabBtnActive:{ color:C.navy, borderBottomColor:C.navy, fontWeight:700 },
  scrollArea:  { padding:"14px 14px 48px", maxWidth:480, width:"100%", margin:"0 auto" },
  medCard:     { background:C.white, borderRadius:14, marginBottom:10, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", overflow:"hidden" },
  medHeader:   { display:"flex", alignItems:"center", gap:12, padding:"14px 16px", cursor:"pointer" },
  medIcon:     { width:38, height:38, borderRadius:9, background:"#F1F5F9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 },
  medName:     { fontSize:14, fontWeight:700, color:C.navy, margin:"0 0 2px" },
  medSummary:  { fontSize:12, color:C.slate, margin:0 },
  adherencePill:{ fontSize:12, fontWeight:700, padding:"3px 9px", borderRadius:999 },
  chevron:     { fontSize:11, color:C.slate, marginLeft:4 },
  expandedBody:{ borderTop:`1px solid ${C.border}`, padding:"14px 16px" },
  detailGrid:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 16px", marginBottom:14 },
  detailLabel: { fontSize:11, color:C.slate, margin:"0 0 2px", textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:600 },
  detailValue: { fontSize:13, color:C.navy, fontWeight:500, margin:0 },
  adhRow:      { display:"flex", alignItems:"center", gap:10, marginBottom:14 },
  adhLabel:    { fontSize:12, color:C.slate, minWidth:72 },
  adhTrack:    { flex:1, height:6, background:C.border, borderRadius:999, overflow:"hidden" },
  adhFill:     { height:"100%", borderRadius:999, transition:"width 0.3s" },
  adhPct:      { fontSize:12, fontWeight:700, minWidth:36, textAlign:"right" },
  actionRow:   { display:"flex", gap:8, alignItems:"center" },
  editBtn:     { padding:"7px 13px", background:"#EFF6FF", color:C.accent, border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer" },
  completeBtn: { padding:"7px 13px", background:"#F0FDF4", color:C.green, border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer" },
  deleteBtn:   { padding:"7px 11px", background:"#FEF2F2", border:"none", borderRadius:8, fontSize:14, cursor:"pointer", marginLeft:"auto" },
  completedNote:{ fontSize:13, color:C.slate, fontStyle:"italic", margin:0 },
  confirmBox:  { borderTop:`1px solid #FECACA`, background:"#FEF2F2", padding:"14px 16px" },
  confirmText: { fontSize:13, color:"#7F1D1D", margin:"0 0 12px", lineHeight:1.5 },
  confirmActions:{ display:"flex", gap:8 },
  cancelBtn:   { flex:1, padding:"9px", background:C.white, color:C.slate, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer" },
  confirmDeleteBtn:{ flex:1, padding:"9px", background:C.red, color:C.white, border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" },
  empty:       { textAlign:"center", padding:"52px 20px" },
  emptyTitle:  { fontSize:15, fontWeight:600, color:C.navy, margin:"0 0 16px" },
  primaryBtn:  { padding:"11px 22px", background:C.navy, color:C.white, border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer" },
};
