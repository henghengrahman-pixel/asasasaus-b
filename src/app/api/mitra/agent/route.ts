import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentPartner} from '@/lib/partner-auth';
import {confirmPartnerAgent,runPartnerAgent} from '@/lib/partner-agent';
import {isTrustedMutationOrigin} from '@/lib/request-security';

const bodySchema=z.union([
  z.object({message:z.string().trim().min(1).max(1200)}),
  z.object({confirmationToken:z.string().min(20)})
]);

export async function POST(req:Request){
  const auth=await currentPartner();
  if(!auth)return NextResponse.json({ok:false,code:'UNAUTHENTICATED',message:'Silakan login sebagai mitra.'},{status:401});
  if(!isTrustedMutationOrigin(req))return NextResponse.json({ok:false,code:'CSRF',message:'Permintaan ditolak.'},{status:403});
  try{
    const body=bodySchema.parse(await req.json());
    const result='confirmationToken' in body?await confirmPartnerAgent({partnerId:auth.partner.id,userId:auth.user.id},body.confirmationToken):await runPartnerAgent({partnerId:auth.partner.id,userId:auth.user.id},body.message);
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const code=error instanceof Error?error.message:'AGENT_ERROR';
    const status=code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:code.startsWith('INVALID_TRANSITION')?409:400;
    return NextResponse.json({ok:false,code,message:code.startsWith('INVALID_TRANSITION')?'Status order tidak dapat dipindahkan melalui aksi tersebut.':'Permintaan agent tidak dapat diproses.'},{status});
  }
}
