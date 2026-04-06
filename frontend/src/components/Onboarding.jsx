// frontend/src/components/Onboarding.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../api/index";

export default function Onboarding({ onComplete }) {
  const { user, refreshUser } = useAuth();
  const [form,  setForm]  = useState({ name:"", email:"", relation:"" });
  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);

  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setError(""); };

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Caregiver name and email are required"); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setError("Enter a valid email address"); return; }
    setBusy(true);
    try {
      await authAPI.updateCaregiver(form);
      await refreshUser();
      onComplete && onComplete();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.top}>
          <div style={s.avatar}>{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <h2 style={s.title}>Welcome, {user?.name?.split(" ")[0]}!</h2>
          <p style={s.sub}>Add a caregiver to enable alerts when you miss doses. They are only notified when truly needed.</p>
        </div>
        {error && <div style={s.err}>⚠️ {error}</div>}
        <Field label="Caregiver name *">
          <input style={s.inp} placeholder="e.g. Priya Mehta" value={form.name} onChange={e=>set("name",e.target.value)} />
        </Field>
        <Field label="Caregiver email *">
          <input style={s.inp} type="email" placeholder="caregiver@email.com" value={form.email} onChange={e=>set("email",e.target.value)} />
        </Field>
        <Field label="Relation (optional)">
          <input style={s.inp} placeholder="e.g. Daughter, Spouse, Doctor" value={form.relation} onChange={e=>set("relation",e.target.value)} />
        </Field>
        <button style={{...s.primary, opacity:busy?0.7:1}} onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save and continue →"}
        </button>
        <button style={s.skip} onClick={()=>onComplete&&onComplete()}>Skip for now</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#1B2B4B", marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  root:    { minHeight:"100vh", background:"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'DM Sans',system-ui,sans-serif" },
  card:    { background:"#FFFFFF", borderRadius:20, padding:"32px 28px", width:"100%", maxWidth:420, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" },
  top:     { textAlign:"center", marginBottom:24 },
  avatar:  { width:52, height:52, borderRadius:"50%", background:"#EFF6FF", color:"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, margin:"0 auto 12px" },
  title:   { fontSize:22, fontWeight:700, color:"#1B2B4B", margin:"0 0 8px" },
  sub:     { fontSize:13, color:"#64748B", lineHeight:1.6, margin:0 },
  err:     { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#DC2626", marginBottom:16 },
  inp:     { width:"100%", padding:"11px 14px", fontSize:14, border:"1.5px solid #E2E8F0", borderRadius:10, outline:"none", color:"#1B2B4B", background:"#FFFFFF", boxSizing:"border-box" },
  primary: { width:"100%", padding:"13px", background:"#1B2B4B", color:"#FFFFFF", border:"none", borderRadius:10, fontSize:15, fontWeight:600, cursor:"pointer", marginTop:4 },
  skip:    { display:"block", width:"100%", padding:"12px", background:"transparent", color:"#64748B", border:"1.5px solid #E2E8F0", borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer", marginTop:10, textAlign:"center" },
};
