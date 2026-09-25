import {SignJWT,jwtVerify} from 'jose';
import {z} from 'zod';
import {db} from './db';
import {getSessionSecret} from './runtime-env';
import {partnerAnalytics,partnerOrderDetail,updateOwnedServicePrice,executePartnerOrderAction,type PartnerOrderAction} from './partner-operations';
import {planWithConfiguredLLM} from './partner-agent-planner';

const key=()=>new TextEncoder().encode(getSessionSecret());
export const agentResultSchema=z.object({
  intent:z.string().min(1).max(100),confidence:z.number().min(0).max(1),message:z.string().min(1).max(2000),action:z.string().min(1).max(100),requiresConfirmation:z.boolean(),tool:z.string().nullable(),arguments:z.record(z.string(),z.unknown()),confirmationToken:z.string().optional(),data:z.unknown().optional()
});
export type AgentResult=z.infer<typeof agentResultSchema>;

type MutationPayload={partnerId:string;userId:string;tool:'updateServicePrice'|'orderAction';arguments:Record<string,unknown>};
async function confirmationToken(payload:MutationPayload){return new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(key())}
async function readConfirmation(token:string){const p=(await jwtVerify(token,key())).payload as unknown as MutationPayload;if(!p.partnerId||!p.userId||!p.tool||!p.arguments)throw new Error('INVALID_CONFIRMATION');return p}
function out(value:AgentResult){return agentResultSchema.parse(value)}
function normalize(s:string){return s.toLowerCase().replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim()}
function money(n:number){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n)}
function startOfDay(){const d=new Date();d.setHours(0,0,0,0);return d}
function startOfMonth(){const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return d}
function startOf30Days(){return new Date(Date.now()-30*86_400_000)}
function analyticsSince(text:string){return /bulan ini/.test(text)?startOfMonth():/hari ini/.test(text)?startOfDay():startOf30Days()}

async function parseIntent(partnerId:string,message:string){
  const text=normalize(message);
  if(/partner lain|toko lain|mitra lain/.test(text))return {intent:'CROSS_PARTNER_DENIED',confidence:1,tool:null,args:{}};
  if(/belum.*respon|belum.*respons/.test(text))return {intent:'ORDER_UNRESPONDED',confidence:.99,tool:'getPartnerOrders',args:{scope:'unresponded'}};
  if(/order baru|pesanan baru/.test(text))return {intent:'ORDER_NEW',confidence:.99,tool:'getPartnerOrders',args:{scope:'new'}};
  if(/order saya|pesanan saya/.test(text))return {intent:'ORDER_LIST',confidence:.98,tool:'getPartnerOrders',args:{scope:'active'}};
  if(/pendapatan|revenue|omzet/.test(text))return {intent:'ANALYTICS_REVENUE',confidence:.96,tool:'getPartnerAnalytics',args:{since:analyticsSince(text),period:/bulan ini/.test(text)?'bulan ini':/hari ini/.test(text)?'hari ini':'30 hari terakhir'}};
  if(/rating/.test(text))return {intent:'ANALYTICS_RATING',confidence:.97,tool:'getPartnerRating',args:{}};
  if(/layanan paling|paling banyak dipesan/.test(text))return {intent:'ANALYTICS_TOP_SERVICE',confidence:.96,tool:'getPartnerAnalytics',args:{since:analyticsSince(text),period:/bulan ini/.test(text)?'bulan ini':/hari ini/.test(text)?'hari ini':'30 hari terakhir'}};
  if(/alert|peringatan|perlu perhatian/.test(text))return {intent:'ALERT_LIST',confidence:.94,tool:'getAlerts',args:{}};
  if(/ulasan|review/.test(text))return {intent:'REVIEW_LIST',confidence:.94,tool:'getPartnerReviews',args:{}};
  if(/layanan saya|service saya|harga layanan/.test(text))return {intent:'SERVICE_LIST',confidence:.94,tool:'getPartnerServices',args:{}};
  const price=text.match(/(?:ubah|ganti|set).*?([a-z0-9 ]{3,80}?)\s+(?:jadi|menjadi|ke)\s*(?:rp\s*)?([0-9][0-9.,]*)/i);
  if(price){const wanted=price[1].trim(),amount=Number(price[2].replace(/[.,]/g,''));const services=await db.partnerService.findMany({where:{partnerId,active:true},select:{serviceId:true,customPrice:true,service:{select:{name:true,basePrice:true}}}});const found=services.find(x=>normalize(x.service.name).includes(wanted)||wanted.includes(normalize(x.service.name)));if(found&&Number.isSafeInteger(amount))return {intent:'CHANGE_PRICE',confidence:.97,tool:'updateServicePrice',args:{serviceId:found.serviceId,serviceName:found.service.name,currentPrice:found.customPrice??found.service.basePrice,price:amount}}}
  const orderAction=text.match(/(?:terima|tolak|berangkat|tiba|sampai|mulai|selesai(?:kan)?)\s+(?:order|pesanan)?\s*([a-z0-9-]+)/i);
  if(orderAction){const verb=text.split(' ')[0],action:PartnerOrderAction=verb.startsWith('terima')?'ACCEPT':verb.startsWith('tolak')?'REJECT':verb.startsWith('berangkat')?'DEPART':(verb.startsWith('tiba')||verb.startsWith('sampai'))?'ARRIVE':verb.startsWith('mulai')?'START':'COMPLETE';return {intent:`ORDER_${action}`,confidence:.95,tool:'orderAction',args:{orderRef:orderAction[1],action}}}
  const detail=text.match(/(?:detail|lihat)\s+(?:order|pesanan)\s+([a-z0-9-]+)/i);if(detail)return {intent:'ORDER_DETAIL',confidence:.94,tool:'getPartnerOrderDetail',args:{orderRef:detail[1]}};
  if(/profil|toko|storefront|kelengkapan/.test(text))return {intent:'STORE_PROFILE',confidence:.9,tool:'getPartnerProfile',args:{}};
  const ai=await planWithConfiguredLLM(partnerId,message);
  if(ai){
    if(ai.tool==='updateServicePrice'){const serviceName=String(ai.arguments.serviceName||'').trim(),price=Number(ai.arguments.price);const services=await db.partnerService.findMany({where:{partnerId,active:true},select:{serviceId:true,customPrice:true,service:{select:{name:true,basePrice:true}}}});const found=services.find(x=>normalize(x.service.name)===normalize(serviceName));if(found&&Number.isSafeInteger(price))return {intent:ai.intent,confidence:.85,tool:'updateServicePrice',args:{serviceId:found.serviceId,serviceName:found.service.name,currentPrice:found.customPrice??found.service.basePrice,price}}}
    if(ai.tool==='orderAction'){const action=String(ai.arguments.action);if(['ACCEPT','REJECT','DEPART','ARRIVE','START','COMPLETE'].includes(action))return {intent:ai.intent,confidence:.82,tool:'orderAction',args:{orderRef:String(ai.arguments.orderRef||''),action}}}
    if(ai.tool==='getPartnerOrderDetail')return {intent:ai.intent,confidence:.82,tool:'getPartnerOrderDetail',args:{orderRef:String(ai.arguments.orderRef||'')}};
    if(['getPartnerOrders','getPartnerAnalytics','getPartnerProfile','getPartnerServices','getPartnerReviews','getAlerts'].includes(String(ai.tool)))return {intent:ai.intent,confidence:.82,tool:ai.tool,args:{}};
  }
  return {intent:'UNKNOWN',confidence:.45,tool:null,args:{}};
}

export async function runPartnerAgent(ctx:{partnerId:string;userId:string},message:string):Promise<AgentResult>{
  const parsed=await parseIntent(ctx.partnerId,message);
  if(parsed.intent==='CROSS_PARTNER_DENIED')return out({intent:parsed.intent,confidence:1,message:'Saya hanya dapat membaca dan mengubah data toko yang terikat ke akun Anda.',action:'DENIED',requiresConfirmation:false,tool:null,arguments:{}});
  if(parsed.tool==='getPartnerOrders'){
    const scope=String(parsed.args.scope||'active');const statuses=scope==='new'||scope==='unresponded'?['NEW','OFFERED']:['NEW','OFFERED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS'];
    const rows=await db.order.findMany({where:{partnerId:ctx.partnerId,status:{in:statuses as ('NEW'|'OFFERED'|'ACCEPTED'|'ON_THE_WAY'|'ARRIVED'|'IN_PROGRESS')[]}},orderBy:{createdAt:'desc'},take:20,select:{id:true,publicId:true,status:true,scheduledAt:true,total:true,createdAt:true,customer:{select:{name:true}}}});
    const label=scope==='new'?'order baru':scope==='unresponded'?'order belum direspons':'order aktif';
    return out({intent:parsed.intent,confidence:parsed.confidence,message:rows.length?`Ada ${rows.length} ${label} pada toko Anda.`:`Tidak ada ${label} pada toko Anda saat ini.`,action:'SHOW_ORDERS',requiresConfirmation:false,tool:'getPartnerOrders',arguments:{scope},data:rows});
  }
  if(parsed.tool==='getPartnerRating'){
    const data=await db.partner.findUniqueOrThrow({where:{id:ctx.partnerId},select:{ratingAvg:true,ratingCount:true}});const count=data.ratingCount;return out({intent:parsed.intent,confidence:parsed.confidence,message:count?`Rating toko Anda ${Number(data.ratingAvg).toFixed(2)} dari ${count} ulasan.`:'Toko Anda belum memiliki ulasan.',action:'SHOW_ANALYTICS',requiresConfirmation:false,tool:'getPartnerRating',arguments:{},data:{rating:Number(data.ratingAvg),ratingCount:count}});
  }
  if(parsed.tool==='getPartnerAnalytics'){
    const since=parsed.args.since instanceof Date?parsed.args.since:startOf30Days(),period=String(parsed.args.period||'30 hari terakhir'),data=await partnerAnalytics(ctx.partnerId,since);
    const msg=parsed.intent==='ANALYTICS_REVENUE'?`Pendapatan order selesai ${period} ${money(data.revenue)}.`:`Layanan paling banyak dipesan ${period}: ${data.topService?`${data.topService.name} (${data.topService.quantity})`:'belum ada data'}.`;
    return out({intent:parsed.intent,confidence:parsed.confidence,message:msg,action:'SHOW_ANALYTICS',requiresConfirmation:false,tool:'getPartnerAnalytics',arguments:{period},data});
  }
  if(parsed.tool==='getPartnerServices'){
    const data=await db.partnerService.findMany({where:{partnerId:ctx.partnerId},orderBy:{service:{name:'asc'}},select:{serviceId:true,active:true,customPrice:true,service:{select:{name:true,basePrice:true,unit:true}}}});return out({intent:parsed.intent,confidence:parsed.confidence,message:`Toko Anda memiliki ${data.length} relasi layanan.`,action:'SHOW_SERVICES',requiresConfirmation:false,tool:'getPartnerServices',arguments:{},data});
  }
  if(parsed.tool==='getPartnerReviews'){
    const data=await db.review.findMany({where:{order:{partnerId:ctx.partnerId},published:true},orderBy:{createdAt:'desc'},take:20,select:{id:true,rating:true,comment:true,createdAt:true,order:{select:{publicId:true}}}});return out({intent:parsed.intent,confidence:parsed.confidence,message:data.length?`Ada ${data.length} ulasan terbaru yang dapat ditampilkan.`:'Belum ada ulasan pelanggan.',action:'SHOW_REVIEWS',requiresConfirmation:false,tool:'getPartnerReviews',arguments:{},data});
  }
  if(parsed.tool==='getAlerts'){
    const now=new Date(),soon=new Date(now.getTime()+24*60*60*1000);const [newOrders,dueSoon,disabledServices,partner,reviews]=await Promise.all([db.order.count({where:{partnerId:ctx.partnerId,status:{in:['NEW','OFFERED']}}}),db.order.count({where:{partnerId:ctx.partnerId,status:{in:['ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS']},scheduledAt:{gte:now,lte:soon}}}),db.partnerService.count({where:{partnerId:ctx.partnerId,active:false}}),db.partner.findUniqueOrThrow({where:{id:ctx.partnerId},select:{online:true,storefront:{select:{description:true,tagline:true}}}}),db.review.count({where:{order:{partnerId:ctx.partnerId},published:true,createdAt:{gte:startOfDay()}}})]);const alerts={newOrders,dueSoon,reviewsToday:reviews,disabledServices,storeOffline:!partner.online,profileIncomplete:!partner.storefront?.description||!partner.storefront?.tagline};return out({intent:parsed.intent,confidence:parsed.confidence,message:`Alert: ${newOrders} order belum direspons, ${dueSoon} order mendekati jadwal, ${disabledServices} layanan nonaktif.`,action:'SHOW_ALERTS',requiresConfirmation:false,tool:'getAlerts',arguments:{},data:alerts});
  }
  if(parsed.tool==='getPartnerOrderDetail'){
    const ref=String(parsed.args.orderRef||'');const row=await db.order.findFirst({where:{partnerId:ctx.partnerId,OR:[{id:ref},{publicId:ref}]},select:{id:true}});if(!row)return out({intent:'ORDER_DETAIL',confidence:parsed.confidence,message:'Order tersebut tidak ditemukan pada toko Anda.',action:'NOT_FOUND',requiresConfirmation:false,tool:'getPartnerOrderDetail',arguments:{orderRef:ref}});const data=await partnerOrderDetail(ctx.partnerId,row.id);return out({intent:'ORDER_DETAIL',confidence:parsed.confidence,message:`Detail ${data.publicId}: status ${data.status}, total ${money(data.total)}.`,action:'SHOW_ORDER',requiresConfirmation:false,tool:'getPartnerOrderDetail',arguments:{orderId:row.id},data});
  }
  if(parsed.tool==='getPartnerProfile'){
    const data=await db.partner.findUniqueOrThrow({where:{id:ctx.partnerId},select:{businessName:true,status:true,online:true,dispatchEnabled:true,storefrontStatus:true,storefront:{select:{displayName:true,tagline:true,description:true}},services:{where:{active:true},select:{serviceId:true,customPrice:true,service:{select:{name:true,basePrice:true}}}},areas:{select:{area:{select:{name:true}}}}}});return out({intent:'STORE_PROFILE',confidence:parsed.confidence,message:`Profil ${data.businessName}: ${data.services.length} layanan aktif, ${data.areas.length} area layanan, toko ${data.online?'ONLINE':'OFFLINE'}.`,action:'SHOW_PROFILE',requiresConfirmation:false,tool:'getPartnerProfile',arguments:{},data});
  }
  if(parsed.tool==='updateServicePrice'){
    const serviceId=String(parsed.args.serviceId),price=Number(parsed.args.price),serviceName=String(parsed.args.serviceName),currentPrice=Number(parsed.args.currentPrice);const token=await confirmationToken({partnerId:ctx.partnerId,userId:ctx.userId,tool:'updateServicePrice',arguments:{serviceId,price}});return out({intent:'CHANGE_PRICE',confidence:parsed.confidence,message:`Harga ${serviceName} saat ini ${money(currentPrice)}. Ubah menjadi ${money(price)}?`,action:'CONFIRM_TOOL',requiresConfirmation:true,tool:'updateServicePrice',arguments:{serviceId,price},confirmationToken:token});
  }
  if(parsed.tool==='orderAction'){
    const ref=String(parsed.args.orderRef),action=String(parsed.args.action) as PartnerOrderAction;const row=await db.order.findFirst({where:{partnerId:ctx.partnerId,OR:[{id:ref},{publicId:ref}]},select:{id:true,publicId:true,status:true}});if(!row)return out({intent:parsed.intent,confidence:parsed.confidence,message:'Order tersebut tidak ditemukan pada toko Anda.',action:'NOT_FOUND',requiresConfirmation:false,tool:'orderAction',arguments:{orderRef:ref}});const token=await confirmationToken({partnerId:ctx.partnerId,userId:ctx.userId,tool:'orderAction',arguments:{orderId:row.id,action}});return out({intent:parsed.intent,confidence:parsed.confidence,message:`${action==='ACCEPT'?'Terima':action==='REJECT'?'Tolak':action==='DEPART'?'Tandai berangkat':action==='ARRIVE'?'Tandai tiba':action==='START'?'Mulai pengerjaan':'Tandai selesai'} order ${row.publicId} dari status ${row.status}?`,action:'CONFIRM_TOOL',requiresConfirmation:true,tool:'orderAction',arguments:{orderId:row.id,action},confirmationToken:token});
  }
  return out({intent:'UNKNOWN',confidence:parsed.confidence,message:'Saya dapat membantu order, analytics, profil, layanan, ulasan, alert, serta menyiapkan perubahan harga atau status order dengan konfirmasi Anda.',action:'NONE',requiresConfirmation:false,tool:null,arguments:{}});
}

export async function confirmPartnerAgent(ctx:{partnerId:string;userId:string},token:string):Promise<AgentResult>{
  const payload=await readConfirmation(token);if(payload.partnerId!==ctx.partnerId||payload.userId!==ctx.userId)throw new Error('FORBIDDEN');
  if(payload.tool==='updateServicePrice'){const result=await updateOwnedServicePrice({partnerId:ctx.partnerId,userId:ctx.userId,serviceId:String(payload.arguments.serviceId),price:Number(payload.arguments.price),source:'AGENT'});return out({intent:'CHANGE_PRICE',confidence:1,message:`Harga ${result.serviceName} berhasil diubah dari ${money(result.before)} menjadi ${money(result.after)}.`,action:'TOOL_EXECUTED',requiresConfirmation:false,tool:'updateServicePrice',arguments:{serviceId:result.serviceId,price:result.after},data:result})}
  const action=String(payload.arguments.action) as PartnerOrderAction;const result=await executePartnerOrderAction({partnerId:ctx.partnerId,userId:ctx.userId,orderId:String(payload.arguments.orderId),action,source:'AGENT'});return out({intent:`ORDER_${action}`,confidence:1,message:`Order berhasil diperbarui ke ${result.status}.`,action:'TOOL_EXECUTED',requiresConfirmation:false,tool:'orderAction',arguments:{orderId:result.orderId,action},data:result});
}
