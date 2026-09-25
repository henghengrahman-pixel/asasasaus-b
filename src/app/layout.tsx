import './globals.css';
import type {Metadata,Viewport} from 'next';

const base=process.env.NEXT_PUBLIC_APP_URL||'https://jasabatam.com';
export const metadata:Metadata={
  metadataBase:new URL(base),
  title:{default:'JasaBatam — Semua Jasa di Batam, Lebih Mudah',template:'%s | JasaBatam'},
  description:'Cari dan pesan jasa terpercaya di Batam: service AC, laundry, cleaning, tukang, elektronik, pindahan, dan layanan rumah lainnya sesuai area dan jadwal Anda.',
  keywords:['jasa Batam','service AC Batam','laundry Batam','cleaning service Batam','tukang Batam','jasa rumah Batam','marketplace jasa Batam'],
  alternates:{canonical:'/'},
  manifest:'/manifest.webmanifest',
  applicationName:'JasaBatam',
  category:'marketplace jasa lokal',
  openGraph:{type:'website',locale:'id_ID',url:'/',siteName:'JasaBatam',title:'JasaBatam — Semua Jasa di Batam, Lebih Mudah',description:'Cari dan pesan jasa lokal terpercaya di seluruh area Batam.'},
  twitter:{card:'summary_large_image',title:'JasaBatam — Semua Jasa di Batam, Lebih Mudah',description:'Cari dan pesan jasa lokal terpercaya di seluruh area Batam.'},
  robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}}
};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#0878f5',colorScheme:'light'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}
