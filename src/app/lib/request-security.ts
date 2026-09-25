import {getPublicEnv} from './runtime-env';

function firstHeaderValue(value:string|null){return value?.split(',')[0]?.trim()||''}
function normalizeOrigin(value:string){try{return new URL(value).origin.toLowerCase()}catch{return ''}}

export function externalOrigin(r:Request){
  const forwardedHost=firstHeaderValue(r.headers.get('x-forwarded-host'));
  const host=forwardedHost||firstHeaderValue(r.headers.get('host'));
  const forwardedProto=firstHeaderValue(r.headers.get('x-forwarded-proto'));
  const proto=forwardedProto||new URL(r.url).protocol.replace(':','')||'https';
  if(host)return normalizeOrigin(`${proto}://${host}`);
  try{return normalizeOrigin(getPublicEnv().NEXT_PUBLIC_APP_URL)}catch{return new URL(r.url).origin.toLowerCase()}
}

export function isTrustedMutationOrigin(r:Request){
  const origin=r.headers.get('origin');
  if(!origin)return true;
  const actual=normalizeOrigin(origin);
  if(!actual)return false;
  const allowed=new Set<string>();
  allowed.add(new URL(r.url).origin.toLowerCase());
  const ext=externalOrigin(r);if(ext)allowed.add(ext);
  try{allowed.add(normalizeOrigin(getPublicEnv().NEXT_PUBLIC_APP_URL))}catch{}
  allowed.delete('');
  return allowed.has(actual);
}

export function externalUrl(r:Request,path:string){
  return new URL(path,externalOrigin(r)||new URL(r.url).origin);
}
