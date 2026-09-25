import {afterEach,describe,expect,it} from 'vitest';
import {externalOrigin,externalUrl,isTrustedMutationOrigin} from '@/lib/request-security';

const oldUrl=process.env.NEXT_PUBLIC_APP_URL;
afterEach(()=>{if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_APP_URL;else process.env.NEXT_PUBLIC_APP_URL=oldUrl});

describe('Railway reverse-proxy request security',()=>{
  it('accepts the public Railway origin from forwarded headers even when request URL is internal',()=>{
    process.env.NEXT_PUBLIC_APP_URL='https://jasa-batam-production.up.railway.app';
    const r=new Request('http://0.0.0.0:8080/api/admin/auth/login',{method:'POST',headers:{origin:'https://jasa-batam-production.up.railway.app','x-forwarded-host':'jasa-batam-production.up.railway.app','x-forwarded-proto':'https'}});
    expect(isTrustedMutationOrigin(r)).toBe(true);
    expect(externalOrigin(r)).toBe('https://jasa-batam-production.up.railway.app');
    expect(externalUrl(r,'/admin/login').toString()).toBe('https://jasa-batam-production.up.railway.app/admin/login');
  });

  it('rejects an unrelated cross-site origin',()=>{
    process.env.NEXT_PUBLIC_APP_URL='https://jasa-batam-production.up.railway.app';
    const r=new Request('http://0.0.0.0:8080/api/admin/auth/login',{method:'POST',headers:{origin:'https://evil.example','x-forwarded-host':'jasa-batam-production.up.railway.app','x-forwarded-proto':'https'}});
    expect(isTrustedMutationOrigin(r)).toBe(false);
  });
});
