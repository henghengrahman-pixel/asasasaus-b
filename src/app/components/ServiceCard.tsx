import Link from 'next/link';
import {Wrench,ArrowRight} from 'lucide-react';
import {rupiah} from '@/lib/money';

type ServiceCardService={id:string;name:string;basePrice:number;slug:string;imageUrl?:string|null;pricingType?:string;unit?:string|null;category:{slug:string}};
export function ServiceCard({s,areaSlug}:{s:ServiceCardService;areaSlug?:string}){
  const price=s.pricingType==='CUSTOM_QUOTE'?'Minta penawaran':`${s.pricingType==='STARTING_FROM'?'Mulai ':''}${rupiah(s.basePrice)}${s.unit?`/${s.unit}`:''}`;
  const href=`/jasa/${s.category.slug}${areaSlug?`?area=${encodeURIComponent(areaSlug)}`:''}`;
  return <article className="service-v6-card"><Link href={href} className="service-v6-photo" aria-label={`Lihat mitra kategori ${s.category.slug}`}>{s.imageUrl?<img src={s.imageUrl} alt={s.name} loading="lazy"/>:<span><Wrench size={38}/></span>}</Link><div className="service-v6-body"><h3>{s.name}</h3><strong>{price}</strong><Link className="service-v6-order" href={href}>Lihat Mitra <ArrowRight size={15}/></Link></div></article>;
}
