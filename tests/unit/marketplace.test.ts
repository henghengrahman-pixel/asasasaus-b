import {describe,expect,it} from 'vitest';
import {calculateLineTotal,listingEligibility,reviewEligible,unitLabel,validationFieldMap} from '@/lib/marketplace';
import {isListingEligible,partnerSlug,rankingScore} from '@/lib/partner-storefront';

describe('marketplace partner eligibility',()=>{
  const base={userActive:true,online:true,dispatchEnabled:true,status:'DRAFT',storefrontStatus:'PUBLISHED'};
  it('allows an operational DRAFT partner without claiming verification',()=>{
    expect(listingEligibility(base)).toEqual({eligible:true,reason:null});
    expect(isListingEligible({status:'DRAFT',online:true,dispatchEnabled:true,storefrontStatus:'PUBLISHED',user:{active:true}})).toBe(true);
  });
  it('excludes rejected and suspended partners',()=>{
    expect(listingEligibility({...base,status:'REJECTED'})).toEqual({eligible:false,reason:'PARTNER_BLOCKED'});
    expect(listingEligibility({...base,status:'SUSPENDED'})).toEqual({eligible:false,reason:'PARTNER_BLOCKED'});
  });
  it('excludes offline and dispatch-disabled partners',()=>{
    expect(listingEligibility({...base,online:false}).reason).toBe('OFFLINE');
    expect(listingEligibility({...base,dispatchEnabled:false}).reason).toBe('DISPATCH_DISABLED');
  });
  it('excludes inactive account and hidden storefront',()=>{
    expect(listingEligibility({...base,userActive:false}).reason).toBe('ACCOUNT_INACTIVE');
    expect(listingEligibility({...base,storefrontStatus:'HIDDEN'}).reason).toBe('STOREFRONT_HIDDEN');
  });
});

describe('checkout price calculation',()=>{
  it('calculates Rp7.000/kg x 2 on the server helper',()=>expect(calculateLineTotal({unitPrice:7000,quantity:2})).toBe(14000));
  it('honors an actual minimum charge',()=>expect(calculateLineTotal({unitPrice:7000,quantity:1,minimumCharge:10000})).toBe(10000));
  it('rejects invalid quantity and negative prices',()=>{
    expect(()=>calculateLineTotal({unitPrice:7000,quantity:0})).toThrow('INVALID_QUANTITY');
    expect(()=>calculateLineTotal({unitPrice:-1,quantity:1})).toThrow('INVALID_UNIT_PRICE');
  });
  it('uses pricing unit metadata instead of inventing a unit',()=>{
    expect(unitLabel(null,'PER_KG')).toBe('kg');
    expect(unitLabel('m²','PER_UNIT')).toBe('m²');
  });
});

describe('storefront and ranking safety',()=>{
  it('builds a safe storefront slug',()=>expect(partnerSlug('HL Laundry')).toBe('hl-laundry'));
  it('does not rank a partner without the minimum sample',()=>expect(rankingScore({averageRating:5,ratingCount:1,completedOrders:1,completionRate:1,responseRate:1,averageResponseMinutes:5,cancellationRate:0}).eligible).toBe(false));
});

describe('review eligibility',()=>{
  const completed={status:'COMPLETED',customerId:'customer-a'};
  it('allows only the owning customer after a completed order',()=>expect(reviewEligible(completed,'customer-a',false)).toBe(true));
  it('rejects another customer, incomplete order, or duplicate review',()=>{
    expect(reviewEligible(completed,'customer-b',false)).toBe(false);
    expect(reviewEligible({...completed,status:'IN_PROGRESS'},'customer-a',false)).toBe(false);
    expect(reviewEligible(completed,'customer-a',true)).toBe(false);
  });
});

describe('customer API error formatting',()=>{
  it('maps validation issues to customer-safe field messages without raw Zod JSON',()=>{
    const fields=validationFieldMap([{path:['address']},{path:['address']},{path:['phone']}],{address:'Alamat terlalu singkat. Masukkan alamat lengkap minimal 8 karakter.',phone:'Nomor tidak valid.'});
    expect(fields).toEqual({address:'Alamat terlalu singkat. Masukkan alamat lengkap minimal 8 karakter.',phone:'Nomor tidak valid.'});
  });
});
