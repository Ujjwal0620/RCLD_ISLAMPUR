"use client";
import {useState} from "react";
import {Eye,EyeOff,LogIn,ShieldCheck,UserRound,LockKeyhole} from "lucide-react";

export default function Login(){
  const [loginId,setLoginId]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(e){
    e.preventDefault();
    setBusy(true); setError("");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({loginId:loginId.trim(),password})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Unable to sign in.");
      window.location.href="/dashboard";
    }catch(err){setError(err.message||"Unable to sign in.");}
    finally{setBusy(false);}
  }

  return <main className="login-page">
    <div className="login-brand">
      <div className="login-logo">R</div>
      <div><strong>RCLD</strong><span>Islampur ERP</span></div>
    </div>
    <section className="login-card">
      <div className="login-icon"><ShieldCheck size={26}/></div>
      <span className="eyebrow">RCLD ISLAMPUR · SECURE ERP</span>
      <h1>Welcome back</h1>
      <p>Sign in with your account credentials. Employees use the mobile number registered in their employee profile.</p>

      <form onSubmit={submit}>
        <label>
          <span>Email or Mobile Number</span>
          <div className="login-input">
            <UserRound size={17}/>
            <input value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="admin@rcld.in / 10-digit mobile" autoComplete="username" required/>
          </div>
        </label>

        <label>
          <span>Password</span>
          <div className="login-input">
            <LockKeyhole size={17}/>
            <input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required/>
            <button type="button" className="password-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
          </div>
        </label>

        {error&&<div className="login-error">{error}</div>}
        <button className="login-submit" disabled={busy}>
          <LogIn size={17}/>{busy?"Signing in…":"Sign in"}
        </button>
      </form>

      <div className="login-help">
        <strong>Employee login</strong>
        <span>Use the exact mobile number saved in your employee account. You can change your password after signing in.</span>
      </div>
    </section>
  </main>;
}