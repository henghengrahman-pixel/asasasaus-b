import {NextResponse} from 'next/server';
import {clearSession,currentAdmin} from '@/lib/auth';
import {audit} from '@/lib/audit';
import {externalUrl,isTrustedMutationOrigin} from '@/lib/request-security';
export async function POST(r:Request){
  if(!isTrustedMutationOrigin(r))return NextResponse.json({error:'CSRF'},{status:403});
  const a=await currentAdmin();
  if(a)await audit(a.user.id,'LOGOUT','User',a.user.id);
  await clearSession();
  return NextResponse.redirect(externalUrl(r,'/admin/login'),303);
}
