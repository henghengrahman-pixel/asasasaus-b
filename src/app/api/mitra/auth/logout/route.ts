import {NextResponse} from 'next/server';import {clearPartnerSession} from '@/lib/partner-auth';import {externalUrl,isTrustedMutationOrigin} from '@/lib/request-security';
export async function POST(r:Request){if(!isTrustedMutationOrigin(r))return NextResponse.json({error:'CSRF'},{status:403});await clearPartnerSession();return NextResponse.redirect(externalUrl(r,'/mitra/login'),303)}
