import {PanelShell} from '@/components/PanelShell';
import {requirePartner} from '@/lib/partner-auth';
import {db} from '@/lib/db';
import {rupiah} from '@/lib/money';
import {partnerAnalytics} from '@/lib/partner-operations';
export const dynamic='force-dynamic';
export default async function Page(){
  const auth=await requirePartner();
  const start30=new Date(Date.now()-30*86400000);
  const [analytics,newOrders,running,completedAll,wallet]=await Promise.all([
    partnerAnalytics(auth.partner.id,start30),
    db.order.count({where:{partnerId:auth.partner.id,status:{in:['NEW','OFFERED']}}}),
    db.order.count({where:{partnerId:auth.partner.id,status:{in:['ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS']}}}),
    db.order.count({where:{partnerId:auth.partner.id,status:'COMPLETED'}}),
    db.partnerWallet.findUnique({where:{partnerId:auth.partner.id},select:{available:true}})
  ]);
  const metrics:[string,string|number][]=[
    ['Order Baru',newOrders],['Order Berjalan',running],['Order Selesai',completedAll],['Pendapatan 30 Hari',rupiah(analytics.revenue)],['Rating',analytics.rating==null?'Belum ada data':analytics.rating.toFixed(2)],['Response Time',analytics.averageResponseMinutes==null?'Belum ada data':`${analytics.averageResponseMinutes} menit`],['Conversion',analytics.conversionRate==null?'Belum ada data':`${Math.round(analytics.conversionRate*100)}%`],['Saldo Tersedia',rupiah(wallet?.available||0)]
  ];
  return <PanelShell kind="mitra"><div className="order-head"><div><h1>Dashboard Mitra</h1><p className="muted">Data operasional berasal dari toko {auth.partner.businessName}.</p></div><form method="post" action="/api/mitra/operational"><button className={auth.partner.online?'btn green':'btn outline'}>{auth.partner.online?'● ONLINE':'○ OFFLINE'}</button></form></div><div className="grid metric-grid">{metrics.map(([k,v])=><div className="card metric" key={k}><small className="muted">{k}</small><b>{String(v)}</b></div>)}</div><div className="admin-card" style={{marginTop:16}}><h2>Status Toko</h2><p><b>Verifikasi:</b> {auth.partner.status}</p><p><b>Claim:</b> {auth.partner.claimStatus}</p><p><b>Dispatch:</b> {auth.partner.dispatchEnabled?'Aktif':'Nonaktif'}</p><p><b>Storefront:</b> {auth.partner.storefrontStatus}</p></div></PanelShell>
}
