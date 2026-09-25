import {PanelShell} from '@/components/PanelShell';
import {PartnerAgentClient} from '@/components/PartnerAgentClient';
export const dynamic='force-dynamic';
export default function Page(){return <PanelShell kind="mitra"><div className="order-head"><div><h1>Agent Mitra</h1><p className="muted">Operations copilot dengan tool allowlist, ownership server-side, dan human confirmation untuk mutation.</p></div></div><PartnerAgentClient/></PanelShell>}
