import {NextResponse} from 'next/server';
import {z} from 'zod';
import QRCode from 'qrcode';
import {verify2fa,readChallenge} from '@/lib/admin-auth';
import {createSession,setRecoveryDisplay} from '@/lib/auth';
import {db} from '@/lib/db';
import {externalUrl,isTrustedMutationOrigin} from '@/lib/request-security';

const S=z.object({token:z.string().min(20),code:z.string().min(6).max(32)});
export async function POST(r:Request){
  if(!isTrustedMutationOrigin(r))return NextResponse.json({error:'CSRF'},{status:403});
  const f=await r.formData();
  const p=S.safeParse({token:f.get('token'),code:f.get('code')});
  if(!p.success)return NextResponse.redirect(externalUrl(r,'/admin/login?error=1'),303);
  const x=await verify2fa(p.data.token,p.data.code);
  if(!x)return NextResponse.redirect(externalUrl(r,'/admin/login?error=1'),303);
  await createSession({userId:x.user.id,role:x.user.role,sessionVersion:x.user.sessionVersion,level:'full'});
  if(x.recovery.length)await setRecoveryDisplay(x.recovery);
  return NextResponse.redirect(externalUrl(r,'/admin'),303);
}
export async function GET(r:Request){
  const u=new URL(r.url),t=u.searchParams.get('t');
  if(!t)return new NextResponse('Bad request',{status:400});
  const c=await readChallenge(t);
  if(!c?.secret)return new NextResponse('Not found',{status:404});
  const user=await db.user.findUnique({where:{id:c.uid},select:{username:true}});
  const uri=`otpauth://totp/${encodeURIComponent('JasaBatam:'+(user?.username||'admin'))}?secret=${c.secret}&issuer=JasaBatam&digits=6&period=30`;
  const png=await QRCode.toBuffer(uri,{type:'png',width:240,margin:1,errorCorrectionLevel:'M'});
  return new NextResponse(new Uint8Array(png),{headers:{'content-type':'image/png','cache-control':'no-store, private'}});
}
