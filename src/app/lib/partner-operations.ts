import {db} from './db';
import {canTransition,type State} from './order-state';

export type PartnerOrderAction='ACCEPT'|'REJECT'|'DEPART'|'ARRIVE'|'START'|'COMPLETE';

export function assertPartnerOwns<T extends {partnerId:string|null}>(row:T|null,partnerId:string):asserts row is T{
  if(!row||row.partnerId!==partnerId)throw new Error('NOT_FOUND');
}

export function nextStatusForPartnerAction(current:State,action:PartnerOrderAction):State{
  const target:State=action==='ACCEPT'?'ACCEPTED':action==='REJECT'?'CANCELLED':action==='DEPART'?'ON_THE_WAY':action==='ARRIVE'?'ARRIVED':action==='START'?'IN_PROGRESS':'COMPLETED';
  if(!canTransition(current,target))throw new Error(`INVALID_TRANSITION:${current}->${target}`);
  return target;
}

export async function partnerOrderDetail(partnerId:string,orderId:string){
  const order=await db.order.findFirst({where:{id:orderId,partnerId},select:{
    id:true,publicId:true,status:true,scheduledAt:true,addressSnapshot:true,customerNote:true,locationNote:true,paymentMethod:true,total:true,subtotal:true,areaSurcharge:true,partnerEarning:true,createdAt:true,area:{select:{name:true}},customer:{select:{name:true,user:{select:{phone:true}}}},items:{select:{id:true,name:true,quantity:true,unitPrice:true,lineTotal:true,serviceId:true}},history:{orderBy:{createdAt:'asc'},select:{previousStatus:true,newStatus:true,createdAt:true,reason:true}}
  }});
  if(!order)throw new Error('NOT_FOUND');
  return order;
}

export async function partnerAnalytics(partnerId:string,since:Date){
  const [events,orders,dispatches,reviews]=await Promise.all([
    db.partnerAnalyticsEvent.groupBy({by:['type'],where:{partnerId,createdAt:{gte:since}},_count:{_all:true}}),
    db.order.findMany({where:{partnerId,createdAt:{gte:since}},select:{id:true,status:true,partnerEarning:true,createdAt:true,items:{select:{serviceId:true,name:true,quantity:true}},history:{where:{actorRole:'PARTNER',newStatus:{in:['ACCEPTED','CANCELLED']}},select:{newStatus:true,createdAt:true}}}}),
    db.dispatchAttempt.findMany({where:{partnerId,offeredAt:{gte:since}},select:{orderId:true,status:true,offeredAt:true,respondedAt:true}}),
    db.review.findMany({where:{order:{partnerId},createdAt:{gte:since},published:true,flagged:false},select:{rating:true}})
  ]);
  const eventMap=new Map(events.map(x=>[x.type,x._count._all]));
  const completed=orders.filter(x=>x.status==='COMPLETED');
  const cancelled=orders.filter(x=>x.status==='CANCELLED');
  const acceptedOrderIds=new Set(dispatches.filter(x=>x.status==='ACCEPTED').map(x=>x.orderId));
  const rejectedOrderIds=new Set(dispatches.filter(x=>x.status==='DECLINED').map(x=>x.orderId));
  const directResponseMinutes:number[]=[];
  for(const order of orders)for(const h of order.history){if(h.newStatus==='ACCEPTED'){acceptedOrderIds.add(order.id);directResponseMinutes.push((h.createdAt.getTime()-order.createdAt.getTime())/60000)}else if(h.newStatus==='CANCELLED')rejectedOrderIds.add(order.id)}
  const dispatchResponseMinutes=dispatches.filter(x=>x.respondedAt).map(x=>(x.respondedAt!.getTime()-x.offeredAt.getTime())/60000);
  const responseMinutes=[...dispatchResponseMinutes,...directResponseMinutes];
  const accepted=acceptedOrderIds.size,rejected=rejectedOrderIds.size;
  const averageResponseMinutes=responseMinutes.length?Math.round(responseMinutes.reduce((a,b)=>a+b,0)/responseMinutes.length):null;
  const revenue=completed.reduce((n,x)=>n+x.partnerEarning,0);
  const rating=reviews.length?reviews.reduce((n,x)=>n+x.rating,0)/reviews.length:null;
  const serviceCounts=new Map<string,{name:string;quantity:number}>();
  for(const order of completed)for(const item of order.items){const old=serviceCounts.get(item.serviceId)??{name:item.name,quantity:0};old.quantity+=item.quantity;serviceCounts.set(item.serviceId,old)}
  const topService=[...serviceCounts.values()].sort((a,b)=>b.quantity-a.quantity)[0]??null;
  return {
    profileViews:eventMap.get('PROFILE_VIEW')??0,serviceViews:eventMap.get('SERVICE_VIEW')??0,
    offersReceived:dispatches.length,offersOpened:eventMap.get('OFFER_OPENED')??0,ordersReceived:orders.length,
    ordersAccepted:accepted,ordersRejected:rejected,completedOrders:completed.length,cancelledOrders:cancelled.length,
    conversionRate:orders.length?completed.length/orders.length:null,
    acceptanceRate:(accepted+rejected)?accepted/(accepted+rejected):null,
    averageResponseMinutes,revenue,rating,topService
  };
}

export async function executePartnerOrderAction(input:{partnerId:string;userId:string;orderId:string;action:PartnerOrderAction;reason?:string;source:'DASHBOARD'|'AGENT'}){
  return db.$transaction(async tx=>{
    const order=await tx.order.findFirst({where:{id:input.orderId,partnerId:input.partnerId},select:{id:true,status:true,partnerId:true}});
    assertPartnerOwns(order,input.partnerId);
    const current=order.status as State;
    const next=nextStatusForPartnerAction(current,input.action);
    const updated=await tx.order.updateMany({where:{id:order.id,partnerId:input.partnerId,status:current},data:{status:next}});
    if(updated.count!==1)throw new Error('ORDER_CHANGED');
    await tx.orderStatusHistory.create({data:{orderId:order.id,actorUserId:input.userId,actorRole:'PARTNER',previousStatus:current,newStatus:next,reason:input.reason}});
    await tx.auditLog.create({data:{actorUserId:input.userId,action:`PARTNER_ORDER_${input.action}`,entityType:'Order',entityId:order.id,metadata:{partnerId:input.partnerId,source:input.source,from:current,to:next}}});
    return {orderId:order.id,previousStatus:current,status:next};
  });
}

export async function updateOwnedServicePrice(input:{partnerId:string;userId:string;serviceId:string;price:number;source:'DASHBOARD'|'AGENT'}){
  if(!Number.isSafeInteger(input.price)||input.price<0||input.price>1_000_000_000)throw new Error('INVALID_PRICE');
  return db.$transaction(async tx=>{
    const current=await tx.partnerService.findUnique({where:{partnerId_serviceId:{partnerId:input.partnerId,serviceId:input.serviceId}},select:{customPrice:true,service:{select:{basePrice:true,name:true}}}});
    if(!current)throw new Error('NOT_FOUND');
    const before=current.customPrice??current.service.basePrice;
    await tx.partnerService.update({where:{partnerId_serviceId:{partnerId:input.partnerId,serviceId:input.serviceId}},data:{customPrice:input.price}});
    await tx.auditLog.create({data:{actorUserId:input.userId,action:'PARTNER_SERVICE_PRICE_UPDATE',entityType:'PartnerService',entityId:`${input.partnerId}:${input.serviceId}`,metadata:{partnerId:input.partnerId,serviceId:input.serviceId,serviceName:current.service.name,before,after:input.price,source:input.source}}});
    return {serviceId:input.serviceId,serviceName:current.service.name,before,after:input.price};
  });
}
