import Image from 'next/image';
import Link from 'next/link';
import {
  Search,ShieldCheck,BadgeDollarSign,Zap,MapPinned,MapPin,ArrowRight,
  Snowflake,Shirt,Sparkles,Hammer,Monitor,Smartphone,Truck,Car,Bug,Droplets,Wrench,Ellipsis,
  CalendarDays,MessageCircle,CheckCircle2,Users,Star,Building2
} from 'lucide-react';
import {db} from '@/lib/db';
import {Header} from '@/components/Header';
import {ServiceCard} from '@/components/ServiceCard';

export const dynamic='force-dynamic';

const categoryIcon=(name:string)=>{
  const n=name.toLowerCase();
  if(n.includes('ac'))return Snowflake;if(n.includes('laundry'))return Shirt;if(n.includes('clean'))return Sparkles;
  if(n.includes('elektronik'))return Monitor;if(n.includes('hp')||n.includes('laptop'))return Smartphone;if(n.includes('pindah'))return Truck;
  if(n.includes('rental')||n.includes('kendaraan'))return Car;if(n.includes('pest')||n.includes('hama'))return Bug;if(n.includes('sedot')||n.includes('wc'))return Droplets;
  if(n.includes('tukang')||n.includes('rumah'))return Hammer;if(n.includes('service')||n.includes('perbaikan'))return Wrench;return Ellipsis;
};
const safeJson=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');

export default async function Home(){
  const now=new Date();
  const [cats,services,banners,faqs,areas,settings,review,reviewAgg,partnerCount,customerCount]=await Promise.all([
    db.category.findMany({where:{active:true,archivedAt:null},orderBy:[{sortOrder:'asc'},{name:'asc'}],take:12}),
    db.service.findMany({where:{active:true,archivedAt:null,category:{active:true,archivedAt:null},OR:[{featured:true},{popular:true}]},include:{category:true},orderBy:[{featured:'desc'},{popular:'desc'},{sortOrder:'asc'}],take:6}),
    db.banner.findMany({where:{status:'PUBLISHED',OR:[{startsAt:null},{startsAt:{lte:now}}],AND:[{OR:[{endsAt:null},{endsAt:{gte:now}}]}]},orderBy:{sortOrder:'asc'},take:3}),
    db.fAQ.findMany({where:{status:'PUBLISHED'},orderBy:{sortOrder:'asc'},take:8}),
    db.area.findMany({where:{active:true},orderBy:{name:'asc'},take:30}),
    db.setting.findUnique({where:{key:'business'}}),
    db.review.findFirst({where:{published:true,flagged:false,comment:{not:null}},include:{customer:true},orderBy:[{rating:'desc'},{createdAt:'desc'}]}),
    db.review.aggregate({where:{published:true,flagged:false},_avg:{rating:true},_count:{_all:true}}),
    db.partner.count({where:{status:'APPROVED',user:{active:true}}}),
    db.customerProfile.count()
  ]);
  const business=(settings?.value&&typeof settings.value==='object'&&!Array.isArray(settings.value))?settings.value as Record<string,unknown>:{};
  const siteName=String(business.businessName||'JasaBatam');
  const website=process.env.NEXT_PUBLIC_APP_URL||'https://jasabatam.com';
  const structured={
    '@context':'https://schema.org','@graph':[
      {'@type':'Organization','@id':`${website}/#organization`,name:siteName,url:website,areaServed:{'@type':'City',name:'Batam'}},
      {'@type':'WebSite','@id':`${website}/#website`,url:website,name:siteName,publisher:{'@id':`${website}/#organization`},potentialAction:{'@type':'SearchAction',target:`${website}/jasa?q={search_term_string}`,'query-input':'required name=search_term_string'}},
      {'@type':'ItemList',name:'Jasa populer di Batam',itemListElement:services.map((s,i)=>({'@type':'ListItem',position:i+1,url:`${website}/jasa/${s.category.slug}/${s.slug}`,name:s.name}))}
    ]
  };
  return <><Header/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(structured)}}/><main className="home-v6">
    <section className="home-v6-hero">
      <div className="home-v6-hero-media"><Image src="/images/batam/hero-batam.webp" alt="Pemandangan Batam dan landmark Welcome to Batam" fill priority sizes="100vw"/><div className="home-v6-hero-overlay"/></div>
      <div className="home-v6-container home-v6-hero-content">
        <h1>Semua Jasa<br/>di Batam, Lebih Mudah.</h1>
        <p>Cuci AC, Laundry, Cleaning, Tukang, Service Elektronik dan banyak lagi. Pesan online, teknisi datang.</p>
        <form action="/jasa" className="home-v6-search" role="search">
          <label><MapPin size={20}/><span className="sr-only">Lokasi</span><select name="area" aria-label="Pilih lokasi kecamatan atau area"><option value="">Pilih lokasi (kecamatan/area)</option>{areas.map(a=><option key={a.id} value={a.slug}>{a.name}</option>)}</select></label>
          <label><Search size={20}/><span className="sr-only">Jasa</span><input name="q" aria-label="Cari jasa" placeholder="Cari jasa yang kamu butuhkan..."/></label>
          <button type="submit">Cari Sekarang</button>
        </form>
        <div className="home-v6-trust"><span><ShieldCheck/>Mitra Terpercaya</span><span><BadgeDollarSign/>Harga Transparan</span><span><Zap/>Mudah & Cepat</span><span><MapPinned/>Area Seluruh Batam</span></div>
      </div>
    </section>

    <section className="home-v6-section home-v6-categories"><div className="home-v6-container">
      <div className="home-v6-heading"><h2>Pilih Kategori Jasa</h2><Link href="/jasa">Lihat Semua Kategori <ArrowRight size={17}/></Link></div>
      <div className="home-v6-category-grid">{cats.map(c=>{const Icon=categoryIcon(c.name);return <Link key={c.id} href={`/jasa/${c.slug}`} className="home-v6-category-card"><span>{c.imageUrl?<img src={c.imageUrl} alt="" loading="lazy"/>:<Icon/>}</span><b>{c.name}</b></Link>})}</div>
    </div></section>

    {banners.length>0&&<section id="promo" className="home-v6-section home-v6-promos"><div className="home-v6-container"><div className="home-v6-promo-grid">{banners.map(b=><Link href={b.href||'/jasa'} className="home-v6-promo" key={b.id}>{b.imageUrl&&<img src={b.imageUrl} alt="" loading="lazy"/>}<div><h3>{b.title}</h3>{b.subtitle&&<p>{b.subtitle}</p>}<span>Lihat Promo <ArrowRight size={15}/></span></div></Link>)}</div></div></section>}

    <section className="home-v6-section"><div className="home-v6-container">
      <div className="home-v6-heading"><h2>Jasa Populer di Batam</h2><Link href="/jasa">Lihat Semua <ArrowRight size={17}/></Link></div>
      {services.length?<div className="home-v6-services">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div>:<div className="empty-state">Belum ada layanan populer yang aktif. Aktifkan layanan dari dashboard admin.</div>}
    </div></section>

    <section id="cara-kerja" className="home-v6-section home-v6-how"><div className="home-v6-container">
      <h2>Cara Kerja JasaBatam</h2><div className="home-v6-how-grid">
        <div><span>1</span><Search/><b>Pilih Jasa</b><p>Cari dan pilih layanan yang kamu butuhkan.</p></div>
        <div><span>2</span><CalendarDays/><b>Isi Lokasi & Jadwal</b><p>Tentukan lokasi dan waktu yang diinginkan.</p></div>
        <div><span>3</span><MessageCircle/><b>Mitra Dikonfirmasi</b><p>JasaBatam mencarikan mitra yang sesuai dengan layanan dan area Anda.</p></div>
        <div><span>4</span><CheckCircle2/><b>Jasa Dikerjakan</b><p>Mitra mengerjakan layanan dan kamu dapat memberi ulasan setelah selesai.</p></div>
      </div>
      {review&&<aside className="home-v6-testimonial"><h3>Apa Kata Mereka?</h3><blockquote>“{review.comment}”</blockquote><div><b>{review.customer.name}</b><span>{'★'.repeat(Math.max(1,Math.min(5,review.rating)))}</span></div></aside>}
    </div></section>

    <section className="home-v6-section home-v6-areas"><div className="home-v6-container"><div className="home-v6-heading"><div><h2>Area Layanan Batam</h2><p>Pilih area aktif untuk melihat jasa yang tersedia di lokasi tersebut.</p></div></div><div className="home-v6-area-list">{areas.map(a=><Link href={`/jasa?area=${encodeURIComponent(a.slug)}`} key={a.id}><MapPin size={15}/>{a.name}</Link>)}</div></div></section>

    <section id="tentang" className="home-v6-partner"><div className="home-v6-container home-v6-partner-inner"><div><h2>Punya Bisnis Jasa di Batam?</h2><p>Gabung jadi mitra JasaBatam dan dapatkan order sesuai layanan dan area Anda.</p></div><Link href="/mitra/daftar">Daftar Jadi Mitra <ArrowRight size={17}/></Link><div className="home-v6-live-stats"><span><Building2/><b>{partnerCount.toLocaleString('id-ID')}</b><small>Mitra Approved</small></span><span><Users/><b>{customerCount.toLocaleString('id-ID')}</b><small>Customer Terdaftar</small></span>{reviewAgg._count._all>0&&<span><Star/><b>{Number(reviewAgg._avg.rating||0).toFixed(1)}/5</b><small>{reviewAgg._count._all.toLocaleString('id-ID')} Review</small></span>}</div></div></section>

    {faqs.length>0&&<section className="home-v6-section home-v6-faq"><div className="home-v6-container"><div className="home-v6-heading"><h2>Pertanyaan Umum</h2></div>{faqs.map(f=><details key={f.id}><summary>{f.question}</summary><p>{f.answer}</p></details>)}</div></section>}
  </main>
  <footer className="home-v6-footer"><div className="home-v6-container home-v6-footer-grid"><div><h3>JasaBatam</h3><p>{String(business.siteDescription||'Marketplace jasa lokal Batam untuk kebutuhan rumah dan bisnis.')}</p></div><div><b>Layanan</b><Link href="/jasa">Cari Jasa</Link><Link href="/mitra/daftar">Jadi Mitra</Link></div><div><b>Dukungan</b><span>{String(business.supportEmail||'Email support dapat diatur dari Admin Settings')}</span><span>{String(business.whatsapp||'WhatsApp dapat diatur dari Admin Settings')}</span></div></div></footer></>;
}
