'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useId,useState,type ReactNode,type ComponentType} from 'react';
import {
  LayoutDashboard,ClipboardList,RadioTower,Users,Handshake,Wrench,Tags,MapPinned,BadgePercent,
  WalletCards,Landmark,ShieldAlert,Star,BarChart3,Bell,PanelsTopLeft,UserCog,Settings,ScrollText,
  Search,Menu,X,ExternalLink,LogOut,ChevronDown,House,Leaf,LifeBuoy
} from 'lucide-react';

type Role='SUPER_ADMIN'|'OPERATIONS'|'CS'|'FINANCE'|'PARTNER_ADMIN';
type Item={label:string;href:string;key?:string;icon:ComponentType<{size?:number;strokeWidth?:number}>};
type Group={label:string;items:Item[]};
const groups:Group[]=[
  {label:'',items:[{label:'Dashboard',href:'/admin',icon:LayoutDashboard}]},
  {label:'OPERASIONAL',items:[{label:'Orders',href:'/admin/orders',key:'orders',icon:ClipboardList},{label:'Dispatch',href:'/admin/dispatch',key:'dispatch',icon:RadioTower},{label:'Customers',href:'/admin/customers',key:'customers',icon:Users},{label:'Partners / Mitra',href:'/admin/partners',key:'partners',icon:Handshake}]},
  {label:'KATALOG',items:[{label:'Services & Harga',href:'/admin/services',key:'services',icon:Wrench},{label:'Kategori',href:'/admin/categories',key:'categories',icon:Tags},{label:'Area Layanan',href:'/admin/areas',key:'areas',icon:MapPinned},{label:'Promotions',href:'/admin/promotions',key:'promotions',icon:BadgePercent}]},
  {label:'KEUANGAN',items:[{label:'Finance',href:'/admin/finance',key:'finance',icon:WalletCards},{label:'Payouts',href:'/admin/payouts',key:'payouts',icon:Landmark}]},
  {label:'QUALITY',items:[{label:'Komplain / Dispute',href:'/admin/disputes',key:'disputes',icon:ShieldAlert},{label:'Reviews',href:'/admin/reviews',key:'reviews',icon:Star}]},
  {label:'SYSTEM',items:[{label:'Reports',href:'/admin/reports',key:'reports',icon:BarChart3},{label:'Notifications',href:'/admin/notifications',key:'notifications',icon:Bell},{label:'CMS',href:'/admin/cms',key:'cms',icon:PanelsTopLeft},{label:'Users & Roles',href:'/admin/users',key:'users',icon:UserCog},{label:'Settings',href:'/admin/settings',key:'settings',icon:Settings},{label:'Audit Logs',href:'/admin/audit-logs',key:'audit',icon:ScrollText}]},
];
function isActive(pathname:string,href:string){return href==='/admin'?pathname==='/admin':pathname===href||pathname.startsWith(href+'/')}

export function AdminShellClient({children,role,username,displayName,version,allowedKeys,unread,nowLabel}:{children:ReactNode;role:Role;username:string;displayName?:string|null;version:string;allowedKeys:string[];unread:number;nowLabel:string}){
  const pathname=usePathname();const [open,setOpen]=useState(false);const drawerId=useId();
  useEffect(()=>setOpen(false),[pathname]);
  useEffect(()=>{document.body.classList.toggle('admin-drawer-open',open);return()=>document.body.classList.remove('admin-drawer-open')},[open]);
  useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open]);
  const can=(i:Item)=>!i.key||role==='SUPER_ADMIN'||allowedKeys.includes(i.key);
  const initials=(displayName||username||'A').split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase();
  return <div className="admin-v6-shell">
    <aside id={drawerId} className={`admin-v6-sidebar ${open?'open':''}`}>
      <div className="admin-v6-brand"><span className="admin-v6-logo"><House size={24}/><Leaf size={12}/></span><span><b>Jasa<em>Batam</em></b><small>Admin Panel</small></span><button onClick={()=>setOpen(false)} className="admin-v6-close" aria-label="Tutup menu"><X size={20}/></button></div>
      <nav className="admin-v6-nav" aria-label="Navigasi admin">{groups.map((g,idx)=>{const items=g.items.filter(can);if(!items.length)return null;return <div key={`${g.label}-${idx}`} className="admin-v6-group">{items.map(i=>{const Icon=i.icon;const active=isActive(pathname,i.href);return <Link key={i.href} href={i.href} className={active?'active':''} aria-current={active?'page':undefined}><Icon size={18}/><span>{i.label}</span>{i.href==='/admin/notifications'&&unread>0&&<b className="admin-v6-menu-badge">{unread>99?'99+':unread}</b>}</Link>})}</div>})}</nav>
      <div className="admin-v6-support"><LifeBuoy size={20}/><div><b>Butuh Bantuan?</b><small>Cek konfigurasi dan audit log jika ada kendala.</small></div></div>
      <div className="admin-v6-version">JasaBatam • {version}</div>
    </aside>
    {open&&<button className="admin-v6-overlay" aria-label="Tutup menu" onClick={()=>setOpen(false)}/>} 
    <div className="admin-v6-main">
      <header className="admin-v6-topbar">
        <div className="admin-v6-search-wrap"><button className="admin-v6-menu" onClick={()=>setOpen(true)} aria-controls={drawerId} aria-expanded={open} aria-label="Buka menu"><Menu size={21}/></button><form action="/admin/search"><Search size={19}/><input name="q" aria-label="Pencarian global" placeholder="Cari order, customer, mitra, atau layanan..."/></form></div>
        <div className="admin-v6-top-actions"><Link className="admin-v6-bell" href="/admin/notifications" aria-label={`${unread} notifikasi belum dibaca`}><Bell size={20}/>{unread>0&&<span>{unread>99?'99+':unread}</span>}</Link><div className="admin-v6-profile"><span className="admin-v6-avatar">{initials}</span><span><b>{displayName||username}</b><small>{role.replaceAll('_',' ')}</small></span><ChevronDown size={15}/></div><div className="admin-v6-date">{nowLabel}<small>WIB</small></div><Link href="/" target="_blank" className="admin-v6-external" aria-label="Buka website"><ExternalLink size={18}/></Link><form method="post" action="/api/admin/auth/logout"><button className="admin-v6-logout" aria-label="Keluar"><LogOut size={18}/></button></form></div>
      </header>
      <main className="admin-v6-content">{children}</main>
    </div>
  </div>
}
