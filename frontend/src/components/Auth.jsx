// frontend/src/components/Auth.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Auth() {
  const { login, signup } = useAuth();
  const [mode,  setMode]  = useState("login");
  const [form,  setForm]  = useState({ name:"", email:"", password:"", age:"" });
  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);

  const set = (k, v) => { setForm(p => ({...p,[k]:v})); setError(""); };

  const submit = async () => {
    setError("");
    if (!form.email.trim() || !form.password) { setError("Email and password are required"); return; }
    if (mode === "signup" && !form.name.trim()) { setError("Name is required"); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.email.trim(), form.password);
      } else {
        await signup(form.name.trim(), form.email.trim(), form.password, form.age ? parseInt(form.age) : undefined);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m) => { setMode(m); setError(""); setForm({ name:"", email:"", password:"", age:"" }); };

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Brand */}
        <div style={s.brand}>
          <div style={s.logo}>💊</div>
          <h1 style={s.appName}>MedTrack</h1>
          <p style={s.tagline}>Smart medication adherence</p>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={{...s.tab,...(mode==="login"?s.tabOn:{})}}  onClick={()=>switchMode("login")}>Sign in</button>
          <button style={{...s.tab,...(mode==="signup"?s.tabOn:{})}} onClick={()=>switchMode("signup")}>Create account</button>
        </div>

        {error && <div style={s.errBox}>⚠️ {error}</div>}

        {mode === "signup" && (
          <Field label="Full name">
            <input style={s.inp} placeholder="Rahul Mehta" value={form.name}
              onChange={e=>set("name",e.target.value)} />
          </Field>
        )}
        <Field label="Email address">
          <input style={s.inp} type="email" placeholder="you@email.com" value={form.email}
            onChange={e=>set("email",e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()} />
        </Field>
        <Field label="Password">
          <input style={s.inp} type="password" placeholder="Min. 6 characters" value={form.password}
            onChange={e=>set("password",e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()} />
        </Field>
        {mode === "signup" && (
          <Field label="Age (optional)">
            <input style={s.inp} type="number" placeholder="45" min={1} max={120} value={form.age}
              onChange={e=>set("age",e.target.value)} />
          </Field>
        )}

        <button style={{...s.submitBtn, opacity:busy?0.7:1}} onClick={submit} disabled={busy}>
          {busy ? "Please wait…" : mode==="login" ? "Sign in" : "Create account"}
        </button>

        <p style={s.switchText}>
          {mode==="login" ? "Don't have an account? " : "Already have an account? "}
          <button style={s.switchLink} onClick={()=>switchMode(mode==="login"?"signup":"login")}>
            {mode==="login" ? "Sign up free" : "Sign in"}
          </button>
        </p>
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
  root:       { minHeight:"100vh", background:"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'DM Sans',system-ui,sans-serif" },
  card:       { background:"#FFFFFF", borderRadius:20, padding:"36px 28px", width:"100%", maxWidth:400, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" },
  brand:      { textAlign:"center", marginBottom:28 },
  logo:       { fontSize:44, marginBottom:8 },
  appName:    { fontSize:28, fontWeight:700, color:"#1B2B4B", margin:"0 0 4px", letterSpacing:"-0.5px" },
  tagline:    { fontSize:13, color:"#64748B", margin:0 },
  tabs:       { display:"flex", background:"#F8FAFC", borderRadius:10, padding:4, marginBottom:24, gap:4 },
  tab:        { flex:1, padding:"9px", background:"transparent", border:"none", borderRadius:8, fontSize:14, fontWeight:500, color:"#64748B", cursor:"pointer" },
  tabOn:      { background:"#FFFFFF", color:"#1B2B4B", fontWeight:700, boxShadow:"0 1px 4px rgba(0,0,0,0.1)" },
  errBox:     { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#DC2626", marginBottom:16 },
  inp:        { width:"100%", padding:"11px 14px", fontSize:15, border:"1.5px solid #E2E8F0", borderRadius:10, outline:"none", color:"#1B2B4B", background:"#FFFFFF", boxSizing:"border-box" },
  submitBtn:  { width:"100%", padding:"13px", background:"#1B2B4B", color:"#FFFFFF", border:"none", borderRadius:10, fontSize:15, fontWeight:600, cursor:"pointer", marginTop:4 },
  switchText: { textAlign:"center", fontSize:13, color:"#64748B", marginTop:16, marginBottom:0 },
  switchLink: { background:"transparent", border:"none", color:"#3B82F6", fontSize:13, fontWeight:600, cursor:"pointer", padding:0 },
};
