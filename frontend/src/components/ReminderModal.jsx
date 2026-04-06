// src/components/ReminderModal.jsx — v3 (no mockData imports)
import { useState } from "react";

const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h%12===0?12:h%12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
};

const addMins = (time24, mins) => {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const d = new Date(); d.setHours(h, m + mins, 0);
  return d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
};

const SNOOZE_OPTIONS = [
  { label:"5 min",  value:5  },
  { label:"10 min", value:10 },
  { label:"15 min", value:15 },
  { label:"30 min", value:30 },
];

// ─────────────────────────────────────────────────────────────
// PROPS
//   dose:      DoseLog object (uses _id for MongoDB)
//   onTaken:   () => void
//   onSnooze:  (dose, minutes) => void
//   onSkip:    () => void
//   onDismiss: () => void
// ─────────────────────────────────────────────────────────────
export default function ReminderModal({ dose, onTaken, onSnooze, onSkip, onDismiss }) {
  const [view,    setView]    = useState("main"); // main | snooze | confirm_skip | done
  const [feedback,setFeedback]= useState("");

  if (!dose) return null;

  const handleTaken = () => {
    setFeedback(`✓ ${dose.medicineName} marked as taken`);
    setView("done");
    onTaken && onTaken();
  };

  const handleSnooze = (minutes) => {
    setFeedback(`⏰ Snoozed for ${minutes} minutes`);
    setView("done");
    onSnooze && onSnooze(dose, minutes);
  };

  const handleSkip = () => {
    setFeedback("Dose skipped");
    setView("done");
    onSkip && onSkip();
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onDismiss && onDismiss()}>
      <div style={s.sheet}>
        <div style={s.handle} />

        {/* ─── MAIN ─── */}
        {view === "main" && (
          <>
            <div style={s.pulseRing}><span style={{ fontSize:36 }}>💊</span></div>
            <p style={s.label}>Time to take</p>
            <h2 style={s.medName}>{dose.medicineName}</h2>
            <p style={s.dosage}>{dose.dosage || "As prescribed"}</p>
            <div style={s.timeChip}>
              <span style={s.timeChipDot} />
              Scheduled for {fmtTime(dose.scheduledTime)}
              {dose.isCritical && " 🔴"}
            </div>
            {dose.instructions && (
              <div style={s.instrBox}>
                <span style={{ fontSize:16 }}>ℹ️</span>
                <span style={s.instrText}>{dose.instructions}</span>
              </div>
            )}
            <button style={s.takenBtn} onClick={handleTaken}>✓  Mark as taken</button>
            <div style={s.secondaryRow}>
              <button style={s.snoozeBtn} onClick={() => setView("snooze")}>⏰ Snooze</button>
              <button style={s.skipBtn}   onClick={() => setView("confirm_skip")}>Skip dose</button>
            </div>
          </>
        )}

        {/* ─── SNOOZE ─── */}
        {view === "snooze" && (
          <>
            <p style={s.sheetTitle}>Remind me again in…</p>
            <div style={s.snoozeGrid}>
              {SNOOZE_OPTIONS.map(o => (
                <button key={o.value} style={s.snoozeOption} onClick={() => handleSnooze(o.value)}>
                  <span style={{ fontSize:16, fontWeight:700, color:"#1B2B4B" }}>{o.label}</span>
                  <span style={{ fontSize:12, color:"#64748B" }}>{addMins(dose.scheduledTime, o.value)}</span>
                </button>
              ))}
            </div>
            <button style={s.backLink} onClick={() => setView("main")}>← Back</button>
          </>
        )}

        {/* ─── CONFIRM SKIP ─── */}
        {view === "confirm_skip" && (
          <>
            <div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
            <h3 style={s.warnTitle}>Skip this dose?</h3>
            <p style={s.warnBody}>
              Skipping will be recorded. Your caregiver may be notified if you miss multiple doses in a row.
            </p>
            <button style={s.confirmSkipBtn} onClick={handleSkip}>Yes, skip this dose</button>
            <button style={s.backLink} onClick={() => setView("main")}>← Back</button>
          </>
        )}

        {/* ─── DONE ─── */}
        {view === "done" && (
          <>
            <div style={s.doneCircle}>
              {feedback.startsWith("✓") ? "✓" : feedback.startsWith("⏰") ? "⏰" : "–"}
            </div>
            <p style={s.doneText}>{feedback}</p>
            <button style={s.doneBtn} onClick={onDismiss}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay:     { position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:1000, backdropFilter:"blur(2px)" },
  sheet:       { background:"#FFFFFF", borderRadius:"24px 24px 0 0", padding:"12px 28px 48px", width:"100%", maxWidth:480, display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", fontFamily:"'DM Sans',system-ui,sans-serif" },
  handle:      { width:40, height:4, borderRadius:2, background:"#E2E8F0", margin:"8px 0 24px" },
  pulseRing:   { width:80, height:80, borderRadius:"50%", background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 },
  label:       { fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 6px" },
  medName:     { fontSize:24, fontWeight:700, color:"#1B2B4B", margin:"0 0 6px", lineHeight:1.2 },
  dosage:      { fontSize:14, color:"#64748B", margin:"0 0 14px" },
  timeChip:    { display:"inline-flex", alignItems:"center", gap:6, background:"#F1F5F9", borderRadius:999, padding:"6px 14px", fontSize:13, color:"#1B2B4B", fontWeight:500, marginBottom:14 },
  timeChipDot: { width:7, height:7, borderRadius:"50%", background:"#F59E0B", flexShrink:0 },
  instrBox:    { display:"flex", alignItems:"center", gap:8, background:"#FEF9EC", border:"1px solid #FDE68A", borderRadius:10, padding:"10px 14px", marginBottom:18, width:"100%", boxSizing:"border-box", textAlign:"left" },
  instrText:   { fontSize:13, color:"#92400E", lineHeight:1.5 },
  takenBtn:    { width:"100%", padding:"15px", background:"#16A34A", color:"#FFFFFF", border:"none", borderRadius:14, fontSize:16, fontWeight:700, cursor:"pointer", marginBottom:12, letterSpacing:"0.01em" },
  secondaryRow:{ display:"flex", gap:10, width:"100%" },
  snoozeBtn:   { flex:1, padding:"13px", background:"#FEF3C7", color:"#92400E", border:"none", borderRadius:12, fontSize:14, fontWeight:600, cursor:"pointer" },
  skipBtn:     { flex:1, padding:"13px", background:"transparent", color:"#64748B", border:"1.5px solid #E2E8F0", borderRadius:12, fontSize:14, fontWeight:500, cursor:"pointer" },
  sheetTitle:  { fontSize:17, fontWeight:700, color:"#1B2B4B", margin:"0 0 20px" },
  snoozeGrid:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, width:"100%", marginBottom:18 },
  snoozeOption:{ padding:"16px 12px", background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:12, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 },
  backLink:    { background:"transparent", border:"none", color:"#64748B", fontSize:14, cursor:"pointer", padding:"8px 0" },
  warnTitle:   { fontSize:19, fontWeight:700, color:"#1B2B4B", margin:"0 0 10px" },
  warnBody:    { fontSize:13, color:"#64748B", lineHeight:1.6, margin:"0 0 24px", maxWidth:300 },
  confirmSkipBtn:{ width:"100%", padding:"13px", background:"#FEE2E2", color:"#DC2626", border:"1.5px solid #FECACA", borderRadius:12, fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:10 },
  doneCircle:  { width:64, height:64, borderRadius:"50%", background:"#DCFCE7", color:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:700, marginBottom:16 },
  doneText:    { fontSize:15, fontWeight:500, color:"#1B2B4B", margin:"0 0 24px" },
  doneBtn:     { width:"100%", padding:"13px", background:"#1B2B4B", color:"#FFFFFF", border:"none", borderRadius:12, fontSize:14, fontWeight:600, cursor:"pointer" },
};
