import {describe,expect,it} from 'vitest';
import {assertPartnerOwns,nextStatusForPartnerAction} from '@/lib/partner-operations';
import {canTransition} from '@/lib/order-state';
import {agentResultSchema} from '@/lib/partner-agent';
import {sanitizePlainText} from '@/lib/plain-text';

describe('partner ownership and order transitions',()=>{
  it('denies a cross-partner object',()=>expect(()=>assertPartnerOwns({partnerId:'partner-b'},'partner-a')).toThrow('NOT_FOUND'));
  it('allows only an owned object',()=>expect(()=>assertPartnerOwns({partnerId:'partner-a'},'partner-a')).not.toThrow());
  it('allows direct NEW order acceptance but not direct completion',()=>{
    expect(canTransition('NEW','ACCEPTED')).toBe(true);
    expect(nextStatusForPartnerAction('NEW','ACCEPT')).toBe('ACCEPTED');
    expect(()=>nextStatusForPartnerAction('NEW','COMPLETE')).toThrow('INVALID_TRANSITION');
  });
  it('uses the existing operational state machine for progress',()=>{
    expect(nextStatusForPartnerAction('ACCEPTED','DEPART')).toBe('ON_THE_WAY');
    expect(nextStatusForPartnerAction('ON_THE_WAY','ARRIVE')).toBe('ARRIVED');
    expect(nextStatusForPartnerAction('ARRIVED','START')).toBe('IN_PROGRESS');
    expect(nextStatusForPartnerAction('IN_PROGRESS','COMPLETE')).toBe('COMPLETED');
  });
});

describe('agent structured output contract',()=>{
  it('accepts a structured read action',()=>expect(agentResultSchema.parse({intent:'ORDER_LIST',confidence:.97,message:'Ada 2 order.',action:'SHOW_ORDERS',requiresConfirmation:false,tool:'getPartnerOrders',arguments:{}}).tool).toBe('getPartnerOrders'));
  it('rejects confidence outside the schema',()=>expect(()=>agentResultSchema.parse({intent:'X',confidence:2,message:'x',action:'NONE',requiresConfirmation:false,tool:null,arguments:{}})).toThrow());
});

describe('storefront text sanitation',()=>{
  it('removes markup and control characters from partner-authored text',()=>expect(sanitizePlainText('<script>alert(1)</script> Laundry\u0000 aman')).toBe('alert(1) Laundry aman'));
});
