import Link from 'next/link';
import {ShoppingCart,CheckCircle2,Clock3,Users,Handshake,CircleDollarSign,AlertTriangle,UserCheck,ArrowRight} from 'lucide-react';
import {PanelShell} from '@/components/PanelShell';
import {StatusBadge,EmptyState} from '@/components/AdminBits';
import {db} from '@/lib/db';
import {rupiah} from '@/lib/money';
import {requireAdmin,recoveryDisplay} from '@/lib/auth';
import {percentChange} from '@/lib/admin-ui';
export const dynamic='force-dynamic';
const startOfDay=(d:Date)=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
export default async function Page(){
  const admin=await requireAdmin();const recovery=await recoveryDisplay();const now=new Date(),today=startOfDay(now),yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);const seven=new Date(today);seven.setDate(seven.getDate()-6);
  const [todayOrders,yesterdayOrders,completedToday,active,searching,customers,partners,todayAgg,yesterdayAgg,latest,disputes,online,waiting,payoutPending,chartOrders,statusGroups,topItems]=await Promise.all([
    db.order.count({where:{createdAt:{gte:today}}}),db.order.count({where:{createdAt:{gte:yesterday,lt:today}}}),db.order.count({where:{status:'COMPLETED',updatedAt:{gte:today}}}),db.order.count({where:{status:{in:['ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS']}}}),db.order.count({where:{status:'SEARCHING_PARTNER'}}),db.customerProfile.count(),db.partner.count({where:{status:'APPROVED',user:{active:true}}}),db.order.aggregate({where:{status:'COMPLETED',updatedAt:{gte:today}},_sum:{total:true,commission:true}}),db.order.aggregate({where:{status:'COMPLETED',updatedAt:{gte:yesterday,lt:today}},_sum:{total:true,commission:true}}),db.order.findMany({take:8,orderBy:{createdAt:'desc'},include:{customer:true,partner:true,items:true,payment:true,area:true}}),db.dispute.count({where:{status:{notIn:['RESOLVED','CLOSED']}}}),db.partner.count({where:{status:'APPROVED',user:{active:true},online:true}}),db.partner.count({where:{status:{in:['SUBMITTED','UNDER_REVIEW']}}}),db.payout.aggregate({where:{status:{in:['REQUESTED','UNDER_REVIEW','PROCESSING']}},_sum:{amount:true}}),db.order.findMany({where:{createdAt:{gte:seven}},select:{createdAt:true,total:true,status:true}}),db.order.groupBy({by:['status'],_count:{_all:true}}),db.orderItem.groupBy({by:['serviceId'],_sum:{quantity:true},orderBy:{_sum:{quantity:'desc'}},take:5})
  ]);
  const serviceNames=topItems.length?await db.service.findMany({where:{id:{in:topItems.map(x=>x.serviceId)}},select:{id:true,name:true}}):[];const names=new Map(serviceNames.map(x=>[x.id,x.name]));
  const days=Array.from({length:7},(_,i)=>{const d=new Date(seven);d.setDate(seven.getDate()+i);const key=d.toISOString().slice(0,10);const rows=chartOrders.filter(o=>o.createdAt.toISOString().slice(0,10)===key);return {label:d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}),count:rows.length,completed:rows.filter(x=>x.status==='COMPLETED').length,revenue:rows.filter(x=>x.status==='COMPLETED').reduce((n,x)=>n+x.total,0)}});const maxOrders=Math.max(1,...days.map(x=>x.count));const maxStatus=Math.max(1,...statusGroups.map(x=>x._count._all));
  const deltaOrders=percentChange(todayOrders,yesterdayOrders),deltaCommission=percentChange(todayAgg._sum.commission||0,yesterdayAgg._sum.commission||0);
  const cards=[
    {label:'Total Order Hari Ini',value:String(todayOrders),delta:deltaOrders,Icon:ShoppingCart,tone:'blue'},
    {label:'Order Selesai',value:String(completedToday),delta:null,Icon:CheckCircle2,tone:'green'},
    {label:'Order Aktif',value:String(active),delta:null,Icon:Clock3,tone:'amber'},
    {label:'Total Customer',value:customers.toLocaleString('id-ID'),delta:null,Icon:Users,tone:'purple'},
    {label:'Total Mitra',value:partners.toLocaleString('id-ID'),delta:null,Icon:Handshake,tone:'red'},
    {label:'Pendapatan Komisi',value:rupiah(todayAgg._sum.commission||0),delta:deltaCommission,Icon:CircleDollarSign,tone:'teal'}
  ];
  return <PanelShell kind="admin">
    {recovery&&<div className="notice warning"><b>Simpan Recovery Codes Sekarang</b><pre>{recovery.join('\n')}</pre></div>}
    <header className="admin-v6-dashboard-head"><div><h1>Selamat datang, {admin.user.displayName||admin.user.username||'Admin'}!</h1><p>Berikut ringkasan aktivitas JasaBatam hari ini.</p></div><div className="admin-v6-today">Hari Ini <b>{today.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</b></div></header>
    <section className="admin-v6-metrics">{cards.map(({label,value,delta,Icon,tone})=><article className="admin-v6-metric" key={label}><span className={`admin-v6-metric-icon ${tone}`}><Icon size={24}/></span><div><small>{label}</small><strong>{value}</strong>{typeof delta==='number'?<em className={delta>=0?'up':'down'}>{delta>=0?'↑':'↓'} {Math.abs(delta).toFixed(1)}% <span>vs kemarin</span></em>:<em>Data aktual</em>}</div></article>)}</section>

    <section className="admin-v6-dashboard-grid">
      <article className="admin-v6-panel admin-v6-chart-panel"><div className="admin-v6-panel-head"><h2>Grafik Order (7 Hari Terakhir)</h2><span>Selesai & total order aktual</span></div><div className="admin-v6-bars" aria-label="Grafik order tujuh hari">{days.map(d=><div className="admin-v6-bar-col" key={d.label}><span>{d.count}</span><div className="admin-v6-bar-stack" style={{height:`${Math.max(12,(d.count/maxOrders)*170)}px`}}><i style={{height:`${d.count?Math.max(8,(d.completed/d.count)*100):0}%`}}/></div><small>{d.label}</small></div>)}</div></article>
      <article className="admin-v6-panel"><div className="admin-v6-panel-head"><h2>Order Saat Ini</h2><Link href="/admin/orders">Lihat Semua <ArrowRight size={15}/></Link></div><div className="admin-v6-status-list">{statusGroups.sort((a,b)=>b._count._all-a._count._all).slice(0,8).map(s=><div key={s.status}><span><i/>{s.status.replaceAll('_',' ')}</span><b>{s._count._all}</b><div><i style={{width:`${(s._count._all/maxStatus)*100}%`}}/></div></div>)}</div></article>
      <aside className="admin-v6-side-stack"><div className="admin-v6-panel"><div className="admin-v6-panel-head"><h2>Pendaftaran Mitra</h2><Link href="/admin/partners">Lihat Semua <ArrowRight size={15}/></Link></div><div className="admin-v6-kpis"><div><span><UserCheck/>Menunggu Verifikasi</span><b>{waiting}</b></div><div><span><CheckCircle2/>Disetujui</span><b>{partners}</b></div><div><span><Users/>Online</span><b>{online}</b></div></div></div><div className="admin-v6-panel"><div className="admin-v6-panel-head"><h2>Komplain / Dispute</h2><Link href="/admin/disputes">Lihat Semua <ArrowRight size={15}/></Link></div><div className="admin-v6-kpis"><div><span><AlertTriangle/>Aktif</span><b>{disputes}</b></div><div><span><CircleDollarSign/>Payout Pending</span><b>{rupiah(payoutPending._sum.amount||0)}</b></div></div></div></aside>
    </section>

    <section className="admin-v6-bottom-grid">
      <article className="admin-v6-panel"><div className="admin-v6-panel-head"><h2>Order Terbaru</h2><Link href="/admin/orders">Lihat Semua <ArrowRight size={15}/></Link></div>{latest.length?<div className="data-table-wrap mobile-card-table"><table className="data-table"><thead><tr><th>Order</th><th>Waktu</th><th>Customer</th><th>Layanan</th><th>Lokasi</th><th>Mitra</th><th>Status</th><th>Total</th><th>Aksi</th></tr></thead><tbody>{latest.map(o=><tr key={o.id}><td data-label="Order"><Link className="row-link" href={`/admin/orders/${o.publicId}`}>{o.publicId}</Link></td><td data-label="Waktu">{o.createdAt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</td><td data-label="Customer">{o.customer.name}</td><td data-label="Layanan">{o.items[0]?.name||'-'}</td><td data-label="Lokasi">{o.area.name}</td><td data-label="Mitra">{o.partner?.businessName||'-'}</td><td data-label="Status"><StatusBadge status={o.status}/></td><td data-label="Total">{rupiah(o.total)}</td><td data-label="Aksi"><Link className="btn small outline" href={`/admin/orders/${o.publicId}`}>Detail</Link></td></tr>)}</tbody></table></div>:<EmptyState title="Belum ada order"/>}</article>
      <article className="admin-v6-panel"><div className="admin-v6-panel-head"><h2>Top 5 Layanan</h2><Link href="/admin/reports">Lihat Semua <ArrowRight size={15}/></Link></div><div className="admin-v6-top-services">{topItems.map((x,i)=><div key={x.serviceId}><span>{names.get(x.serviceId)||x.serviceId}</span><div><i style={{width:`${Math.max(8,100-(i*15))}%`}}/></div><b>{x._sum.quantity||0}</b></div>)}{!topItems.length&&<EmptyState title="Belum ada data service"/>}</div></article>
    </section>
  </PanelShell>
}
