import {NextResponse} from 'next/server';
import {z} from 'zod';
import {passwordLogin} from '@/lib/admin-auth';
import {externalUrl,isTrustedMutationOrigin} from '@/lib/request-security';

const S=z.object({username:z.string().min(3).max(80),password:z.string().min(8).max(200)});
export async function POST(r:Request){
  if(!isTrustedMutationOrigin(r))return NextResponse.json({error:'CSRF'},{status:403});
  const f=await r.formData();
  const p=S.safeParse({username:f.get('username'),password:f.get('password')});
  if(!p.success)return NextResponse.redirect(externalUrl(r,'/admin/login?error=1'),303);
  const x=await passwordLogin(p.data.username,p.data.password);
  if(!x)return NextResponse.redirect(externalUrl(r,'/admin/login?error=1'),303);
  const u=externalUrl(r,'/admin/login');
  u.searchParams.set(x.kind==='setup'?'setup':'challenge','1');
  u.searchParams.set('t',x.token);
  return NextResponse.redirect(u,303);
}
