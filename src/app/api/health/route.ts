import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({ok:true,service:'jasabatam',version:process.env.APP_VERSION||'dev'},{headers:{'cache-control':'no-store'}})}
