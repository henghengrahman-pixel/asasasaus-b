import Link from 'next/link';
import {Search,Bell,Menu,House,Leaf,MessageCircleMore} from 'lucide-react';
import {db} from '@/lib/db';
import {PublicTopNav,PublicBottomNav} from './PublicNavClient';

function normalizeWhatsApp(value:string){const digits=value.replace(/\D/g,'');if(!digits)return '';if(digits.startsWith('0'))return `62${digits.slice(1)}`;return digits}

export async function Header(){
  const setting=await db.setting.findUnique({where:{key:'business'}}).catch(()=>null);
  const business=setting?.value&&typeof setting.value==='object'&&!Array.isArray(setting.value)?setting.value as Record<string,unknown>:{};
  const whatsapp=normalizeWhatsApp(String(business.whatsapp||''));
  return <>
    <header className="site-v6-header">
      <div className="site-v6-header-inner">
        <Link href="/" className="site-v6-brand" aria-label="JasaBatam beranda">
          <span className="site-v6-logo"><House size={25}/><Leaf className="site-v6-leaf" size={13}/></span>
          <span className="site-v6-brand-copy"><b><span>Jasa</span><em>Batam</em></b><small>Semua Jasa Rumah dalam Satu Tempat</small></span>
        </Link>
        <PublicTopNav/>
        <div className="site-v6-actions">
          <Link className="site-v6-icon-button" href="/jasa" aria-label="Cari jasa"><Search size={20}/></Link>
          {whatsapp?<a className="site-v6-whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircleMore size={18}/> Pesan via WhatsApp</a>:<Link className="site-v6-whatsapp" href="/jasa"><Search size={18}/> Cari Jasa</Link>}
          <Link className="site-v6-mobile-icon" href="/chat" aria-label="Notifikasi"><Bell size={21}/></Link>
          <Link className="site-v6-mobile-icon" href="/jasa" aria-label="Menu"><Menu size={23}/></Link>
        </div>
      </div>
    </header>
    <PublicBottomNav/>
  </>
}
