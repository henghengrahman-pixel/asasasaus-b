import type {Prisma} from '@prisma/client';

export const PARTNER_BLOCKED_STATUSES=['REJECTED','SUSPENDED'] as const;

export function listingEligibility(input:{userActive:boolean;online:boolean;dispatchEnabled:boolean;status:string;storefrontStatus:string}){
  if(!input.userActive)return {eligible:false as const,reason:'ACCOUNT_INACTIVE'};
  if(!input.online)return {eligible:false as const,reason:'OFFLINE'};
  if(!input.dispatchEnabled)return {eligible:false as const,reason:'DISPATCH_DISABLED'};
  if(PARTNER_BLOCKED_STATUSES.includes(input.status as typeof PARTNER_BLOCKED_STATUSES[number]))return {eligible:false as const,reason:'PARTNER_BLOCKED'};
  if(input.storefrontStatus==='HIDDEN')return {eligible:false as const,reason:'STOREFRONT_HIDDEN'};
  return {eligible:true as const,reason:null};
}

export function eligiblePartnerWhere(serviceId?:string,areaId?:string):Prisma.PartnerWhereInput{
  return {
    user:{active:true},
    online:true,
    dispatchEnabled:true,
    status:{notIn:[...PARTNER_BLOCKED_STATUSES]},
    storefrontStatus:{not:'HIDDEN'},
    ...(serviceId?{services:{some:{serviceId,active:true}}}:{}),
    ...(areaId?{areas:{some:{areaId}}}:{})
  };
}

export function calculateLineTotal(input:{unitPrice:number;quantity:number;minimumCharge?:number}){
  if(!Number.isSafeInteger(input.unitPrice)||input.unitPrice<0)throw new Error('INVALID_UNIT_PRICE');
  if(!Number.isSafeInteger(input.quantity)||input.quantity<1)throw new Error('INVALID_QUANTITY');
  const minimumCharge=input.minimumCharge??0;
  if(!Number.isSafeInteger(minimumCharge)||minimumCharge<0)throw new Error('INVALID_MINIMUM_CHARGE');
  const multiplied=input.unitPrice*input.quantity;
  if(!Number.isSafeInteger(multiplied))throw new Error('PRICE_OVERFLOW');
  return Math.max(minimumCharge,multiplied);
}

export function reviewEligible(order:{status:string;customerId:string},requestingCustomerId:string,alreadyReviewed:boolean){
  return order.status==='COMPLETED'&&order.customerId===requestingCustomerId&&!alreadyReviewed;
}

export function unitLabel(unit:string|null|undefined,pricingType:string){
  if(unit?.trim())return unit.trim();
  if(pricingType==='PER_KG')return 'kg';
  if(pricingType==='PER_HOUR')return 'jam';
  if(pricingType==='PER_UNIT')return 'unit';
  return 'unit';
}

export function validationFieldMap(issues:ReadonlyArray<{path:ReadonlyArray<PropertyKey>}>,messages:Record<string,string>){
  const fields:Record<string,string>={};
  for(const issue of issues){const key=String(issue.path[0]??'');if(key&&!fields[key])fields[key]=messages[key]||'Periksa kembali nilai pada kolom ini.'}
  return fields;
}
