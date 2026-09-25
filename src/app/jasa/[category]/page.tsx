import type {Metadata} from 'next';
import Link from 'next/link';
import {Prisma} from '@prisma/client';
import {Search,MapPin,SlidersHorizontal,Store,ChevronRight} from 'lucide-react';
import {db} from '@/lib/db';
import {Header} from '@/components/Header';
import {MarketplacePartnerCard} from '@/components/MarketplacePartnerCard';
import {notFound} from 'next/navigation';
import {unitLabel} from '@/lib/marketplace';

export const dynamic='force-dynamic';
type SP={area?:string;q?:string;sort?:string;page?:string};

export async function generateMetadata({params,searchParams}:{params:Promise<{category:string}>;searchParams:Promise<SP>}):Promise<Metadata>{
  const [{category},sp]=await Promise.all([params,searchParams]);
  const [c,a]=await Promise.all([
    db.category.findFirst({where:{slug:category,active:true,archivedAt:null},select:{name:true,seoTitle:true,seoDescription:true,description:true}}),
    sp.area?db.area.findFirst({where:{slug:sp.area,active:true},select:{name:true}}):Promise.resolve(null)
  ]);
  if(!c)return {title:'Kategori tidak ditemukan',robots:{index:false,follow:false}};
  const location=a?.name?`${a.name} Batam`:'Batam';
  const title=a?`${c.name} ${a.name} Batam | JasaBatam`:(c.seoTitle||`${c.name} di Batam | JasaBatam`);
  const description=c.seoDescription||c.description||`Temukan mitra ${c.name} yang tersedia di ${location}.`;
  const canonical=a?`/jasa/${category}?area=${encodeURIComponent(sp.area!)}`:`/jasa/${category}`;
  return {title,description,alternates:{canonical},openGraph:{title,description,url:canonical}};
}

export default async function Page({params,searchParams}:{params:Promise<{category:string}>;searchParams:Promise<SP>}){
  const [{category},sp]=await Promise.all([params,searchParams]);
  const page=Math.max(1,Number.parseInt(sp.page||'1',10)||1),pageSize=12,keyword=(sp.q||'').trim(),sort=['rating','orders','name','recommended'].includes(sp.sort||'')?sp.sort!:'recommended';
  const [c,areas,categories]=await Promise.all([
    db.category.findFirst({where:{slug:category,active:true,archivedAt:null},select:{id:true,name:true,slug:true,description:true,imageUrl:true}}),
    db.area.findMany({where:{active:true},select:{id:true,name:true,slug:true},orderBy:{name:'asc'}}),
    db.category.findMany({where:{active:true,archivedAt:null},select:{id:true,name:true,slug:true},orderBy:[{sortOrder:'asc'},{name:'asc'}],take:8})
  ]);
  if(!c)notFound();
  const selectedArea=sp.area?areas.find(x=>x.slug===sp.area)||null:null;
  if(sp.area&&!selectedArea)notFound();
  const where:Prisma.PartnerWhereInput={
    user:{active:true},online:true,dispatchEnabled:true,status:{notIn:['REJECTED','SUSPENDED']},storefrontStatus:{not:'HIDDEN'},
    ...(selectedArea?{areas:{some:{areaId:selectedArea.id}}}:{}),
    services:{some:{active:true,service:{categoryId:c.id,active:true,archivedAt:null}}},
    ...(keyword?{OR:[{businessName:{contains:keyword,mode:'insensitive'}},{name:{contains:keyword,mode:'insensitive'}},{services:{some:{active:true,service:{categoryId:c.id,name:{contains:keyword,mode:'insensitive'}}}}}]}:{})
  };
  const orderBy:Prisma.PartnerOrderByWithRelationInput[]=sort==='name'?[{businessName:'asc'}]:sort==='rating'?[{ratingAvg:'desc'},{ratingCount:'desc'},{businessName:'asc'}]:sort==='orders'?[{orders:{_count:'desc'}},{ratingAvg:'desc'},{businessName:'asc'}]:[{ratingCount:'desc'},{ratingAvg:'desc'},{createdAt:'asc'}];
  const [rows,total]=await Promise.all([
    db.partner.findMany({where,orderBy,skip:(page-1)*pageSize,take:pageSize,select:{
      id:true,businessName:true,slug:true,status:true,storefrontStatus:true,online:true,ratingAvg:true,ratingCount:true,createdAt:true,
      services:{where:{active:true,service:{categoryId:c.id,active:true,archivedAt:null}},orderBy:{service:{sortOrder:'asc'}},select:{customPrice:true,service:{select:{id:true,name:true,basePrice:true,unit:true,pricingType:true}}}},
      areas:{select:{area:{select:{name:true,slug:true}}}},
      media:{where:{hidden:false,kind:{in:['BANNER','LOGO','PROFILE']}},orderBy:[{kind:'asc'},{sortOrder:'asc'}],select:{kind:true,url:true}},
      _count:{select:{orders:{where:{status:'COMPLETED'}}}}
    }}),
    db.partner.count({where})
  ]);
  const rankRows=selectedArea&&rows.length?await db.partnerRankingSnapshot.findMany({where:{categoryId:c.id,areaId:selectedArea.id,eligible:true,partnerId:{in:rows.map(x=>x.id)}},select:{partnerId:true,rank:true}}):[];
  const rankMap=new Map(rankRows.filter(x=>x.rank!=null).map(x=>[x.partnerId,x.rank!]));
  const fallbackBanner=c.imageUrl||'/images/batam/hero-batam.webp';
  const partners=rows.map(p=>{
    const rank=rankMap.get(p.id);
    return {
      id:p.id,slug:p.storefrontStatus==='PUBLISHED'?p.slug:null,businessName:p.businessName,status:p.status,online:p.online,
      rating:Number(p.ratingAvg),ratingCount:p.ratingCount,completedOrders:p._count.orders,areaName:selectedArea?.name||p.areas[0]?.area.name||'Batam',
      banner:p.media.find(m=>m.kind==='BANNER')?.url||fallbackBanner,
      logo:p.media.find(m=>m.kind==='LOGO')?.url||p.media.find(m=>m.kind==='PROFILE')?.url||null,
      rankLabel:rank&&selectedArea?`#${rank} ${c.name} di ${selectedArea.name}`:null,
      services:p.services.map(x=>({id:x.service.id,name:x.service.name,price:x.customPrice??x.service.basePrice,unit:unitLabel(x.service.unit,x.service.pricingType),pricingType:x.service.pricingType}))
    };
  });
  const pages=Math.max(1,Math.ceil(total/pageSize));
  const pageHref=(n:number)=>{const q=new URLSearchParams();if(sp.area)q.set('area',sp.area);if(keyword)q.set('q',keyword);if(sort!=='recommended')q.set('sort',sort);q.set('page',String(n));return `/jasa/${c.slug}?${q}`};
  const heroTitle=selectedArea?`${c.name} di ${selectedArea.name}, Batam`:`${c.name} di Batam`;
  return <><Header/><main className="market-page">
    <section className="market-hero"><div className="container market-hero-inner"><div><nav className="market-breadcrumb"><Link href="/">Beranda</Link><ChevronRight/><Link href="/jasa">Jasa</Link><ChevronRight/><span>{c.name}</span>{selectedArea&&<><ChevronRight/><b>{selectedArea.name}</b></>}</nav><h1>{heroTitle}</h1><p>{selectedArea?`Temukan layanan ${c.name.toLowerCase()} yang tersedia di area ${selectedArea.name}.`:(c.description||`Temukan mitra ${c.name.toLowerCase()} di Batam dengan harga transparan.`)}</p></div><div className="market-hero-location"><MapPin/><div><b>{selectedArea?.name||'Batam'}</b><small>{total} mitra tersedia</small></div></div></div></section>
    <div className="container market-shell">
      <nav className="market-category-tabs" aria-label="Kategori jasa">{categories.map(x=><Link key={x.id} className={x.id===c.id?'active':''} href={`/jasa/${x.slug}${sp.area?`?area=${encodeURIComponent(sp.area)}`:''}`}><Store size={18}/><span>{x.name}</span></Link>)}</nav>
      <form className="market-filters">
        <label><MapPin/><select name="area" defaultValue={sp.area||''}><option value="">Semua area Batam</option>{areas.map(a=><option key={a.id} value={a.slug}>{a.name}</option>)}</select></label>
        <label className="market-search"><Search/><input name="q" defaultValue={keyword} placeholder="Cari nama mitra atau layanan..."/></label>
        <button className="btn primary">Cari</button>
        <label className="market-sort"><SlidersHorizontal/><select name="sort" defaultValue={sort}><option value="recommended">Rekomendasi</option><option value="rating">Rating</option><option value="orders">Order terbanyak</option><option value="name">Nama A–Z</option></select></label>
      </form>
      <section className="market-results-head"><div><h2>{selectedArea?`Mitra ${c.name} di ${selectedArea.name}`:`Mitra ${c.name} di Batam`}</h2><p>{total} mitra ditemukan berdasarkan status operasional dan area layanan aktual.</p></div></section>
      {partners.length?<div className="market-partner-grid">{partners.map(p=><MarketplacePartnerCard key={p.id} partner={p} areaSlug={selectedArea?.slug}/>)}</div>:<div className="market-empty"><Store/><h2>Belum ada mitra aktif pada pilihan ini</h2><p>Coba area lain atau hapus kata pencarian. Mitra REJECTED, SUSPENDED, OFFLINE, dispatch nonaktif, atau storefront tersembunyi tidak ditampilkan.</p></div>}
      {pages>1&&<nav className="market-pagination"><span>Halaman {page} dari {pages}</span><div>{page>1&&<Link href={pageHref(page-1)}>Sebelumnya</Link>}{page<pages&&<Link href={pageHref(page+1)}>Berikutnya</Link>}</div></nav>}
    </div>
  </main></>;
}
