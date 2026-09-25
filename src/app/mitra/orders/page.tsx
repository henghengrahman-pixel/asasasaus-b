import Link from 'next/link';
import {PanelShell} from '@/components/PanelShell';
import {requirePartner} from '@/lib/partner-auth';
import {db} from '@/lib/db';
import {rupiah} from '@/lib/money';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
  const auth=await requirePartner();const sp=await searchParams;const page=Math.max(1,Number.parseInt(sp.page||'1',10)||1),pageSize=20;
  const allowed=['NEW','OFFERED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED'];const status=allowed.includes(sp.status||'')?sp.status:undefined;
  const where={partnerId:auth.partner.id,...(status?{status:status as never}:{})};
  const [rows,total]=await Promise.all([db.order.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*pageSize,take:pageSize,select:{id:true,publicId:true,status:true,scheduledAt:true,total:true,createdAt:true,customer:{select:{name:true}},items:{take:1,select:{name:true,quantity:true}}}}),db.order.count({where})]);
  return <PanelShell kind="mitra"><div className="order-head"><div><h1>Order</h1><p className="muted">Hanya order milik {auth.partner.businessName} yang ditampilkan.</p></div><form><select name="status" defaultValue={status||''}><option value="">Semua status</option>{allowed.map(x=><option key={x}>{x}</option>)}</select><button className="btn outline small">Filter</button></form></div><div className="admin-card"><table className="table"><thead><tr><th>Order</th><th>Customer</th><th>Layanan</th><th>Jadwal</th><th>Total</th><th>Status</th><th/></tr></thead><tbody>{rows.map(o=><tr key={o.id}><td data-label="Order"><b>{o.publicId}</b><br/><small>{o.createdAt.toLocaleString('id-ID')}</small></td><td data-label="Customer">{o.customer.name}</td><td data-label="Layanan">{o.items[0]?.name||'—'}{o.items[0]&&<small> × {o.items[0].quantity}</small>}</td><td data-label="Jadwal">{o.scheduledAt.toLocaleString('id-ID')}</td><td data-label="Total">{rupiah(o.total)}</td><td data-label="Status"><span className="badge">{o.status}</span></td><td><Link className="btn outline small" href={`/mitra/orders/${o.id}`}>Detail</Link></td></tr>)}</tbody></table>{!rows.length&&<div className="empty">Belum ada order pada filter ini.</div>}</div>{total>pageSize&&<div className="market-pagination"><span>{total} order</span><div>{page>1&&<Link href={`?${status?`status=${status}&`:''}page=${page-1}`}>Sebelumnya</Link>}{page*pageSize<total&&<Link href={`?${status?`status=${status}&`:''}page=${page+1}`}>Berikutnya</Link>}</div></div>}</PanelShell>
}
