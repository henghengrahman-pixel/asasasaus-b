import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {currentPartner} from '@/lib/partner-auth';
import {isTrustedMutationOrigin,externalUrl} from '@/lib/request-security';
import {sanitizePlainText} from '@/lib/plain-text';

const schema=z.object({
  mode:z.enum(['draft','publish']),displayName:z.string().trim().min(2).max(120),tagline:z.string().trim().max(180).optional(),description:z.string().trim().max(3000).optional(),whatsapp:z.string().trim().max(30).optional(),publicAddress:z.string().trim().max(500).optional(),estimatedResponseMinutes:z.coerce.number().int().min(1).max(1440).optional(),facilities:z.string().max(2000).optional(),serviceIds:z.string().max(10000).optional(),areaIds:z.string().max(10000).optional(),hoursJson:z.string().max(10000).optional(),promoTitle:z.string().trim().max(160).optional(),promoDescription:z.string().trim().max(1000).optional()
});
function csv(v?:string){return [...new Set((v||'').split(',').map(x=>x.trim()).filter(Boolean))]}

export async function POST(r:Request){
  const auth=await currentPartner();
  if(!auth)return NextResponse.json({error:'UNAUTHENTICATED'},{status:401});
  if(!isTrustedMutationOrigin(r))return NextResponse.json({error:'CSRF'},{status:403});
  try{
    const p=schema.parse(Object.fromEntries(await r.formData()));
    const serviceIds=csv(p.serviceIds),areaIds=csv(p.areaIds),facilities=csv(p.facilities).map(sanitizePlainText).filter(Boolean);
    const hours=z.array(z.object({dayOfWeek:z.number().int().min(0).max(6),openMinute:z.number().int().min(0).max(1439).nullable(),closeMinute:z.number().int().min(1).max(1440).nullable(),closed:z.boolean()})).max(7).parse(p.hoursJson?JSON.parse(p.hoursJson):[]);
    const clean={displayName:sanitizePlainText(p.displayName),tagline:p.tagline?sanitizePlainText(p.tagline):null,description:p.description?sanitizePlainText(p.description):null,whatsapp:p.whatsapp?sanitizePlainText(p.whatsapp):null,publicAddress:p.publicAddress?sanitizePlainText(p.publicAddress):null,promoTitle:p.promoTitle?sanitizePlainText(p.promoTitle):null,promoDescription:p.promoDescription?sanitizePlainText(p.promoDescription):null};
    if(clean.displayName.length<2)throw new Error('DISPLAY_NAME_INVALID');
    const draft={...clean,estimatedResponseMinutes:p.estimatedResponseMinutes||null,facilities,serviceIds,areaIds,hours};
    if(p.mode==='draft'){
      await db.partnerStorefront.upsert({where:{partnerId:auth.partner.id},create:{partnerId:auth.partner.id,draftData:draft},update:{draftData:draft}});
      return NextResponse.redirect(externalUrl(r,'/mitra/profil-toko?saved=1'),303);
    }
    const [validServices,validAreas]=await Promise.all([
      db.service.findMany({where:{id:{in:serviceIds},active:true,archivedAt:null},select:{id:true}}),
      db.area.findMany({where:{id:{in:areaIds},active:true},select:{id:true}})
    ]);
    if(validServices.length!==serviceIds.length||validAreas.length!==areaIds.length)throw new Error('SERVICE_AREA_INVALID');
    await db.$transaction(async tx=>{
      await tx.partnerStorefront.upsert({where:{partnerId:auth.partner.id},create:{partnerId:auth.partner.id,displayName:clean.displayName,tagline:clean.tagline,description:clean.description,whatsapp:clean.whatsapp,publicAddress:clean.publicAddress,estimatedResponseMinutes:p.estimatedResponseMinutes||null,facilities,publishedAt:new Date(),draftData:draft},update:{displayName:clean.displayName,tagline:clean.tagline,description:clean.description,whatsapp:clean.whatsapp,publicAddress:clean.publicAddress,estimatedResponseMinutes:p.estimatedResponseMinutes||null,facilities,publishedAt:new Date(),draftData:draft}});
      await tx.partner.update({where:{id:auth.partner.id},data:{storefrontStatus:'PUBLISHED'}});
      const existingServices=await tx.partnerService.findMany({where:{partnerId:auth.partner.id},select:{serviceId:true}});
      const existingServiceIds=new Set(existingServices.map(x=>x.serviceId));
      await tx.partnerService.deleteMany({where:{partnerId:auth.partner.id,...(serviceIds.length?{serviceId:{notIn:serviceIds}}:{})}});
      const newServiceIds=serviceIds.filter(id=>!existingServiceIds.has(id));
      if(newServiceIds.length)await tx.partnerService.createMany({data:newServiceIds.map(serviceId=>({partnerId:auth.partner.id,serviceId}))});
      const existingAreas=await tx.partnerArea.findMany({where:{partnerId:auth.partner.id},select:{areaId:true}});
      const existingAreaIds=new Set(existingAreas.map(x=>x.areaId));
      await tx.partnerArea.deleteMany({where:{partnerId:auth.partner.id,...(areaIds.length?{areaId:{notIn:areaIds}}:{})}});
      const newAreaIds=areaIds.filter(id=>!existingAreaIds.has(id));
      if(newAreaIds.length)await tx.partnerArea.createMany({data:newAreaIds.map(areaId=>({partnerId:auth.partner.id,areaId}))});
      await tx.partnerBusinessHour.deleteMany({where:{partnerId:auth.partner.id}});
      if(hours.length)await tx.partnerBusinessHour.createMany({data:hours.map(h=>({...h,partnerId:auth.partner.id}))});
      await tx.partnerPromotion.deleteMany({where:{partnerId:auth.partner.id}});
      if(clean.promoTitle)await tx.partnerPromotion.create({data:{partnerId:auth.partner.id,title:clean.promoTitle,description:clean.promoDescription}});
      await tx.auditLog.create({data:{actorUserId:auth.user.id,action:'PARTNER_STOREFRONT_PUBLISH',entityType:'Partner',entityId:auth.partner.id}});
    });
    return NextResponse.redirect(externalUrl(r,'/mitra/profil-toko?published=1'),303);
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'INVALID'},{status:400})}
}
