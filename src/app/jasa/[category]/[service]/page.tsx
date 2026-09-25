import type {Metadata} from 'next';
import {Prisma} from '@prisma/client';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ChevronRight,MapPin,Search,Store} from 'lucide-react';
import {db} from '@/lib/db';
import {Header} from '@/components/Header';
import {MarketplacePartnerCard} from '@/components/MarketplacePartnerCard';
import {unitLabel} from '@/lib/marketplace';

export const dynamic='force-dynamic';
type SP={area?:string;q?:string;page?:string};
export async function generateMetadata({params,searchParams}:{params:Promise<{category:string;service:string}>;searchParams:Promise<SP>}):Promise<Metadata>{
  const [{category,service},sp]=await Promise.all([params,searchParams]);
  const s=await db.service.findFirst({where:{slug:service,active:true,archivedAt:null,category:{slug:category,active:true,archivedAt:null}},select:{name:true,seoTitle:true,seoDescription:true,description:true}});
  if(!s)return {title:'Layanan tidak ditemukan',robots:{index:false,follow:false}};
  const a=sp.area?await db.area.findFirst({where:{slug:sp.area,active:true},select:{name:true}}):null;
  const title=a?`${s.name} ${a.name} Batam | JasaBatam`:(s.seoTitle||`${s.name} di Batam | JasaBatam`);
  const description=s.seoDescription||s.description||`Temukan mitra ${s.name} di ${a?.name||'Batam'} dan pilih toko sebelum checkout.`;
  const canonical=`/jasa/${category}/${service}${sp.area?`?area=${encodeURIComponent(sp.area)}`:''}`;
  return {title,description,alternates:{canonical},openGraph:{title,description,url:canonical}};
}

export default async function Page({params,searchParams}:{params:Promise<{category:string;service:string}>;searchParams:Promise<SP>}){
  const [{category,service},sp]=await Promise.all([params,searchParams]);
  const s=await db.service.findFirst({where:{slug:service,active:true,archivedAt:null,category:{slug:category,active:true,archivedAt:null}},include:{category:true,serviceAreas:true}});
  if(!s)notFound();
  const areas=await db.area.findMany({where:{active:true,...(s.serviceAreas.length?{id:{in:s.serviceAreas.filter(x=>x.active).map(x=>x.areaId)}}:{})},select:{id:true,name:true,slug:true},orderBy:{name:'asc'}});
  const selectedArea=sp.area?areas.find(x=>x.slug===sp.area)||null:null;
  if(sp.area&&!selectedArea)notFound();
  const keyword=(sp.q||'').trim();const page=Math.max(1,Number.parseInt(sp.page||'1',10)||1),pageSize=12;
  const where:Prisma.PartnerWhereInput={user:{active:true},online:true,dispatchEnabled:true,status:{notIn:['REJECTED','SUSPENDED']},storefrontStatus:{not:'HIDDEN'},services:{some:{serviceId:s.id,active:true}},...(selectedArea?{areas:{some:{areaId:selectedArea.id}}}:{}),...(keyword?{OR:[{businessName:{contains:keyword,mode:'insensitive'}},{name:{contains:keyword,mode:'insensitive'}}]}:{})};
  const [rows,total]=await Promise.all([
    db.partner.findMany({where,orderBy:[{ratingCount:'desc'},{ratingAvg:'desc'},{createdAt:'asc'}],skip:(page-1)*pageSize,take:pageSize,select:{id:true,businessName:true,slug:true,status:true,storefrontStatus:true,online:true,ratingAvg:true,ratingCount:true,services:{where:{serviceId:s.id,active:true},select:{customPrice:true,service:{select:{id:true,name:true,basePrice:true,unit:true,pricingType:true}}}},areas:{select:{area:{select:{name:true,slug:true}}}},media:{where:{hidden:false,kind:{in:['BANNER','LOGO','PROFILE']}},select:{kind:true,url:true}},_count:{select:{orders:{where:{status:'COMPLETED'}}}}}}),
    db.partner.count({where})
  ]);
  const rankRows=selectedArea&&rows.length?await db.partnerRankingSnapshot.findMany({where:{categoryId:s.categoryId,areaId:selectedArea.id,eligible:true,partnerId:{in:rows.map(x=>x.id)}},select:{partnerId:true,rank:true}}):[];
  const rankMap=new Map(rankRows.filter(x=>x.rank!=null).map(x=>[x.partnerId,x.rank!])),fallback=s.imageUrl||s.category.imageUrl||'/images/batam/hero-batam.webp';
  const partners=rows.map(p=>{const rank=rankMap.get(p.id),ps=p.services[0];return {id:p.id,slug:p.storefrontStatus==='PUBLISHED'?p.slug:null,businessName:p.businessName,status:p.status,online:p.online,rating:Number(p.ratingAvg),ratingCount:p.ratingCount,completedOrders:p._count.orders,areaName:selectedArea?.name||p.areas[0]?.area.name||'Batam',banner:p.media.find(m=>m.kind==='BANNER')?.url||fallback,logo:p.media.find(m=>m.kind==='LOGO')?.url||p.media.find(m=>m.kind==='PROFILE')?.url||null,rankLabel:rank&&selectedArea?`#${rank} ${s.category.name} di ${selectedArea.name}`:null,services:ps?[{id:ps.service.id,name:ps.service.name,price:ps.customPrice??ps.service.basePrice,unit:unitLabel(ps.service.unit,ps.service.pricingType),pricingType:ps.service.pricingType}]:[]}});
  const pages=Math.max(1,Math.ceil(total/pageSize));
  const href=(n:number)=>{const q=new URLSearchParams();if(sp.area)q.set('area',sp.area);if(keyword)q.set('q',keyword);q.set('page',String(n));return `/jasa/${category}/${service}?${q}`};
  return <><Header/><main className="market-page"><section className="market-hero"><div className="container market-hero-inner"><div><nav className="market-breadcrumb"><Link href="/">Beranda</Link><ChevronRight/><Link href="/jasa">Jasa</Link><ChevronRight/><Link href={`/jasa/${category}${sp.area?`?area=${encodeURIComponent(sp.area)}`:''}`}>{s.category.name}</Link><ChevronRight/><b>{s.name}</b></nav><h1>{s.name}{selectedArea?` di ${selectedArea.name}, Batam`:' di Batam'}</h1><p>Pilih mitra/toko yang tersedia terlebih dahulu. Harga dan ketersediaan diverifikasi kembali saat checkout.</p></div><div className="market-hero-location"><MapPin/><div><b>{selectedArea?.name||'Batam'}</b><small>{total} mitra tersedia</small></div></div></div></section><div className="container market-shell"><form className="market-filters"><label><MapPin/><select name="area" defaultValue={sp.area||''}><option value="">Semua area Batam</option>{areas.map(a=><option key={a.id} value={a.slug}>{a.name}</option>)}</select></label><label className="market-search"><Search/><input name="q" defaultValue={keyword} placeholder="Cari nama mitra..."/></label><button className="btn primary">Cari</button></form><section className="market-results-head"><div><h2>{selectedArea?`Mitra ${s.name} di ${selectedArea.name}`:`Mitra ${s.name} di Batam`}</h2><p>{total} mitra memenuhi syarat operasional, layanan, dan area.</p></div></section>{partners.length?<div className="market-partner-grid">{partners.map(p=><MarketplacePartnerCard key={p.id} partner={p} areaSlug={selectedArea?.slug}/>)}</div>:<div className="market-empty"><Store/><h2>Belum ada mitra aktif pada lokasi tersebut</h2><p>Partner tanpa koordinat tetap dapat muncul jika PartnerArea cocok. Koordinat tidak diwajibkan untuk pencarian area manual.</p></div>}{pages>1&&<nav className="market-pagination"><span>Halaman {page} dari {pages}</span><div>{page>1&&<Link href={href(page-1)}>Sebelumnya</Link>}{page<pages&&<Link href={href(page+1)}>Berikutnya</Link>}</div></nav>}</div></main></>;
}
