// src/components/AddMedicine.jsx — v3 (no mockData imports)
import { useState } from "react";

// ─── Frequency options inline (no mockData needed) ───────────
const FREQ_OPTIONS = [
  { value:"once_daily",   label:"Once daily" },
  { value:"twice_daily",  label:"Twice daily" },
  { value:"thrice_daily", label:"Three times daily" },
  { value:"once_weekly",  label:"Once weekly" },
  { value:"custom",       label:"Custom interval" },
];

const INSTRUCTION_PRESETS = ["Before food","After food","With water","With milk","Avoid dairy","Before bed"];

const today = () => new Date().toISOString().split("T")[0];

const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h%12===0?12:h%12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
};

// ─────────────────────────────────────────────────────────────
// PROPS
//   editing:  Medicine | null  (pre-fill for edit mode)
//   dupError: string           (duplicate error from App)
//   onSave:   (medicine) => void
//   onCancel: () => void
// ─────────────────────────────────────────────────────────────
export default function AddMedicine({ onSave, onCancel, editing = null, dupError = "" }) {
  const [form, setForm] = useState({
    name:         editing?.name         || "",
    dosage:       editing?.dosage       || "",
    frequency:    editing?.frequency    || "once_daily",
    times:        editing?.times        || ["08:00"],
    startDate:    editing?.startDate    || today(),
    endDate:      editing?.endDate      || "",
    ongoing:      editing ? !editing.endDate : true,
    instructions: editing?.instructions || "",
    isCritical:   editing?.isCritical   || false,
  });
  const [errors, setErrors] = useState({});

  const update = (k, v) => { setForm(p => ({...p,[k]:v})); setErrors(p => ({...p,[k]:""})); };

  const timeSlotCount = () => form.frequency === "twice_daily" ? 2 : form.frequency === "thrice_daily" ? 3 : 1;

  const handleFreqChange = (val) => {
    const count    = val === "twice_daily" ? 2 : val === "thrice_daily" ? 3 : 1;
    const newTimes = Array.from({ length:count }, (_,i) => form.times[i] || "08:00");
    setForm(p => ({...p, frequency:val, times:newTimes}));
  };

  const updateTime = (i, v) => {
    const t = [...form.times]; t[i] = v; update("times", t);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())   e.name   = "Medicine name is required";
    if (!form.dosage.trim()) e.dosage = "Dosage is required";
    if (!form.ongoing && !form.endDate) e.endDate = "Set an end date or choose Ongoing";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const medicine = {
      ...(editing && { _id: editing._id || editing.id }),
      name:         form.name.trim(),
      dosage:       form.dosage.trim(),
      frequency:    form.frequency,
      times:        form.times,
      startDate:    form.startDate,
      endDate:      form.ongoing ? null : form.endDate,
      instructions: form.instructions.trim(),
      isCritical:   form.isCritical,
      active:       true,
    };
    onSave && onSave(medicine);
  };

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onCancel}>← Back</button>
        <h1 style={s.pageTitle}>{editing ? "Edit medicine" : "Add medicine"}</h1>
        <div style={{ width:60 }} />
      </div>

      <div style={s.scrollArea}>
        {/* Duplicate error */}
        {dupError && (
          <div style={s.dupError}>⚠️ {dupError}</div>
        )}

        {/* Medicine details */}
        <Section title="Medicine details">
          <Field label="Medicine name *" error={errors.name}>
            <input style={{ ...s.input, ...(errors.name ? s.inputErr:{}) }}
              placeholder="e.g. Metformin, Insulin, Vitamin D"
              value={form.name} onChange={e => update("name", e.target.value)} />
          </Field>
          <Field label="Dosage *" error={errors.dosage}>
            <input style={{ ...s.input, ...(errors.dosage ? s.inputErr:{}) }}
              placeholder="e.g. 1 tablet (500mg), 5 ml"
              value={form.dosage} onChange={e => update("dosage", e.target.value)} />
          </Field>
        </Section>

        {/* Schedule */}
        <Section title="Schedule">
          <Field label="Frequency">
            <select style={s.input} value={form.frequency} onChange={e => handleFreqChange(e.target.value)}>
              {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Time(s)" error={errors.times}>
            {Array.from({ length:timeSlotCount() }).map((_,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom: i < timeSlotCount()-1 ? 10 : 0 }}>
                <span style={{ fontSize:13, color:"#64748B", minWidth:50 }}>{timeSlotCount()>1 ? `Dose ${i+1}` : ""}</span>
                <input type="time" style={{ ...s.input, flex:1 }}
                  value={form.times[i]||"08:00"} onChange={e => updateTime(i, e.target.value)} />
              </div>
            ))}
          </Field>
        </Section>

        {/* Duration */}
        <Section title="Duration">
          <Field label="Start date">
            <input type="date" style={s.input} value={form.startDate} onChange={e => update("startDate", e.target.value)} />
          </Field>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, padding:"4px 0" }}>
            <span style={{ fontSize:14, color:"#1B2B4B", fontWeight:500 }}>Ongoing (no end date)</span>
            <button style={{ ...s.toggle, ...(form.ongoing ? s.toggleOn:{}) }} onClick={() => update("ongoing", !form.ongoing)}>
              <div style={{ ...s.toggleThumb, ...(form.ongoing ? s.toggleThumbOn:{}) }} />
            </button>
          </div>
          {!form.ongoing && (
            <Field label="End date" error={errors.endDate}>
              <input type="date" style={{ ...s.input, ...(errors.endDate ? s.inputErr:{}) }}
                value={form.endDate} min={form.startDate} onChange={e => update("endDate", e.target.value)} />
            </Field>
          )}
        </Section>

        {/* Critical flag */}
        <Section title="Priority">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 0" }}>
            <div>
              <p style={{ fontSize:14, color:"#1B2B4B", fontWeight:500, margin:"0 0 3px" }}>Critical medicine 🔴</p>
              <p style={{ fontSize:12, color:"#64748B", margin:0 }}>Caregiver alerted after 1 missed dose instead of 2</p>
            </div>
            <button style={{ ...s.toggle, ...(form.isCritical ? s.toggleOn:{}) }} onClick={() => update("isCritical", !form.isCritical)}>
              <div style={{ ...s.toggleThumb, ...(form.isCritical ? s.toggleThumbOn:{}) }} />
            </button>
          </div>
        </Section>

        {/* Instructions */}
        <Section title="Special instructions (optional)">
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10 }}>
            {INSTRUCTION_PRESETS.map(p => (
              <button key={p}
                style={{ ...s.presetPill, ...(form.instructions===p ? s.presetPillActive:{}) }}
                onClick={() => update("instructions", form.instructions===p ? "" : p)}>
                {p}
              </button>
            ))}
          </div>
          <input style={s.input} placeholder="Or type custom instructions…"
            value={form.instructions} onChange={e => update("instructions", e.target.value)} />
        </Section>

        {/* Preview */}
        {form.name && (
          <div style={s.preview}>
            <p style={s.previewLabel}>Preview</p>
            <p style={s.previewName}>{form.name}{form.isCritical?" 🔴":""}</p>
            <p style={s.previewDetail}>{form.dosage} · {FREQ_OPTIONS.find(o=>o.value===form.frequency)?.label}</p>
            <p style={s.previewDetail}>{form.times.map(fmtTime).join(", ")}{form.instructions ? ` · ${form.instructions}` : ""}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:"flex", gap:12 }}>
          <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={{ ...s.primaryBtn, flex:1 }} onClick={handleSave}>
            {editing ? "Save changes" : "Add medicine"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom:18 }}>
      <p style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px 2px" }}>{title}</p>
      <div style={{ background:"#FFFFFF", borderRadius:14, padding:"18px 16px 2px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>{children}</div>
    </div>
  );
}
function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#1B2B4B", marginBottom:6 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize:12, color:"#DC2626", margin:"4px 0 0" }}>{error}</p>}
    </div>
  );
}

const s = {
  root:        { minHeight:"100vh", background:"#F8FAFC", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" },
  topBar:      { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", background:"#FFFFFF", borderBottom:"1px solid #E2E8F0", position:"sticky", top:0, zIndex:10 },
  pageTitle:   { fontSize:17, fontWeight:700, color:"#1B2B4B", margin:0 },
  backBtn:     { background:"transparent", border:"none", color:"#3B82F6", fontSize:15, cursor:"pointer", fontWeight:500, width:60, textAlign:"left", padding:0 },
  scrollArea:  { padding:"14px 14px 40px", maxWidth:480, width:"100%", margin:"0 auto" },
  dupError:    { background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:10, padding:"11px 14px", fontSize:13, color:"#991B1B", marginBottom:14, fontWeight:500 },
  input:       { width:"100%", padding:"10px 13px", fontSize:14, border:"1.5px solid #E2E8F0", borderRadius:10, outline:"none", color:"#1B2B4B", background:"#FFFFFF", boxSizing:"border-box", fontFamily:"inherit" },
  inputErr:    { borderColor:"#DC2626" },
  toggle:      { width:44, height:26, borderRadius:13, background:"#E2E8F0", border:"none", cursor:"pointer", position:"relative", padding:0, transition:"background 0.2s", flexShrink:0 },
  toggleOn:    { background:"#16A34A" },
  toggleThumb: { width:20, height:20, borderRadius:"50%", background:"#FFFFFF", position:"absolute", top:3, left:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" },
  toggleThumbOn:{ left:21 },
  presetPill:  { padding:"6px 13px", borderRadius:999, fontSize:12, fontWeight:500, border:"1.5px solid #E2E8F0", background:"transparent", color:"#64748B", cursor:"pointer" },
  presetPillActive:{ background:"#EFF6FF", borderColor:"#3B82F6", color:"#3B82F6" },
  preview:     { background:"#F0FDF4", border:"1.5px solid #BBF7D0", borderRadius:12, padding:"13px 15px", marginBottom:18 },
  previewLabel:{ fontSize:10, fontWeight:700, color:"#16A34A", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 5px" },
  previewName: { fontSize:16, fontWeight:700, color:"#1B2B4B", margin:"0 0 3px" },
  previewDetail:{ fontSize:12, color:"#64748B", margin:"0 0 2px" },
  primaryBtn:  { padding:"13px", background:"#1B2B4B", color:"#FFFFFF", border:"none", borderRadius:12, fontSize:14, fontWeight:600, cursor:"pointer" },
  cancelBtn:   { padding:"13px 18px", background:"transparent", color:"#64748B", border:"1.5px solid #E2E8F0", borderRadius:12, fontSize:14, fontWeight:500, cursor:"pointer" },
};
