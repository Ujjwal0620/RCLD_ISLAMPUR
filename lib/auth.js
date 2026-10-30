import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
const secret=new TextEncoder().encode(process.env.AUTH_SECRET||"rcld-islampur-change-this-secret");
export async function createSession(payload){return new SignJWT(payload).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("12h").sign(secret)}
export async function verifySession(token){try{const {payload}=await jwtVerify(token,secret);return payload}catch{return null}}
export async function getSession(){const c=await cookies();const t=c.get("rcld_session")?.value;return t?verifySession(t):null}
export function sessionCookie(token){return {name:"rcld_session",value:token,httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:43200}}
export function roleOfEmployee(e){const d=String(e?.designation||"").toLowerCase(),x=String(e?.department||"").toLowerCase();if(d.includes("super admin"))return "superadmin";if(d.includes("admin")||x.includes("office"))return "office-admin";if(d.includes("account")||x.includes("account"))return "accountant";if(x.includes("faculty")||d.includes("faculty")||d.includes("trainer")||d.includes("teacher"))return "faculty";return "employee"}
export function canManageAttendance(role){return ["superadmin","admin","office-admin"].includes(role)}