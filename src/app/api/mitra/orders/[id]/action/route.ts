import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentPartner} from '@/lib/partner-auth';
import {executePartnerOrderAction} from '@/lib/partner-operations';
import {isTrustedMutationOrigin} from '@/lib/request-security';
const schema=z.object({action:z.enum(['ACCEPT','REJECT','DEPART','ARRIVE','START','COMPLETE']),reason:z.string().trim().max(500).optional()});
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await currentPartner();if(!auth)return NextResponse.json({ok:false,code:'UNAUTHENTICATED'},{status:401});if(!isTrustedMutationOrigin(req))return NextResponse.json({ok:false,code:'CSRF'},{status:403});
  try{const {id}=await params;const body=schema.parse(await req.json());const result=await executePartnerOrderAction({partnerId:auth.partner.id,userId:auth.user.id,orderId:id,action:body.action,reason:body.reason,source:'DASHBOARD'});return NextResponse.json({ok:true,...result})}catch(error){const code=error instanceof Error?error.message:'ORDER_ACTION_FAILED';const status=code==='NOT_FOUND'?404:code.startsWith('INVALID_TRANSITION')||code==='ORDER_CHANGED'?409:400;return NextResponse.json({ok:false,code,message:code.startsWith('INVALID_TRANSITION')?'Transisi status order tidak diizinkan.':'Aksi order gagal diproses.'},{status})}
}
