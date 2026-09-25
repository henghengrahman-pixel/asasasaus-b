import Link from 'next/link';
import {MapPin,Star,Wifi,ArrowRight,ShieldCheck} from 'lucide-react';
import {rupiah} from '@/lib/money';

type PartnerCardData={
  id:string;slug:string|null;businessName:string;status:string;online:boolean;
  rating:number;ratingCount:number;completedOrders:number;areaName:string;
  banner:string;logo:string|null;rankLabel:string|null;
  services:{id:string;name:string;price:number;unit:string|null;pricingType:string}[];
};

export function MarketplacePartnerCard({partner,areaSlug}:{partner:PartnerCardData;areaSlug?:string}){
  const first=partner.services[0];
  return <article className="market-partner-card">
    <div className="market-partner-banner">
      <img src={partner.banner} alt={`Banner ${partner.businessName}`} loading="lazy"/>
      <div className="market-card-status"><Wifi size={12}/> Online</div>
    </div>
    <div className="market-partner-body">
      <div className="market-partner-heading">
        <div className="market-partner-logo">{partner.logo?<img src={partner.logo} alt={`Logo ${partner.businessName}`} loading="lazy"/>:<span aria-label="JasaBatam Partner">JB</span>}</div>
        <div><h3>{partner.businessName}</h3>{partner.status==='APPROVED'&&<span className="market-verified"><ShieldCheck size={13}/> Terverifikasi</span>}</div>
      </div>
      <div className="market-partner-meta">
        {partner.ratingCount>0?<span><Star size={14}/> <b>{partner.rating.toFixed(1)}</b> ({partner.ratingCount} ulasan)</span>:<span>Belum ada ulasan</span>}
        {partner.completedOrders>0&&<span>{partner.completedOrders} order selesai</span>}
      </div>
      <p className="market-area"><MapPin size={14}/> {partner.areaName}</p>
      <div className="market-service-tags">{partner.services.slice(0,3).map(x=><span key={x.id}>{x.name}</span>)}</div>
      {partner.rankLabel&&<p className="market-rank">{partner.rankLabel}</p>}
      {first&&<p className="market-start-price">Mulai <b>{rupiah(first.price)}</b>{first.unit?`/${first.unit}`:''}</p>}
      <div className="market-card-actions">
        {partner.slug?<Link className="btn outline" href={`/mitra/${partner.slug}`}>Lihat Toko</Link>:<span className="btn outline disabled" aria-disabled="true">Toko belum tersedia</span>}
        {partner.slug&&first?<Link className="btn primary" href={`/mitra/${partner.slug}#layanan`}>Pesan Sekarang <ArrowRight size={14}/></Link>:<span className="btn primary disabled" aria-disabled="true">Pilih toko dahulu</span>}
      </div>
    </div>
  </article>
}
