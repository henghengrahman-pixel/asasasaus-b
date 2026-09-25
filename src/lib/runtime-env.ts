import {z} from 'zod';

const publicSchema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  NEXT_PUBLIC_APP_URL:z.string().url().default('http://localhost:3000'),
  APP_VERSION:z.string().default('dev'),
});
const databaseSchema=z.string().min(1,'DATABASE_URL is required at runtime');
const sessionSchema=z.string().min(32,'SESSION_SECRET must be at least 32 characters');
const emptyToUndefined=(value:unknown)=>typeof value==='string'&&value.trim()===''?undefined:value;
const bootstrapSchema=z.object({
  ADMIN_USERNAME:z.preprocess(emptyToUndefined,z.string().min(3).max(80).optional()),
  ADMIN_PASSWORD:z.preprocess(emptyToUndefined,z.string().min(8).max(200).optional()),
  ADMIN_PASSWORD_HASH:z.preprocess(emptyToUndefined,z.string().min(20).optional()),
});

export type RuntimeConfigurationError=Error;
function configurationError(name:string,details:string):never{throw new Error(`Missing or invalid runtime environment variable: ${name}. ${details}`)}

export function getPublicEnv(){return publicSchema.parse({NODE_ENV:process.env.NODE_ENV,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL,APP_VERSION:process.env.APP_VERSION})}
export function getDatabaseUrl(){const p=databaseSchema.safeParse(process.env.DATABASE_URL);if(!p.success)configurationError('DATABASE_URL','Set it to the Railway PostgreSQL reference, for example ${{Postgres.DATABASE_URL}}.');return p.data}
export function getSessionSecret(){const p=sessionSchema.safeParse(process.env.SESSION_SECRET);if(!p.success)configurationError('SESSION_SECRET','Generate a high-entropy secret of at least 32 characters.');return p.data}
export function getBootstrapEnv(){const p=bootstrapSchema.safeParse({ADMIN_USERNAME:process.env.ADMIN_USERNAME,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD,ADMIN_PASSWORD_HASH:process.env.ADMIN_PASSWORD_HASH});if(!p.success)throw new Error(`Invalid bootstrap environment configuration: ${p.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')}`);return p.data}
export function getServerEnv(){return {...getPublicEnv(),DATABASE_URL:getDatabaseUrl(),SESSION_SECRET:getSessionSecret(),...getBootstrapEnv()}}
