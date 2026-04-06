// src/components/HistoryView.jsx — v3 (no mockData imports)
import { useState } from "react";

// ─── Inline helpers ──────────────────────────────────────────
const getLastNDays = (today, n) => {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
};
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h%12===0?12:h%12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
};
const calColor = (rate) => {
  if (rate === null || rate === undefined) return "#F1F5F9";
  if (rate === 100) return "#DCFCE7";
  if (rate >= 50)  return "#FEF3C7";
  return "#FEE2E2";
};
const fmtDayTitle = (date, today) => {
  if (date === today) return "Today";
  const yd = new Date(today); yd.setDate(yd.getDate()-1);
  if (date === yd.toISOString().split("T")[0]) return "Yesterday";
  return new Date(date).toLocaleDateString("en", { weekday:"long", month:"long", day:"numeric" });
};

// ─────────────────────────────────────────────────────────────
// PROPS
//   logs:      DoseLog[]
//   todayDate: string "YYYY-MM-DD"
//   onBack:    () => void
// ─────────────────────────────────────────────────────────────
export default function HistoryView({ logs = [], todayDate, onBack }) {
  const days28   = getLastNDays(todayDate, 28);
  const [selected, setSelected] = useState(todayDate);

  // Build per-day summary map
  const dayMap = {};
  days28.forEach(date => {
    const dl      = logs.filter(l => l.date === date);
    const settled = dl.filter(l => l.status !== "pending" && l.status !== "snoozed");
    const taken   = settled.filter(l => l.status === "taken").length;
    const total   = settled.length;
    dayMap[date]  = { taken, total, logs: dl, rate: total === 0 ? null : Math.round((taken/total)*100) };
  });

  const selectedDay = dayMap[selected] || { taken:0, total:0, logs:[], rate:null };

  // Build grid with leading padding to align to weekday
  const firstDay = new Date(days28[0]).getDay();
  const gridItems = [...Array(firstDay).fill(null), ...days28];

  return (
    <div style={s.root}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h1 style={s.pageTitle}>History</h1>
        <div style={{ width:60 }} />
      </div>

      <div style={s.scrollArea}>
        {/* Calendar heatmap */}
        <div style={s.calCard}>
          <p style={s.calLabel}>Last 28 days</p>
          <div style={s.weekdayRow}>
            {["S","M","T","W","T","F","S"].map((d,i) => (
              <div key={i} style={s.weekdayCell}>{d}</div>
            ))}
          </div>
          <div style={s.calGrid}>
            {gridItems.map((item, i) =>
              item === null ? (
                <div key={`pad-${i}`} style={s.calEmpty} />
              ) : (
                <button
                  key={item}
                  style={{
                    ...s.calDay,
                    background: calColor(dayMap[item]?.rate),
                    border: item === selected ? "2px solid #1B2B4B" : "2px solid transparent",
                  }}
                  onClick={() => setSelected(item)}
                  title={item}
                >
                  <span style={s.calDayNum}>{new Date(item).getDate()}</span>
                </button>
              )
            )}
          </div>
          {/* Legend */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {[["#DCFCE7","100%"],["#FEF3C7","50–99%"],["#FEE2E2","< 50%"],["#F1F5F9","No data"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:c, border:"1px solid #E2E8F0" }} />
                <span style={{ fontSize:11, color:"#64748B" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected day log */}
        <div style={s.daySection}>
          <p style={s.dayTitle}>{fmtDayTitle(selected, todayDate)}</p>

          {/* Summary chips */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
            <Chip label={`${selectedDay.taken} taken`}  color="#16A34A" bg="#DCFCE7" />
            <Chip label={`${selectedDay.logs.filter(l=>l.status==="missed").length} missed`} color="#DC2626" bg="#FEE2E2" />
            {selectedDay.rate !== null && <Chip label={`${selectedDay.rate}% adherence`} color="#1B2B4B" bg="#F1F5F9" />}
          </div>

          {selectedDay.logs.length === 0 ? (
            <p style={{ fontSize:13, color:"#64748B", textAlign:"center", padding:"20px 0" }}>No doses recorded for this day.</p>
          ) : (
            [...selectedDay.logs]
              .sort((a,b) => (a.scheduledTime||"").localeCompare(b.scheduledTime||""))
              .map(dose => <DoseRow key={dose._id||dose.id} dose={dose} />)
          )}
        </div>
      </div>
    </div>
  );
}

function DoseRow({ dose }) {
  const cfg = {
    taken:   { dot:"#16A34A", bg:"#F0FDF4", border:"#BBF7D0", label:"Taken" },
    missed:  { dot:"#DC2626", bg:"#FEF2F2", border:"#FECACA", label:"Missed" },
    pending: { dot:"#F59E0B", bg:"#FFFBEB", border:"#FDE68A", label:"Pending" },
    snoozed: { dot:"#F59E0B", bg:"#FFFBEB", border:"#FDE68A", label:"Snoozed" },
  }[dose.status] || { dot:"#94A3B8", bg:"#F8FAFC", border:"#E2E8F0", label:"—" };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, borderRadius:10, border:`1.5px solid ${cfg.border}`, background:cfg.bg, padding:"10px 13px", marginBottom:8 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:cfg.dot, flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <p style={{ fontSize:13, fontWeight:600, color:"#1B2B4B", margin:"0 0 2px" }}>{dose.medicineName}</p>
        <p style={{ fontSize:11, color:"#64748B", margin:0 }}>
          Scheduled {fmtTime(dose.scheduledTime)}
          {dose.actualTime && dose.status === "taken" ? ` · Taken at ${fmtTime(dose.actualTime)}` : ""}
        </p>
      </div>
      <span style={{ fontSize:12, fontWeight:700, color:cfg.dot }}>{cfg.label}</span>
    </div>
  );
}

function Chip({ label, color, bg }) {
  return <span style={{ fontSize:12, fontWeight:600, color, background:bg, padding:"4px 10px", borderRadius:999 }}>{label}</span>;
}

const s = {
  root:       { minHeight:"100vh", background:"#F8FAFC", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" },
  topBar:     { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", background:"#FFFFFF", borderBottom:"1px solid #E2E8F0", position:"sticky", top:0, zIndex:10 },
  pageTitle:  { fontSize:17, fontWeight:700, color:"#1B2B4B", margin:0 },
  backBtn:    { background:"transparent", border:"none", color:"#3B82F6", fontSize:15, cursor:"pointer", fontWeight:500, width:60, textAlign:"left", padding:0 },
  scrollArea: { padding:"14px 14px 48px", maxWidth:480, width:"100%", margin:"0 auto" },
  calCard:    { background:"#FFFFFF", borderRadius:14, padding:"16px", marginBottom:14, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  calLabel:   { fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 12px" },
  weekdayRow: { display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 },
  weekdayCell:{ textAlign:"center", fontSize:10, color:"#64748B", fontWeight:600, padding:"0 0 4px" },
  calGrid:    { display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:12 },
  calEmpty:   { aspectRatio:"1" },
  calDay:     { aspectRatio:"1", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0, transition:"border 0.1s" },
  calDayNum:  { fontSize:10, fontWeight:600, color:"#1B2B4B" },
  daySection: { background:"#FFFFFF", borderRadius:14, padding:"16px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  dayTitle:   { fontSize:15, fontWeight:700, color:"#1B2B4B", margin:"0 0 10px" },
};
