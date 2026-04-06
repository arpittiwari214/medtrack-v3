// src/components/AdherenceAnalytics.jsx — v3 (no mockData imports)
import { useState } from "react";

// ─── Inline helpers ──────────────────────────────────────────
const calcRate = (logs) => {
  const s = logs.filter(l => l.status !== "pending" && l.status !== "snoozed");
  if (!s.length) return 0;
  return Math.round((s.filter(l => l.status === "taken").length / s.length) * 100);
};

const calcPerMed = (logs) => {
  const map = {};
  logs.forEach(l => {
    if (l.status === "pending" || l.status === "snoozed") return;
    const id = l.medicineId;
    if (!map[id]) map[id] = { medicineId: id, medicineName: l.medicineName, taken: 0, total: 0 };
    map[id].total++;
    if (l.status === "taken") map[id].taken++;
  });
  return Object.values(map).map(m => ({ ...m, rate: m.total === 0 ? 0 : Math.round((m.taken / m.total) * 100) }));
};

const calcStreak = (logs, today) => {
  const byDate = {};
  logs.forEach(l => {
    if (l.status === "pending" || l.status === "snoozed") return;
    if (!byDate[l.date]) byDate[l.date] = { taken:0, total:0 };
    byDate[l.date].total++;
    if (l.status === "taken") byDate[l.date].taken++;
  });
  let streak = 0;
  const d = new Date(today);
  while (true) {
    const key = d.toISOString().split("T")[0];
    const day = byDate[key];
    if (!day || day.taken < day.total) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
};

const getLastNDays = (today, n) => {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
};

const rateColor = (r) => r >= 80 ? "#16A34A" : r >= 50 ? "#F59E0B" : "#DC2626";
const shortDate = (ds) => {
  const d = new Date(ds);
  return `${d.toLocaleString("en",{month:"short"})} ${d.getDate()}`;
};

// ─────────────────────────────────────────────────────────────
// PROPS
//   logs:      DoseLog[]
//   meds:      Medicine[]
//   todayDate: string
//   onBack:    () => void
// ─────────────────────────────────────────────────────────────
export default function AdherenceAnalytics({ logs = [], meds = [], todayDate, onBack }) {
  const [range, setRange] = useState(7);

  const overallRate  = calcRate(logs);
  const streak       = calcStreak(logs, todayDate);
  const perMed       = calcPerMed(logs);
  const days         = getLastNDays(todayDate, range);

  const dailyData = days.map(date => {
    const dl  = logs.filter(l => l.date === date && l.status !== "pending" && l.status !== "snoozed");
    const tk  = dl.filter(l => l.status === "taken").length;
    const tot = dl.length;
    return { date, taken: tk, total: tot, rate: tot === 0 ? null : Math.round((tk / tot) * 100) };
  });

  // Pattern insight
  const missed = logs.filter(l => l.status === "missed");
  const eveningMiss = missed.filter(l => parseInt(l.scheduledTime?.split(":")[0]||"0") >= 18).length;
  const morningMiss = missed.filter(l => parseInt(l.scheduledTime?.split(":")[0]||"0") < 12).length;
  let insight = null;
  if (eveningMiss > morningMiss && eveningMiss > 0)
    insight = `You miss evening doses most often (${eveningMiss} times). Try setting a backup reminder 30 min earlier.`;
  else if (morningMiss > 0)
    insight = `You occasionally miss morning doses (${morningMiss} times). Try pairing them with breakfast.`;

  return (
    <div style={s.root}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h1 style={s.pageTitle}>Analytics</h1>
        <div style={{ width:60 }} />
      </div>

      <div style={s.scrollArea}>
        {/* Hero */}
        <div style={s.heroCard}>
          <p style={s.heroLabel}>Overall adherence</p>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <span style={s.heroRate}>{overallRate}%</span>
            <RateBadge rate={overallRate} />
          </div>
          <ProgressBar value={overallRate} color={rateColor(overallRate)} />
          <p style={s.heroSub}>Based on {logs.filter(l => l.status !== "pending").length} recorded doses</p>
        </div>

        {/* Summary row */}
        <div style={s.summaryRow}>
          <SummaryCard value={streak} label="Day streak" icon="🔥" color="#F97316" bg="#FFF7ED" />
          <SummaryCard value={logs.filter(l=>l.status==="taken").length}  label="Total taken"  icon="✓" color="#16A34A" bg="#F0FDF4" />
          <SummaryCard value={logs.filter(l=>l.status==="missed").length} label="Total missed" icon="✕" color="#DC2626" bg="#FEF2F2" />
        </div>

        {/* Bar chart */}
        <Section title="Daily trend">
          <div style={{ display:"flex", gap:6, marginBottom:14 }}>
            {[7,30].map(r => (
              <button key={r} style={{ ...s.rangeBtn, ...(range===r ? s.rangeBtnActive:{}) }} onClick={() => setRange(r)}>{r}d</button>
            ))}
          </div>
          <div style={s.chartWrap}>
            {dailyData.map(d => (
              <div key={d.date} style={s.barCol}>
                <div style={s.barTrack}>
                  <div style={{
                    ...s.bar,
                    height: d.rate === null ? 4 : `${d.rate}%`,
                    background: d.rate === null ? "#E2E8F0" : d.rate === 100 ? "#16A34A" : d.rate >= 50 ? "#F59E0B" : "#DC2626",
                  }} />
                </div>
                <p style={s.barLabel}>{shortDate(d.date)}</p>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:8 }}>
            {[["#16A34A","100%"],["#F59E0B","50–99%"],["#DC2626","< 50%"],["#E2E8F0","No data"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:c }} />
                <span style={{ fontSize:11, color:"#64748B" }}>{l}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Per-medicine */}
        <Section title="By medicine">
          {perMed.length === 0 && <p style={{ fontSize:13, color:"#64748B", margin:0 }}>No data yet. Add medicines to track adherence.</p>}
          {perMed.map(m => (
            <div key={m.medicineId} style={s.medRow}>
              <div style={{ flex:1 }}>
                <p style={s.medName}>{m.medicineName}</p>
                <p style={s.medStats}>{m.taken} of {m.total} doses taken</p>
              </div>
              <div style={s.medRateCol}>
                <span style={{ fontSize:14, fontWeight:700, color:rateColor(m.rate) }}>{m.rate}%</span>
                <div style={s.miniTrack}>
                  <div style={{ height:"100%", width:`${m.rate}%`, background:rateColor(m.rate), borderRadius:999, transition:"width 0.3s" }} />
                </div>
              </div>
            </div>
          ))}
        </Section>

        {/* Insight */}
        {insight && (
          <div style={s.insightBox}>
            <p style={s.insightTitle}>💡 Pattern detected</p>
            <p style={s.insightText}>{insight}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <p style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px 4px" }}>{title}</p>
      <div style={{ background:"#FFFFFF", borderRadius:14, padding:"16px 14px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>{children}</div>
    </div>
  );
}
function ProgressBar({ value, color }) {
  return (
    <div style={{ height:8, background:"#E2E8F0", borderRadius:999, overflow:"hidden", marginBottom:10 }}>
      <div style={{ height:"100%", width:`${value}%`, background:color, borderRadius:999, transition:"width 0.4s" }} />
    </div>
  );
}
function SummaryCard({ value, label, icon, color, bg }) {
  return (
    <div style={{ borderRadius:12, padding:"14px 10px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:bg }}>
      <span style={{ fontSize:20 }}>{icon}</span>
      <p style={{ fontSize:22, fontWeight:700, color, margin:0 }}>{value}</p>
      <p style={{ fontSize:11, color:"#64748B", margin:0 }}>{label}</p>
    </div>
  );
}
function RateBadge({ rate }) {
  const { label, color, bg } = rate >= 80 ? { label:"Good", color:"#16A34A", bg:"#DCFCE7" } : rate >= 50 ? { label:"Fair", color:"#D97706", bg:"#FEF3C7" } : { label:"Low", color:"#DC2626", bg:"#FEE2E2" };
  return <span style={{ fontSize:12, fontWeight:700, padding:"4px 10px", borderRadius:999, color, background:bg }}>{label}</span>;
}

const s = {
  root:       { minHeight:"100vh", background:"#F8FAFC", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" },
  topBar:     { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", background:"#FFFFFF", borderBottom:"1px solid #E2E8F0", position:"sticky", top:0, zIndex:10 },
  pageTitle:  { fontSize:17, fontWeight:700, color:"#1B2B4B", margin:0 },
  backBtn:    { background:"transparent", border:"none", color:"#3B82F6", fontSize:15, cursor:"pointer", fontWeight:500, width:60, textAlign:"left", padding:0 },
  scrollArea: { padding:"14px 14px 48px", maxWidth:480, width:"100%", margin:"0 auto" },
  heroCard:   { background:"#FFFFFF", borderRadius:16, padding:"20px 18px", marginBottom:14, boxShadow:"0 1px 3px rgba(0,0,0,0.07)" },
  heroLabel:  { fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px" },
  heroRate:   { fontSize:38, fontWeight:700, color:"#1B2B4B", lineHeight:1 },
  heroSub:    { fontSize:12, color:"#64748B", margin:0 },
  summaryRow: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:18 },
  rangeBtn:   { padding:"5px 14px", borderRadius:999, border:"1.5px solid #E2E8F0", background:"transparent", fontSize:13, fontWeight:500, color:"#64748B", cursor:"pointer" },
  rangeBtnActive:{ background:"#1B2B4B", borderColor:"#1B2B4B", color:"#FFFFFF" },
  chartWrap:  { display:"flex", alignItems:"flex-end", gap:4, height:100, marginBottom:8 },
  barCol:     { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, height:"100%" },
  barTrack:   { flex:1, width:"100%", background:"#F1F5F9", borderRadius:4, display:"flex", alignItems:"flex-end", overflow:"hidden" },
  bar:        { width:"100%", borderRadius:"4px 4px 0 0", minHeight:4, transition:"height 0.3s" },
  barLabel:   { fontSize:9, color:"#64748B", margin:0, textAlign:"center" },
  medRow:     { display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:12, marginBottom:12, borderBottom:"1px solid #E2E8F0" },
  medName:    { fontSize:13, fontWeight:600, color:"#1B2B4B", margin:"0 0 2px" },
  medStats:   { fontSize:11, color:"#64748B", margin:0 },
  medRateCol: { display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, minWidth:72 },
  miniTrack:  { width:60, height:5, background:"#E2E8F0", borderRadius:999, overflow:"hidden" },
  insightBox: { background:"#EFF6FF", border:"1.5px solid #BFDBFE", borderRadius:12, padding:"14px 16px" },
  insightTitle:{ fontSize:13, fontWeight:700, color:"#1E40AF", margin:"0 0 4px" },
  insightText: { fontSize:13, color:"#1E40AF", lineHeight:1.6, margin:0 },
};
