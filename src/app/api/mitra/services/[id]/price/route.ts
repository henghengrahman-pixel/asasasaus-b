import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentPartner} from '@/lib/partner-auth';
import {updateOwnedServicePrice} from '@/lib/partner-operations';
import {isTrustedMutationOrigin} from '@/lib/request-security';
const schema=z.object({price:z.number().int().min(0).max(1_000_000_000)});
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){const auth=await currentPartner();if(!auth)return NextResponse.json({ok:false,code:'UNAUTHENTICATED'},{status:401});if(!isTrustedMutationOrigin(req))return NextResponse.json({ok:false,code:'CSRF'},{status:403});try{const {id}=await params;const body=schema.parse(await req.json());const result=await updateOwnedServicePrice({partnerId:auth.partner.id,userId:auth.user.id,serviceId:id,price:body.price,source:'DASHBOARD'});return NextResponse.json({ok:true,...result})}catch(error){const code=error instanceof Error?error.message:'UPDATE_FAILED';return NextResponse.json({ok:false,code,message:code==='NOT_FOUND'?'Layanan tidak ditemukan pada toko Anda.':'Harga tidak dapat diperbarui.'},{status:code==='NOT_FOUND'?404:400})}}
