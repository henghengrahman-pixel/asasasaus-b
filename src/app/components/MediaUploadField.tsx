'use client';
import {useRef,useState} from 'react';
import {UploadCloud} from 'lucide-react';

export function MediaUploadField({name,kind,label='Upload media',accept='image/jpeg,image/png,image/webp',defaultValue=''}:{name:string;kind:string;label?:string;accept?:string;defaultValue?:string}){
  const [url,setUrl]=useState(defaultValue),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const ref=useRef<HTMLInputElement>(null);
  async function change(){const file=ref.current?.files?.[0];if(!file)return;setBusy(true);setError('');try{const f=new FormData();f.set('file',file);f.set('kind',kind);const r=await fetch('/api/admin/upload',{method:'POST',body:f});const j=await r.json();if(!r.ok)throw new Error(j.error||'Upload gagal');setUrl(j.url)}catch(e){setError(e instanceof Error?e.message:'Upload gagal')}finally{setBusy(false)}}
  return <div className="field-label"><span>{label}</span><input ref={ref} type="file" accept={accept} onChange={change}/><input type="hidden" name={name} value={url}/>{busy&&<span className="field-help"><UploadCloud size={13}/> Mengunggah…</span>}{url&&<span className="field-help">Media tersimpan: {url}</span>}{error&&<span className="field-help field-error">{error}</span>}</div>;
}
