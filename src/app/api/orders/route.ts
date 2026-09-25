import {NextRequest,NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db} from '@/lib/db';
import {commission} from '@/lib/money';
import {publicOrderId} from '@/lib/id';
import {calculateLineTotal,validationFieldMap} from '@/lib/marketplace';

const schema=z.object({
  serviceId:z.string().min(1),partnerId:z.string().min(1),areaId:z.string().min(1),
  name:z.string().trim().min(2).max(100),
  phone:z.preprocess(v=>typeof v==='string'?v.replace(/[^0-9+]/g,''):v,z.string().regex(/^\+?[0-9]{8,16}$/)),
  address:z.string().trim().min(8).max(500),scheduledAt:z.coerce.date(),quantity:z.number().int().min(1).max(20),
  note:z.string().max(1000).nullable().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),
  locationNote:z.string().max(300).nullable().optional(),paymentMethod:z.enum(['CASH','TRANSFER']).default('CASH')
});
const fieldMessages:Record<string,string>={serviceId:'Layanan tidak valid.',partnerId:'Mitra tidak valid.',areaId:'Pilih area layanan.',name:'Nama minimal 2 karakter.',phone:'Masukkan nomor HP/WhatsApp yang valid (8–16 digit).',address:'Alamat terlalu singkat. Masukkan alamat lengkap minimal 8 karakter.',scheduledAt:'Pilih jadwal layanan yang valid.',quantity:'Jumlah harus antara 1 sampai 20.',note:'Catatan terlalu panjang.',latitude:'Lokasi perangkat tidak valid.',longitude:'Lokasi perangkat tidak valid.',locationNote:'Catatan lokasi terlalu panjang.',paymentMethod:'Metode pembayaran tidak valid.'};
const businessMessages:Record<string,string>={SERVICE_UNAVAILABLE:'Layanan saat ini tidak tersedia.',SERVICE_NOT_AVAILABLE_IN_AREA:'Layanan belum tersedia di area yang dipilih.',SCHEDULE_TOO_SOON:'Jadwal terlalu dekat. Silakan pilih jadwal yang lebih tersedia.',PARTNER_UNAVAILABLE:'Mitra yang dipilih sedang tidak tersedia untuk layanan/area ini. Silakan pilih mitra lain.',AREA_UNAVAILABLE:'Area yang dipilih sedang tidak tersedia.'};
function apiError(code:string,message:string,status:number,fields?:Record<string,string>){return NextResponse.json({ok:false,code,message,...(fields?{fields}:{})},{status})}

export async function POST(req:NextRequest){
  try{
    const key=req.headers.get('idempotency-key');
    if(!key||key.length>120)return apiError('INVALID_REQUEST','Permintaan tidak valid. Silakan muat ulang halaman dan coba lagi.',400);
    let raw:unknown;try{raw=await req.json()}catch{return apiError('INVALID_JSON','Data pesanan tidak dapat dibaca. Silakan coba lagi.',400)}
    const parsed=schema.safeParse(raw);
    if(!parsed.success){const fields=validationFieldMap(parsed.error.issues,fieldMessages);return apiError('VALIDATION_ERROR','Periksa kembali data pesanan.',400,fields)}
    const data=parsed.data;
    const existing=await db.idempotencyKey.findUnique({where:{scope_key:{scope:'create-order',key}}});
    if(existing?.response)return NextResponse.json(existing.response,{status:existing.statusCode||201});
    const result=await db.$transaction(async tx=>{
      await tx.idempotencyKey.create({data:{scope:'create-order',key,expiresAt:new Date(Date.now()+86_400_000)}});
      const [service,area,settings]=await Promise.all([
        tx.service.findUnique({where:{id:data.serviceId},include:{serviceAreas:true,category:true}}),
        tx.area.findUnique({where:{id:data.areaId}}),
        tx.setting.findUnique({where:{key:'business'}})
      ]);
      if(!service||!service.active||service.archivedAt||!service.category.active||service.category.archivedAt)throw new Error('SERVICE_UNAVAILABLE');
      if(!area||!area.active)throw new Error('AREA_UNAVAILABLE');
      if(service.serviceAreas.length&&!service.serviceAreas.some(x=>x.areaId===data.areaId&&x.active))throw new Error('SERVICE_NOT_AVAILABLE_IN_AREA');
      const business=settings?.value&&typeof settings.value==='object'&&!Array.isArray(settings.value)?settings.value as Record<string,unknown>:{};
      const lead=Math.max(0,Number(business.minSchedulingLeadMinutes||0));
      if(data.scheduledAt.getTime()<Date.now()+lead*60_000)throw new Error('SCHEDULE_TOO_SOON');
      const ps=await tx.partnerService.findFirst({where:{partnerId:data.partnerId,serviceId:service.id,active:true,partner:{user:{active:true},online:true,dispatchEnabled:true,status:{notIn:['REJECTED','SUSPENDED']},storefrontStatus:{not:'HIDDEN'},areas:{some:{areaId:data.areaId}}}},select:{partnerId:true,customPrice:true,partner:{select:{userId:true}}}});
      if(!ps)throw new Error('PARTNER_UNAVAILABLE');
      const selectedPartner={id:ps.partnerId,userId:ps.partner.userId,price:ps.customPrice??service.basePrice};
      const unitPrice=selectedPartner.price;
      const serviceSubtotal=calculateLineTotal({unitPrice,quantity:data.quantity,minimumCharge:service.minimumCharge});
      const areaSurcharge=area.surcharge,total=serviceSubtotal+areaSurcharge;
      if(!Number.isSafeInteger(total)||total<0)throw new Error('INVALID_TOTAL');
      const bps=service.commissionBps??Number(business.defaultCommissionBps||1000),fee=commission(total,bps);
      let user=await tx.user.findUnique({where:{phone:data.phone}});
      if(!user)user=await tx.user.create({data:{phone:data.phone,role:'CUSTOMER'}});
      let customer=await tx.customerProfile.findUnique({where:{userId:user.id}});
      if(!customer)customer=await tx.customerProfile.create({data:{userId:user.id,name:data.name}});
      else if(customer.name!==data.name)customer=await tx.customerProfile.update({where:{id:customer.id},data:{name:data.name}});
      const today=new Date();today.setHours(0,0,0,0);const count=await tx.order.count({where:{createdAt:{gte:today}}});
      let pid=publicOrderId(count+1);for(let attempt=0;attempt<20&&await tx.order.findUnique({where:{publicId:pid},select:{id:true}});attempt++)pid=publicOrderId(count+2+attempt);
      const order=await tx.order.create({data:{publicId:pid,customerId:customer.id,partnerId:selectedPartner.id,areaId:data.areaId,status:'NEW',scheduledAt:data.scheduledAt,addressSnapshot:{line1:data.address,area:area.name,latitude:data.latitude??null,longitude:data.longitude??null},customerNote:data.note||undefined,latitude:data.latitude,longitude:data.longitude,locationNote:data.locationNote||undefined,paymentMethod:data.paymentMethod,subtotal:serviceSubtotal,areaSurcharge,total,commission:fee,partnerEarning:total-fee,items:{create:{serviceId:service.id,name:service.name,quantity:data.quantity,unitPrice,lineTotal:serviceSubtotal}},history:{create:[{actorRole:'CUSTOMER',newStatus:'NEW'}]},thread:{create:{}}}});
      await tx.notification.create({data:{userId:selectedPartner.userId,type:'ORDER_NEW',channel:'DASHBOARD',payload:{orderId:order.id,publicId:order.publicId,status:order.status}}});
      const response={ok:true,id:order.id,publicId:order.publicId,status:order.status};
      await tx.idempotencyKey.update({where:{scope_key:{scope:'create-order',key}},data:{response,statusCode:201}});
      return response;
    });
    return NextResponse.json(result,{status:201});
  }catch(e){
    const code=e instanceof Error?e.message:'UNKNOWN';
    if(businessMessages[code])return apiError(code,businessMessages[code],409);
    if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return apiError('DUPLICATE_REQUEST','Pesanan yang sama sedang diproses. Silakan tunggu sebentar.',409);
    console.error('create order failed',{code});
    return apiError('ORDER_CREATE_FAILED','Pesanan belum berhasil dibuat. Silakan coba lagi.',500);
  }
}
