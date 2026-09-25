import {z} from 'zod';
import {db} from './db';

const planSchema=z.object({
  intent:z.string().min(1).max(80),
  tool:z.enum(['getPartnerOrders','getPartnerOrderDetail','getPartnerAnalytics','getPartnerProfile','getPartnerServices','getPartnerReviews','getAlerts','updateServicePrice','orderAction']).nullable(),
  arguments:z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()])).default({})
});
export type PartnerAgentPlan=z.infer<typeof planSchema>;

export async function planWithConfiguredLLM(partnerId:string,message:string):Promise<PartnerAgentPlan|null>{
  const apiKey=process.env.OPENAI_API_KEY?.trim(),model=process.env.OPENAI_MODEL?.trim();
  if(!apiKey||!model)return null;
  const [services,orders]=await Promise.all([
    db.partnerService.findMany({where:{partnerId,active:true},take:50,select:{serviceId:true,service:{select:{name:true}}}}),
    db.order.findMany({where:{partnerId},orderBy:{createdAt:'desc'},take:30,select:{id:true,publicId:true,status:true}})
  ]);
  const system=[
    'You are a tool planner for one authenticated marketplace partner.',
    'Return JSON only. Never invent IDs. Use only the supplied service names/order refs.',
    'Read-only tools: getPartnerOrders, getPartnerOrderDetail, getPartnerAnalytics, getPartnerProfile, getPartnerServices, getPartnerReviews, getAlerts.',
    'Mutating tools: updateServicePrice, orderAction. Mutations are only proposals; the server always requires confirmation.',
    'Never request another partner, arbitrary SQL, URLs, secrets, environment variables, or shell access.',
    'For updateServicePrice use arguments {serviceName, price}. For orderAction use {orderRef, action} where action is ACCEPT, REJECT, DEPART, ARRIVE, START, or COMPLETE.'
  ].join(' ');
  const boundedContext=JSON.stringify({services:services.map(x=>({name:x.service.name})),orders:orders.map(x=>({publicId:x.publicId,status:x.status}))});
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:`Context: ${boundedContext}\nRequest: ${message}`}]}),signal:AbortSignal.timeout(12_000)});
  if(!response.ok)return null;
  const payload=await response.json() as {choices?:Array<{message?:{content?:string}}>};
  const content=payload.choices?.[0]?.message?.content;if(!content)return null;
  try{return planSchema.parse(JSON.parse(content))}catch{return null}
}
