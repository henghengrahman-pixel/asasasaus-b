import {afterEach,describe,expect,it} from 'vitest';
import {getDatabaseUrl,getPublicEnv,getServerEnv,getSessionSecret} from '../../src/lib/runtime-env';

const original={...process.env};
afterEach(()=>{process.env={...original}});
describe('runtime environment boundaries',()=>{
  it('imports and reads build-safe config without runtime secrets',()=>{delete process.env.DATABASE_URL;delete process.env.SESSION_SECRET;expect(()=>getPublicEnv()).not.toThrow()});
  it('rejects missing database URL only when requested',()=>{delete process.env.DATABASE_URL;expect(()=>getDatabaseUrl()).toThrow(/DATABASE_URL/)});
  it('rejects missing session secret only when requested',()=>{delete process.env.SESSION_SECRET;expect(()=>getSessionSecret()).toThrow(/SESSION_SECRET/)});
  it('rejects a short session secret',()=>{process.env.SESSION_SECRET='short';expect(()=>getSessionSecret()).toThrow(/SESSION_SECRET/)});
  it('accepts valid runtime env',()=>{process.env.DATABASE_URL='postgresql://localhost/test';process.env.SESSION_SECRET='x'.repeat(32);process.env.NEXT_PUBLIC_APP_URL='https://example.com';expect(getServerEnv().DATABASE_URL).toContain('postgresql://');expect(getServerEnv().SESSION_SECRET).toHaveLength(32)});
  it('treats empty optional admin bootstrap variables as unset',()=>{process.env.DATABASE_URL='postgresql://localhost/test';process.env.SESSION_SECRET='x'.repeat(32);process.env.NEXT_PUBLIC_APP_URL='https://example.com';process.env.ADMIN_USERNAME='admin';process.env.ADMIN_PASSWORD='';process.env.ADMIN_PASSWORD_HASH='';expect(()=>getServerEnv()).not.toThrow();expect(getServerEnv().ADMIN_PASSWORD).toBeUndefined();expect(getServerEnv().ADMIN_PASSWORD_HASH).toBeUndefined()});
});
