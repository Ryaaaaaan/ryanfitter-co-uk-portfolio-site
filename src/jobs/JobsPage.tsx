import {useEffect, useMemo, useState} from 'react';
import '../styles/jobs.css';

type Status='saved'|'applied'|'interview'|'offer'|'rejected'|'withdrawn';
type Workplace='remote'|'hybrid'|'onsite'|'unknown';
type Details={
  company:string;title:string;url:string;location:string;salary:string;source:string;
  notes:string;contact:string;applied_at:string;follow_up_at:string;
  status:Status;workplace:Workplace;
};
type Job=Details & {id:number;revision:number;created_at:string;updated_at:string};
const empty:Details={
  company:'',title:'',url:'',location:'',salary:'',source:'',notes:'',contact:'',
  applied_at:'',follow_up_at:'',status:'saved',workplace:'remote'
};
const statuses:Status[]=['saved','applied','interview','offer','rejected','withdrawn'];
const titles:Record<Status,string>={
  saved:'Saved',applied:'Applied',interview:'Interview',offer:'Offer',
  rejected:'Rejected',withdrawn:'Withdrawn'
};
const today=()=>new Date().toLocaleDateString('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'});

export function JobsPage({csrf}:{csrf:string}){
  const [jobs,setJobs]=useState<Job[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [editing,setEditing]=useState<Job|null>(null);
  const [form,setForm]=useState<Details>({...empty});
  const [showForm,setShowForm]=useState(false);
  const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState('all');
  const [workplaceFilter,setWorkplaceFilter]=useState('all');

  async function load(){
    setLoading(true);
    try{
      const response=await fetch('/admin/api/jobs',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw Error('Unable to load applications. Please sign in again.');
      const data=await response.json() as {jobs:Job[]};
      setJobs(data.jobs);setError('');
    }catch(e){setError(String(e));}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  const date=today();
  const due=jobs.filter(j=>j.follow_up_at&&j.follow_up_at<=date&&!['rejected','withdrawn'].includes(j.status));
  const filtered=useMemo(()=>jobs.filter(j=>{
    const haystack=[j.company,j.title,j.location,j.salary,j.source,j.notes].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase())&&
      (statusFilter==='all'||j.status===statusFilter)&&
      (workplaceFilter==='all'||j.workplace===workplaceFilter);
  }).sort((a,b)=>(!!b.follow_up_at&&b.follow_up_at<=date?1:0)-(!!a.follow_up_at&&a.follow_up_at<=date?1:0)
    ||b.updated_at.localeCompare(a.updated_at)||b.id-a.id),[jobs,query,statusFilter,workplaceFilter,date]);

  function start(job?:Job){
    setEditing(job||null);
    setForm(job?{
      company:job.company,title:job.title,url:job.url,location:job.location,salary:job.salary,
      source:job.source,notes:job.notes,contact:job.contact,applied_at:job.applied_at,
      follow_up_at:job.follow_up_at,status:job.status,workplace:job.workplace
    }:{...empty});
    setShowForm(true);setError('');setNotice('');
  }
  function change<K extends keyof Details>(name:K,value:Details[K]){setForm(old=>({...old,[name]:value}));}
  async function send(path:string,method:string,body:unknown){
    const r=await fetch(path,{method,credentials:'same-origin',headers:{
      'Content-Type':'application/json','X-CSRF-Token':csrf
    },body:JSON.stringify(body)});
    if(!r.ok){
      const data=await r.json().catch(()=>({error:'Request failed'})) as {error?:string};
      throw Error(data.error||'Unable to save the application.');
    }
  }
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      if(editing)await send('/admin/api/jobs/'+editing.id,'PUT',{revision:editing.revision,job:form});
      else await send('/admin/api/jobs','POST',form);
      setShowForm(false);setEditing(null);await load();setNotice(editing?'Application updated.':'Application added.');
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function quickStatus(job:Job,next:Status){
    setBusy(true);setError('');
    try{
      const details:Details={company:job.company,title:job.title,url:job.url,location:job.location,
        salary:job.salary,source:job.source,notes:job.notes,contact:job.contact,
        applied_at:job.applied_at,follow_up_at:job.follow_up_at,status:next,workplace:job.workplace};
      if(next==='applied'&&!details.applied_at)details.applied_at=today();
      await send('/admin/api/jobs/'+job.id,'PUT',{revision:job.revision,job:details});
      await load();setNotice('Stage updated.');
    }catch(e){setError(String(e));await load();}finally{setBusy(false);}
  }
  async function remove(){
    if(!editing||!window.confirm('Permanently delete this application?'))return;
    setBusy(true);setError('');
    try{
      await send('/admin/api/jobs/'+editing.id,'DELETE',{revision:editing.revision});
      setShowForm(false);setEditing(null);await load();setNotice('Application deleted.');
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  const control=(key:keyof Details,label:string,type='text')=><label className="jobs-field">{label}
    <input type={type} value={form[key]} onChange={e=>change(key,e.target.value as never)}
      maxLength={key==='url'?2000:200} required={key==='title'||key==='company'} />
  </label>;
  return <div className="jobs-workspace">
    <div className="jobs-heading">
      <div><h2>Applications</h2><p>Track vacancies, conversations and follow-ups. Your data stays in your private dashboard.</p></div>
      <button className="jobs-primary" type="button" onClick={()=>start()}>+ Add application</button>
    </div>
    <div className="jobs-stats">
      <div><small>ALL RECORDS</small><strong>{jobs.length}</strong></div>
      <div><small>APPLIED</small><strong>{jobs.filter(j=>j.status==='applied').length}</strong></div>
      <div><small>INTERVIEWS</small><strong>{jobs.filter(j=>j.status==='interview').length}</strong></div>
      <div><small>FOLLOW-UPS DUE</small><strong>{due.length}</strong></div>
    </div>
    <div className="jobs-filterbar">
      <label>Search <input type="search" placeholder="Role, employer, notes…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>Stage <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
        <option value="all">All stages</option>{statuses.map(s=><option key={s} value={s}>{titles[s]}</option>)}
      </select></label>
      <label>Work arrangement <select value={workplaceFilter} onChange={e=>setWorkplaceFilter(e.target.value)}>
        <option value="all">All types</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option><option value="unknown">Unspecified</option>
      </select></label>
      <button type="button" onClick={()=>void load()} disabled={loading}>Refresh</button>
    </div>
    {notice&&<p className="jobs-notice" role="status">{notice}</p>}
    {error&&<p className="jobs-error" role="alert">{error}</p>}
    {showForm&&<section className="jobs-form-panel">
      <div className="jobs-form-head"><h3>{editing?'Edit application':'New application'}</h3>
        <button type="button" onClick={()=>{setShowForm(false);setError('');}} disabled={busy}>Close</button></div>
      <form onSubmit={e=>void save(e)}>
        <div className="jobs-form-grid">
          {control('company','Company')}{control('title','Job title')}
          {control('url','Vacancy URL','url')}{control('location','Location')}
          {control('salary','Salary / rate')}{control('source','Found via')}
          {control('contact','Contact / recruiter')}
          <label className="jobs-field">Work arrangement<select value={form.workplace} onChange={e=>change('workplace',e.target.value as Workplace)}>
            <option value="remote">Fully remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option><option value="unknown">Unknown</option>
          </select></label>
          <label className="jobs-field">Stage<select value={form.status} onChange={e=>change('status',e.target.value as Status)}>
            {statuses.map(s=><option value={s} key={s}>{titles[s]}</option>)}
          </select></label>
          {control('applied_at','Date applied','date')}{control('follow_up_at','Follow-up date','date')}
          <label className="jobs-field jobs-wide">Notes<textarea rows={5} maxLength={10000} value={form.notes} onChange={e=>change('notes',e.target.value)} placeholder="CV version, interview notes, next steps…"/></label>
        </div>
        <div className="jobs-form-actions"><button type="submit" className="jobs-primary" disabled={busy}>{busy?'Saving…':editing?'Save changes':'Add application'}</button>
        <button type="button" disabled={busy} onClick={()=>setShowForm(false)}>Cancel</button>
        {editing&&<button type="button" className="jobs-danger" disabled={busy} onClick={()=>void remove()}>Delete</button>}</div>
      </form>
    </section>}
    <div className="jobs-result-header"><strong>{filtered.length} applications</strong>
      <span>{due.length?due.length+' follow-up'+(due.length===1?'':'s')+' due':'No overdue follow-ups'}</span></div>
    {loading?<p className="jobs-empty">Loading applications…</p>:!filtered.length?<div className="jobs-empty">
      <h3>{jobs.length?'No matching applications':'Your tracker is ready.'}</h3>
      <p>{jobs.length?'Try a different filter or search.':'Add your first vacancy to record its stage, notes and any follow-up.'}</p>
      {!jobs.length&&<button type="button" className="jobs-primary" onClick={()=>start()}>Add a vacancy</button>}
    </div>:<div className="jobs-list">{filtered.map(job=><article className="jobs-card" key={job.id}>
      <div className="jobs-card-main">
        <div className="jobs-card-eyebrow"><span>{job.company}</span><span className={'jobs-workplace '+job.workplace}>{job.workplace==='remote'?'Fully remote':job.workplace==='onsite'?'On-site':job.workplace==='hybrid'?'Hybrid':'Not specified'}</span></div>
        <h3>{job.title}</h3><p>{[job.location,job.salary].filter(Boolean).join(' · ')||'No location or salary recorded'}</p>
        {job.follow_up_at&&<span className={'jobs-followup '+(job.follow_up_at<=date?'due':'')}>Follow up: {job.follow_up_at}{job.follow_up_at<=date?' · Due':''}</span>}
        {job.notes&&<p className="jobs-card-note">{job.notes}</p>}
      </div>
      <div className="jobs-card-actions"><label>Stage<select disabled={busy} value={job.status} onChange={e=>void quickStatus(job,e.target.value as Status)}>{statuses.map(s=><option key={s} value={s}>{titles[s]}</option>)}</select></label>
        <button type="button" onClick={()=>start(job)}>Edit</button>
        {job.url&&<a href={job.url} target="_blank" rel="noreferrer noopener">Vacancy ↗</a>}
      </div>
    </article>)}</div>}
    <p className="jobs-hint">New recommended vacancies appear in <a href="/admin/job-matches">Job matches</a>. Save a match there to copy it into this application tracker.</p>
  </div>;
}