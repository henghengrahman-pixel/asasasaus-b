import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';

const db=new PrismaClient();
const slug=(v:string)=>v.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

async function bootstrapAdmin(){
  const username=process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const plain=process.env.ADMIN_PASSWORD?.trim();
  const suppliedHash=process.env.ADMIN_PASSWORD_HASH?.trim();
  // Bootstrap is opt-in: production restarts must not require a plaintext password.
  // If neither secret is supplied, keep the existing admin/database untouched and continue startup.
  if(!plain && !suppliedHash){
    if(username) console.log('[seed] Admin bootstrap skipped: no ADMIN_PASSWORD/ADMIN_PASSWORD_HASH supplied for',username);
    return;
  }
  if(!username) throw new Error('ADMIN_USERNAME is required when ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is configured');
  if(plain && suppliedHash) throw new Error('Set only one of ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
  const existing=await db.user.findUnique({where:{username}});
  if(existing){
    console.log('[seed] Admin bootstrap skipped: user already exists:',username);
    return; // Never overwrite password/2FA during restart or repeated seed.
  }
  let passwordHash:string;
  if(plain){
    if(process.env.NODE_ENV==='production' && plain.length<12) throw new Error('ADMIN_PASSWORD must be at least 12 characters in production');
    if(plain.length<8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
    passwordHash=await bcrypt.hash(plain,12);
  }else{
    if(!suppliedHash || !/^\$2[aby]\$\d{2}\$/.test(suppliedHash)) throw new Error('ADMIN_PASSWORD_HASH must be a valid bcrypt hash');
    try{bcrypt.getRounds(suppliedHash)}catch{throw new Error('ADMIN_PASSWORD_HASH must be a valid bcrypt hash')}
    passwordHash=suppliedHash;
  }
  await db.user.create({data:{username,passwordHash,role:'SUPER_ADMIN',passwordChangedAt:new Date()}});
  console.log('[seed] Bootstrap SUPER_ADMIN created:',username); // never log password/hash
}

async function main(){
  const areas=['Batam Kota','Batu Aji','Sekupang','Bengkong','Nongsa'];
  for(const name of areas) await db.area.upsert({where:{slug:slug(name)},update:{},create:{name,slug:slug(name)}});
  const data=[['Service AC','service-ac',[['Cuci AC Split','cuci-ac',100000]]],['Laundry','laundry',[['Laundry Kiloan','laundry-kiloan',7000]]],['Cleaning Service','cleaning-service',[['Cleaning Rumah','cleaning-rumah',150000]]]] as const;
  for(const [name,categorySlug,services] of data){
    const c=await db.category.upsert({where:{slug:categorySlug},update:{},create:{name,slug:categorySlug}});
    for(const [sn,ss,price] of services) await db.service.upsert({where:{slug:ss},update:{},create:{categoryId:c.id,name:sn,slug:ss,basePrice:price,featured:true}});
  }
  await db.setting.upsert({where:{key:'business'},update:{},create:{key:'business',value:{siteName:'JasaBatam',currency:'IDR',defaultCommissionBps:1000,minimumPayout:50000}}});
  await bootstrapAdmin();
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Seed failed');process.exitCode=1}).finally(()=>db.$disconnect());
