import {db} from './db';
import {canTransition,State} from './order-state';

export async function transitionOrder(orderId:string,next:State,actor:{userId?:string;role:string},reason?:string){
  return db.$transaction(async tx=>{
    const o=await tx.order.findUniqueOrThrow({where:{id:orderId}});
    if(!canTransition(o.status as State,next))throw new Error(`INVALID_TRANSITION:${o.status}->${next}`);
    const updated=await tx.order.update({where:{id:orderId,status:o.status},data:{status:next}});
    await tx.orderStatusHistory.create({data:{orderId,actorUserId:actor.userId,actorRole:actor.role,previousStatus:o.status,newStatus:next,reason}});
    return updated;
  });
}

export async function acceptOffer(orderId:string,partnerId:string){
  return db.$transaction(async tx=>{
    const updated=await tx.order.updateMany({where:{id:orderId,status:'OFFERED',partnerId:null},data:{status:'ACCEPTED',partnerId}});
    if(updated.count!==1)throw new Error('ORDER_ALREADY_TAKEN');
    await tx.dispatchAttempt.updateMany({where:{orderId,partnerId,status:'OFFERED'},data:{status:'ACCEPTED',respondedAt:new Date()}});
    await tx.dispatchAttempt.updateMany({where:{orderId,partnerId:{not:partnerId},status:'OFFERED'},data:{status:'CANCELLED'}});
    await tx.orderStatusHistory.create({data:{orderId,actorRole:'PARTNER',previousStatus:'OFFERED',newStatus:'ACCEPTED'}});
    return tx.order.findUniqueOrThrow({where:{id:orderId}});
  });
}

export async function completeOrder(orderId:string,actor:{userId?:string;role:string},reason?:string){
  return db.$transaction(async tx=>{
    const o=await tx.order.findUniqueOrThrow({where:{id:orderId}});
    if(o.status!=='IN_PROGRESS'||!o.partnerId)throw new Error('INVALID_COMPLETION');
    const earning=Math.max(0,o.partnerEarning||o.total-o.commission);
    const updated=await tx.order.updateMany({where:{id:orderId,status:'IN_PROGRESS'},data:{status:'COMPLETED'}});
    if(updated.count!==1)throw new Error('ORDER_COMPLETION_RACE');
    await tx.partnerWallet.upsert({where:{partnerId:o.partnerId},create:{partnerId:o.partnerId,available:earning},update:{available:{increment:earning}}});
    await tx.orderStatusHistory.create({data:{orderId,actorUserId:actor.userId,actorRole:actor.role,previousStatus:'IN_PROGRESS',newStatus:'COMPLETED',reason}});
    return {commission:o.commission,earning};
  });
}
