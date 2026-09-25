'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Home,Grid3X3,ClipboardList,MessageCircle,UserRound} from 'lucide-react';

const isActive=(pathname:string,href:string)=>href==='/'?pathname==='/':pathname===href||pathname.startsWith(`${href}/`);
export function PublicTopNav(){const pathname=usePathname();const links=[['Beranda','/'],['Kategori','/jasa'],['Cara Kerja','/#cara-kerja'],['Promo','/#promo'],['Jadi Mitra','/mitra/daftar'],['Tentang Kami','/#tentang']];return <nav className="site-v6-nav" aria-label="Navigasi utama">{links.map(([label,href])=>{const active=href.includes('#')?false:isActive(pathname,href);return <Link key={href} className={active?'active':''} href={href}>{label}</Link>})}</nav>}
export function PublicBottomNav(){const pathname=usePathname();const items=[[Home,'Beranda','/'],[Grid3X3,'Kategori','/jasa'],[ClipboardList,'Pesanan','/pesanan'],[MessageCircle,'Chat','/chat'],[UserRound,'Akun','/akun']] as const;return <nav className="site-v6-bottom-nav" aria-label="Navigasi mobile">{items.map(([Icon,label,href])=><Link key={href} className={isActive(pathname,href)?'active':''} href={href}><Icon size={21}/><span>{label}</span></Link>)}</nav>}
