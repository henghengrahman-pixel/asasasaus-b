import type {Metadata} from 'next';
import Link from 'next/link';
import {ChevronRight,MapPin,Search,Store} from 'lucide-react';
import {db} from '@/lib/db';
import {Header} from '@/components/Header';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Cari Jasa di Batam | JasaBatam',description:'Pilih area dan kategori untuk menemukan mitra jasa lokal aktif di Batam.',alternates:{canonical:'/jasa'}};
type SP={area?:string;q?:string};

export default async function Page({searchParams}:{searchParams:Promise<SP>}){
  const sp=await searchParams,keyword=(sp.q||'').trim();
  const [areas,categories]=await Promise.all([
    db.area.findMany({where:{active:true},select:{id:true,name:true,slug:true},orderBy:{name:'asc'}}),
    db.category.findMany({where:{active:true,archivedAt:null,...(keyword?{OR:[{name:{contains:keyword,mode:'insensitive'}},{description:{contains:keyword,mode:'insensitive'}}]}:{})},select:{id:true,name:true,slug:true,description:true,imageUrl:true},orderBy:[{sortOrder:'asc'},{name:'asc'}]})
  ]);
  const selectedArea=sp.area?areas.find(x=>x.slug===sp.area)||null:null;
  const eligibleLinks=selectedArea?await db.partnerService.findMany({where:{active:true,service:{active:true,archivedAt:null,category:{active:true,archivedAt:null}},partner:{user:{active:true},online:true,dispatchEnabled:true,status:{notIn:['REJECTED','SUSPENDED']},storefrontStatus:{not:'HIDDEN'},areas:{some:{areaId:selectedArea.id}}}},select:{partnerId:true,service:{select:{categoryId:true}}}}):[];
  const categoryPartners=new Map<string,Set<string>>();for(const row of eligibleLinks){const set=categoryPartners.get(row.service.categoryId)??new Set<string>();set.add(row.partnerId);categoryPartners.set(row.service.categoryId,set)}
  const countMap=new Map([...categoryPartners].map(([categoryId,set])=>[categoryId,set.size]));
  return <><Header/><main className="market-page"><section className="market-hero"><div className="container market-hero-inner"><div><nav className="market-breadcrumb"><Link href="/">Beranda</Link><ChevronRight/><b>Jasa</b></nav><h1>{selectedArea?`Jasa di ${selectedArea.name}, Batam`:'Temukan Jasa di Batam'}</h1><p>{selectedArea?`Pilih kategori untuk melihat mitra aktif yang benar-benar melayani ${selectedArea.name}.`:'Pilih area terlebih dahulu, lalu pilih kategori. Layanan dipilih setelah Anda masuk ke toko mitra.'}</p></div>{selectedArea&&<div className="market-hero-location"><MapPin/><div><b>{selectedArea.name}</b><small>Area pilihan Anda</small></div></div>}</div></section><div className="container market-shell"><form className="market-filters market-discovery-filters"><label><MapPin/><select name="area" defaultValue={sp.area||''}><option value="">Pilih area Batam</option>{areas.map(a=><option key={a.id} value={a.slug}>{a.name}</option>)}</select></label><label className="market-search"><Search/><input name="q" defaultValue={keyword} placeholder="Cari kategori jasa..."/></label><button className="btn primary">Terapkan</button></form><section className="market-results-head"><div><h2>{selectedArea?`Pilih Kategori di ${selectedArea.name}`:'Pilih Area lalu Kategori'}</h2><p>Tidak ada lagi flow “Pilih Layanan” dari halaman discovery. Customer memilih mitra terlebih dahulu, baru memilih layanan milik mitra.</p></div></section>{selectedArea?<div className="market-category-discovery-grid">{categories.map(c=><Link className="market-category-discovery-card" href={`/jasa/${c.slug}?area=${encodeURIComponent(selectedArea.slug)}`} key={c.id}><div className="market-category-discovery-image">{c.imageUrl?<img src={c.imageUrl} alt={c.name}/>:<Store/>}</div><div><h3>{c.name}</h3><p>{c.description||`Temukan mitra ${c.name.toLowerCase()} di ${selectedArea.name}.`}</p><b>{countMap.get(c.id)||0} mitra aktif</b></div><ChevronRight/></Link>)}</div>:<div className="market-empty"><MapPin/><h2>Pilih area terlebih dahulu</h2><p>Setelah area dipilih, kategori akan menampilkan jumlah mitra aktif dari database untuk area tersebut.</p></div>}</div></main></>;
}
