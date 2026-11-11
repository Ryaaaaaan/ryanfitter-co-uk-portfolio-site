import {useEffect,useState} from 'react';
import '../styles/career-tools.css';

type Cv={id:string;filename:string;label:string;mime:string;size:number;created_at:string;is_primary:number};

export function CvLibrary({csrf}:{csrf:string}){
 const [docs,setDocs]=useState<Cv[]>([]);
 const [file,setFile]=useState<File|null>(null),[label,setLabel]=useState('Main CV');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
   setLoading(true);
   try{
     const r=await fetch('/admin/api/cvs',{cache:'no-store'});
     if(!r.ok)throw Error('CV vault is unavailable; please sign in again.');
     setDocs((await r.json() as {documents:Cv[]}).documents);setError('');
   }catch(e){setError(String(e));}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function upload(e:React.FormEvent){
   e.preventDefault();if(!file)return;
   setBusy(true);setError('');setNotice('');
   try{
     const payload=new FormData();payload.set('file',file);payload.set('label',label.trim());
     const r=await fetch('/admin/api/cvs',{method:'POST',headers:{'X-CSRF-Token':csrf},body:payload});
     const body=await r.json() as {documents?:Cv[];error?:string};
     if(!r.ok)throw Error(body.error||'Upload failed');
     setDocs(body.documents||[]);setFile(null);setNotice('CV securely uploaded and ready to download from any signed-in device.');
     const picker=document.getElementById('cv-picker') as HTMLInputElement|null;if(picker)picker.value='';
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function edit(id:string,mode:'primary'|'delete'){
   if(mode==='delete'&&!window.confirm('Permanently delete this CV version?'))return;
   setBusy(true);setError('');setNotice('');
   try{
     const r=await fetch('/admin/api/cvs/'+id+(mode==='primary'?'/primary':''),{
       method:mode==='primary'?'POST':'DELETE',headers:{'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:'{}'
     });
     const body=await r.json() as {documents?:Cv[];error?:string};
     if(!r.ok)throw Error(body.error||'Unable to update CV');
     setDocs(body.documents||[]);setNotice(mode==='primary'?'Default CV changed.':'CV deleted.');
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 return <section className="career-screen">
  <div className="career-header"><div><h2>My CV library</h2><p>Keep your latest CV and tailored versions ready to download from a phone, laptop or another signed-in device.</p></div><a className="career-link" href="/admin/jobs">Applications ↗</a></div>
  <div className="career-note"><strong>Private by default.</strong> Files never appear on your public portfolio. Download and attach a CV to an employer application yourself; this feature does not submit applications automatically.</div>
  <form className="career-panel cv-upload" onSubmit={e=>void upload(e)}>
   <h3>Upload a CV</h3>
   <div className="career-form-grid">
    <label>Version name<input value={label} maxLength={100} required onChange={e=>setLabel(e.target.value)} placeholder="Main CV, Shopify CV, Marketing CV…"/></label>
    <label>CV document<input id="cv-picker" type="file" required accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   </div>
   <p className="career-muted">PDF or DOCX, up to 4 MB. The first uploaded version becomes your default.</p>
   <button className="career-primary" type="submit" disabled={busy||!file}>{busy?'Uploading…':'Upload securely'}</button>
  </form>
  {error&&<p className="career-error" role="alert">{error}</p>}
  {notice&&<p className="career-success" role="status">{notice}</p>}
  <div className="career-section-heading"><h3>Stored versions</h3><span>{docs.length} file{docs.length===1?'':'s'}</span></div>
  {loading?<p>Loading your CVs…</p>:docs.length===0?<div className="career-empty"><h3>No CV stored yet</h3><p>Upload your current CV above to make it available from your phone or any other device.</p></div>:<div className="cv-list">
   {docs.map(d=><article key={d.id} className="cv-record"><div><div className="cv-title">{d.label} {Boolean(d.is_primary)&&<span className="career-tag">Default</span>}</div>
      <p>{d.filename} · {(d.size/1024).toFixed(0)} KB · {new Date(d.created_at).toLocaleDateString('en-GB')}</p></div>
    <div className="cv-actions"><a className="career-link" href={'/admin/api/cvs/'+d.id+'/download'}>Download CV</a>
      {!d.is_primary&&<button type="button" disabled={busy} onClick={()=>void edit(d.id,'primary')}>Make default</button>}
      <button type="button" className="career-danger" disabled={busy} onClick={()=>void edit(d.id,'delete')}>Delete</button>
    </div></article>)}
   </div>}
   <p className="career-muted">Your CV vault is available through the same secure login used by the CMS and job tracker. Uploaded documents do not get sent to any recruitment site by this dashboard.</p>
 </section>;
}
