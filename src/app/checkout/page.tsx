import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {Header} from '@/components/Header';
import {CheckoutForm} from './ui';
import {unitLabel} from '@/lib/marketplace';

export const dynamic='force-dynamic';
export const metadata={title:'Checkout | JasaBatam',robots:{index:false,follow:false}};

export default async function Page({searchParams}:{searchParams:Promise<{service?:string;partner?:string;area?:string}>}){
  const {service,partner,area}=await searchParams;if(!service||!partner)notFound();
  const s=await db.service.findFirst({where:{id:service,active:true,archivedAt:null,category:{active:true,archivedAt:null}},include:{category:true,serviceAreas:true}});if(!s)notFound();
  let selectedPartner:null|{id:string;businessName:string;slug:string|null;customPrice:number|null;rating:number;ratingCount:number;completedOrders:number;logo:string|null;areas:{id:string;name:string;slug:string}[]}=null;
    const ps=await db.partnerService.findFirst({where:{partnerId:partner,serviceId:s.id,active:true,partner:{user:{active:true},online:true,dispatchEnabled:true,status:{notIn:['REJECTED','SUSPENDED']},storefrontStatus:{not:'HIDDEN'}}},select:{customPrice:true,partner:{select:{id:true,businessName:true,slug:true,ratingAvg:true,ratingCount:true,areas:{select:{area:{select:{id:true,name:true,slug:true}}}},media:{where:{hidden:false,kind:{in:['LOGO','PROFILE']}},orderBy:{sortOrder:'asc'},take:1,select:{url:true}},_count:{select:{orders:{where:{status:'COMPLETED'}}}}}}}});
  if(!ps)notFound();
  selectedPartner={id:ps.partner.id,businessName:ps.partner.businessName,slug:ps.partner.slug,customPrice:ps.customPrice,rating:Number(ps.partner.ratingAvg),ratingCount:ps.partner.ratingCount,completedOrders:ps.partner._count.orders,logo:ps.partner.media[0]?.url||null,areas:ps.partner.areas.map(x=>x.area)};
  const serviceAreaIds=s.serviceAreas.filter(x=>x.active).map(x=>x.areaId);
  const partnerAreaIds=selectedPartner?selectedPartner.areas.map(x=>x.id):[];
  const allowedAreaIds=selectedPartner?(serviceAreaIds.length?serviceAreaIds.filter(id=>partnerAreaIds.includes(id)):partnerAreaIds):serviceAreaIds;
  const areas=await db.area.findMany({where:{active:true,...(allowedAreaIds.length?{id:{in:allowedAreaIds}}:selectedPartner?{id:{in:[]}}:{})},select:{id:true,name:true,slug:true,surcharge:true},orderBy:{name:'asc'}});
  const defaultArea=area?areas.find(x=>x.slug===area)?.id:undefined;
  if(area&&!defaultArea)notFound();
  const unitPrice=selectedPartner?.customPrice??s.basePrice;
  return <><Header/><main className="checkout-market-page"><div className="container checkout-market-shell"><nav className="checkout-breadcrumb"><Link href="/">Beranda</Link><span>›</span><Link href={`/jasa/${s.category.slug}${area?`?area=${encodeURIComponent(area)}`:''}`}>{s.category.name}</Link><span>›</span><b>Checkout</b></nav><section className="checkout-service-hero"><div className="checkout-service-icon">{selectedPartner?.logo?<img src={selectedPartner.logo} alt={`Logo ${selectedPartner.businessName}`}/>:<span>{s.name.slice(0,2).toUpperCase()}</span>}</div><div><p>{s.category.name}</p><h1>{s.name}</h1>{selectedPartner&&<h2>oleh {selectedPartner.businessName}</h2>}<div className="checkout-service-stats">{selectedPartner?.ratingCount?<span>★ {selectedPartner.rating.toFixed(1)} ({selectedPartner.ratingCount} ulasan)</span>:<span>Belum ada ulasan</span>}{selectedPartner&&selectedPartner.completedOrders>0&&<span>{selectedPartner.completedOrders} order selesai</span>}{defaultArea&&<span>{areas.find(x=>x.id===defaultArea)?.name}</span>}</div></div></section><CheckoutForm service={{id:s.id,name:s.name,basePrice:unitPrice,minimumCharge:s.minimumCharge,pricingType:s.pricingType,unit:unitLabel(s.unit,s.pricingType)}} areas={areas} partner={selectedPartner} defaultAreaId={defaultArea}/></div></main></>;
}
