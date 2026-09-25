'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {UploadCloud} from 'lucide-react';
const groups=['CUSTOMER','BEFORE','PROGRESS','AFTER','DISPUTE'] as const;
export function OrderAttachmentUpload({orderId}:{orderId:string}){
  const router=useRouter();const input=useRef<HTMLInputElement>(null);const [group,setGroup]=useState<(typeof groups)[number]>('PROGRESS');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function upload(){const file=input.current?.files?.[0];if(!file)return;setBusy(true);setError('');try{const fd=new FormData();fd.set('file',file);fd.set('kind','order');fd.set('orderId',orderId);fd.set('group',group);const r=await fetch('/api/admin/upload',{method:'POST',body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error||'Upload gagal');if(input.current)input.current.value='';router.refresh()}catch(e){setError(e instanceof Error?e.message:'Upload gagal')}finally{setBusy(false)}}
  return <div className="attachment-upload"><select value={group} onChange={e=>setGroup(e.target.value as (typeof groups)[number])}>{groups.map(g=><option key={g}>{g}</option>)}</select><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/><button type="button" className="btn outline small" onClick={upload} disabled={busy}>{busy?'Mengunggah…':<><UploadCloud size={14}/> Upload</>}</button>{error&&<span className="field-error">{error}</span>}</div>;
}
