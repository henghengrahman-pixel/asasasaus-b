import {SignJWT,jwtVerify} from 'jose';import {cookies} from 'next/headers';import {redirect} from 'next/navigation';import {getPublicEnv,getSessionSecret} from './runtime-env';import {db} from './db';
const COOKIE='jb_admin_session';
function signingKey(){return new TextEncoder().encode(getSessionSecret())}
function secureCookie(){return getPublicEnv().NODE_ENV==='production'}
export type AdminRole='SUPER_ADMIN'|'OPERATIONS'|'CS'|'FINANCE'|'PARTNER_ADMIN';export type Session={userId:string;role:AdminRole;sessionVersion:number;level:'full'|'password'};
async function sign(s:Session,ttl:string){return new SignJWT(s).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime(ttl).sign(signingKey())}
export async function createSession(s:Session){const token=await sign(s,'12h');(await cookies()).set(COOKIE,token,{httpOnly:true,secure:secureCookie(),sameSite:'lax',path:'/',maxAge:43200})}
export async function setRecoveryDisplay(codes:string[]){const token=await new SignJWT({codes}).setProtectedHeader({alg:'HS256'}).setExpirationTime('10m').sign(signingKey());(await cookies()).set('jb_recovery_once',token,{httpOnly:true,secure:secureCookie(),sameSite:'lax',path:'/admin',maxAge:600})}
export async function recoveryDisplay(){const t=(await cookies()).get('jb_recovery_once')?.value;if(!t)return null;try{return ((await jwtVerify(t,signingKey())).payload as {codes?:string[]}).codes??null}catch{return null}}
export async function clearSession(){(await cookies()).set(COOKIE,'',{httpOnly:true,secure:secureCookie(),sameSite:'lax',path:'/',maxAge:0})}
export async function session(){const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;try{const p=(await jwtVerify(token,signingKey())).payload as unknown as Session;if(!p.userId||!p.role)return null;return p}catch{return null}}
export async function currentAdmin(){const s=await session();if(!s||s.level!=='full')return null;const u=await db.user.findUnique({where:{id:s.userId}});if(!u||!u.active||u.sessionVersion!==s.sessionVersion||!['SUPER_ADMIN','OPERATIONS','CS','FINANCE','PARTNER_ADMIN'].includes(u.role))return null;return {session:s,user:u}}
export async function requireAdmin(roles?:AdminRole[]){const a=await currentAdmin();if(!a)redirect('/admin/login');if(roles&&!roles.includes(a.session.role))redirect('/admin?forbidden=1');return a}
export function roleAllowed(role:string,roles:AdminRole[]){return role==='SUPER_ADMIN'||roles.includes(role as AdminRole)}
