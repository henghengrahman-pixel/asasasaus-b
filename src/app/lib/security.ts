import crypto from 'node:crypto';import {getSessionSecret} from './runtime-env';
function encryptionKey(){return crypto.createHash('sha256').update(getSessionSecret()).digest()}
export function encryptSecret(v:string){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);const b=Buffer.concat([c.update(v,'utf8'),c.final()]);return [iv.toString('base64url'),c.getAuthTag().toString('base64url'),b.toString('base64url')].join('.')}
export function decryptSecret(v:string){const [a,t,b]=v.split('.');const d=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(a,'base64url'));d.setAuthTag(Buffer.from(t,'base64url'));return Buffer.concat([d.update(Buffer.from(b,'base64url')),d.final()]).toString('utf8')}
export function hashIp(v:string){return crypto.createHmac('sha256',encryptionKey()).update(v).digest('hex').slice(0,32)}
