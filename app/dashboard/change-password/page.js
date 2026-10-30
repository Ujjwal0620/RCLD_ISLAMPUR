"use client";
import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function ChangePasswordPage() {
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(e){
    e.preventDefault();setMessage("");setError("");
    if(newPassword!==confirmPassword){setError("New passwords do not match.");return}
    setBusy(true);
    const r=await fetch("/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});
    const d=await r.json();
    if(!r.ok)setError(d.error||"Unable to change password.");
    else{setMessage("Password changed successfully.");setCurrentPassword("");setNewPassword("");setConfirmPassword("")}
    setBusy(false);
  }
  return <ERPLayout active="/dashboard/change-password"><header className="topbar"><div><div className="crumb">Employee / Security</div><h1>Change Password</h1></div></header><section className="panel" style={{maxWidth:640}}><div className="panel-head"><div><h3><KeyRound size={18}/> Account Security</h3><p>Change your employee login password. Your registered mobile number remains your login ID.</p></div></div><form onSubmit={submit} className="form-grid"><label className="full"><span>Current Password</span><input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></label><label className="full"><span>New Password</span><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={6} required/></label><label className="full"><span>Confirm New Password</span><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={6} required/></label>{error&&<div className="error-msg full">{error}</div>}{message&&<div className="full">{message}</div>}<div className="full"><button className="primary-btn" disabled={busy}><Save size={16}/>{busy?"Updating…":"Change Password"}</button></div></form></section></ERPLayout>
}