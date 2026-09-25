import {NextResponse} from 'next/server';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){try{await db.$queryRaw`SELECT 1`;return NextResponse.json({ok:true,service:'jasabatam',database:'ok',version:process.env.APP_VERSION||'dev'},{headers:{'cache-control':'no-store'}})}catch{return NextResponse.json({ok:false,service:'jasabatam',database:'error',version:process.env.APP_VERSION||'dev'},{status:503,headers:{'cache-control':'no-store'}})}}
