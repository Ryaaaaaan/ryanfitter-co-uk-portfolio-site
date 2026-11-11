import {useEffect,useMemo,useState} from 'react';
import '../styles/career-tools.css';

type Interview={
 id:number;title:string;company:string;start_at:string;duration_minutes:number;
 kind:'phone'|'video'|'in_person'|'assessment'|'other';meeting_url:string;
 location:string;notes:string;job_id:number|null;status:'scheduled'|'completed'|'cancelled';
};
type Input=Omit<Interview,'id'>;
type Application={id:number;title:string;company:string;status:string};
const blank:Input={title:'Interview',company:'',start_at:'',duration_minutes:60,
 kind:'video',meeting_url:'',location:'',notes:'',job_id:null,status:'scheduled'};
const pad=(x:number)=>String(x).padStart(2,'0');
const isoDay=(date:Date)=>[date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-');
const human=(x:string)=>new Date(x+':00').toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const displayMonth=(year:number,month:number)=>new Date(year,month,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
const fmtTime=(s:string)=>s.slice(11,16);

export function InterviewCalendar({csrf}:{csrf:string}){
 const [events,setEvents]=useState<Interview[]>([]),[jobs,setJobs]=useState<Application[]>([]);
 const [month,setMonth]=useState(()=>new Date().getMonth()),[year,setYear]=useState(()=>new Date().getFullYear());
 const [editing,setEditing]=useState<number|null>(null),[form,setForm]=useState<Input>({...blank}),[show,setShow]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  setLoading(true);
  try{
   const [a,b]=await Promise.all([fetch('/admin/api/interviews',{cache:'no-store'}),fetch('/admin/api/jobs',{cache:'no-store'})]);
   if(!a.ok||!b.ok)throw Error('Calendar unavailable; please sign in again.');
   setEvents((await a.json() as {events:Interview[]}).events);
   setJobs((await b.json() as {jobs:Application[]}).jobs);
   setError('');
  }catch(e){setError(String(e));}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 function navigate(delta:number){
  const x=new Date(year,month+delta,1);setMonth(x.getMonth());setYear(x.getFullYear());
 }
 function start(day?:string,event?:Interview){
  setEditing(event?.id??null);setNotice('');setError('');
  setForm(event?{
   title:event.title,company:event.company,start_at:event.start_at,
   duration_minutes:event.duration_minutes,kind:event.kind,meeting_url:event.meeting_url,
   location:event.location,notes:event.notes,job_id:event.job_id,status:event.status
  }:{...blank,start_at:(day||isoDay(new Date()))+'T10:00'});
  setShow(true);
 }
 function change<K extends keyof Input>(key:K,value:Input[K]){setForm(old=>({...old,[key]:value}));}
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  const url='/admin/api/interviews'+(editing?'/'+editing:'');
  try{
   const response=await fetch(url,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(form)});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error||'Unable to save interview');
   setShow(false);await load();setNotice(editing?'Interview updated.':'Interview added.');
  }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function remove(){
  if(!editing||!window.confirm('Delete this interview from the calendar?'))return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/admin/api/interviews/'+editing,{method:'DELETE',headers:{'X-CSRF-Token':csrf}});
   if(!r.ok)throw Error('Could not delete the interview');
   setShow(false);await load();setNotice('Interview removed.');
  }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 const byDay=useMemo(()=>{
  const obj:Record<string,Interview[]>={};
  for(const e of events){const day=e.start_at.slice(0,10);(obj[day]??=[]).push(e);}
  return obj;
 },[events]);
 const first=new Date(year,month,1);
 const leading=(first.getDay()+6)%7;
 const cells=Array.from({length:42},(_,i)=>new Date(year,month,i-leading+1));
 const today=isoDay(new Date());
 const upcoming=events.filter(e=>e.status==='scheduled'&&e.start_at.slice(0,10)>=today).slice(0,10);
 return <section className="career-screen">
  <div className="career-header"><div><h2>Interview calendar</h2><p>Keep all interviews, calls and assessments in one place, including meeting links and preparation notes.</p></div>
   <div className="career-header-actions"><a href="/admin/api/interviews/calendar.ics" className="career-link">Export calendar (.ics)</a><button className="career-primary" type="button" onClick={()=>start()}>+ Add interview</button></div></div>
  <div className="career-note">Times are entered in <strong>UK local time (Europe/London)</strong>. Export your calendar to Outlook, Apple Calendar or Google Calendar using the .ics file. This export is a snapshot, not a live sync.</div>
  {error&&<p className="career-error" role="alert">{error}</p>}{notice&&<p className="career-success" role="status">{notice}</p>}
  <div className="career-calendar">
   <div className="calendar-top"><h3>{displayMonth(year,month)}</h3><div><button onClick={()=>navigate(-1)} aria-label="Previous month">←</button><button onClick={()=>{setMonth(new Date().getMonth());setYear(new Date().getFullYear());}}>Today</button><button onClick={()=>navigate(1)} aria-label="Next month">→</button></div></div>
   <div className="calendar-grid">
    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div className="calendar-weekday" key={d}>{d}</div>)}
    {cells.map((day,i)=>{
      const key=isoDay(day),inMonth=day.getMonth()===month;
      return <div key={i} className={'calendar-day'+(inMonth?'':' calendar-other')+(key===today?' calendar-today':'')}>
       <button type="button" className="calendar-day-number" onClick={()=>start(key)} aria-label={'Add interview on '+key}>{day.getDate()}</button>
       <div className="calendar-events">{(byDay[key]||[]).slice(0,3).map(e=><button key={e.id} className={'calendar-event '+e.status} type="button" onClick={()=>start(undefined,e)} title={e.title+' — '+e.company}>{fmtTime(e.start_at)} {e.company}</button>)}</div>
       {(byDay[key]||[]).length>3&&<small>+{byDay[key].length-3} more</small>}
      </div>;
    })}
   </div>
  </div>
  {show&&<form className="career-panel" onSubmit={e=>void save(e)}>
   <div className="career-section-heading"><h3>{editing?'Edit interview':'New interview'}</h3><button type="button" onClick={()=>setShow(false)}>Close</button></div>
   <div className="career-form-grid">
    <label>Linked application<select value={form.job_id??''} onChange={e=>{
      const id=e.target.value?Number(e.target.value):null;
      const job=jobs.find(j=>j.id===id);
      setForm(old=>({...old,job_id:id,company:job?.company||old.company,title:job?'Interview — '+job.title:old.title}));
     }}><option value="">No linked application</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.company} — {j.title}</option>)}</select></label>
    <label>Interview title<input required maxLength={160} value={form.title} onChange={e=>change('title',e.target.value)}/></label>
    <label>Company<input required maxLength={160} value={form.company} onChange={e=>change('company',e.target.value)}/></label>
    <label>Start date and time<input required type="datetime-local" value={form.start_at} onChange={e=>change('start_at',e.target.value)}/></label>
    <label>Duration (minutes)<input required min={15} max={480} step={15} type="number" value={form.duration_minutes} onChange={e=>change('duration_minutes',Number(e.target.value))}/></label>
    <label>Format<select value={form.kind} onChange={e=>change('kind',e.target.value as Input['kind'])}><option value="video">Video interview</option><option value="phone">Phone call</option><option value="in_person">In person</option><option value="assessment">Assessment</option><option value="other">Other</option></select></label>
    <label>Status<select value={form.status} onChange={e=>change('status',e.target.value as Input['status'])}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
    <label>Meeting URL<input type="url" maxLength={2000} placeholder="https://…" value={form.meeting_url} onChange={e=>change('meeting_url',e.target.value)}/></label>
    <label>Location / instructions<input maxLength={250} value={form.location} onChange={e=>change('location',e.target.value)}/></label>
    <label className="career-span">Preparation notes<textarea maxLength={5000} rows={4} value={form.notes} onChange={e=>change('notes',e.target.value)}/></label>
   </div>
   <div className="career-form-actions"><button className="career-primary" type="submit" disabled={busy}>{busy?'Saving…':'Save interview'}</button><button type="button" onClick={()=>setShow(false)} disabled={busy}>Cancel</button>{editing&&<button type="button" className="career-danger" onClick={()=>void remove()} disabled={busy}>Delete</button>}</div>
  </form>}
  <div className="career-section-heading"><h3>Upcoming interviews</h3><span>{upcoming.length} scheduled</span></div>
  {loading?<p>Loading calendar…</p>:upcoming.length===0?<div className="career-empty"><h3>No interviews scheduled</h3><p>Choose a date above or add an interview when an employer gets back to you.</p></div>:<div className="calendar-upcoming">
   {upcoming.map(e=><article key={e.id} className="calendar-upcoming-row"><div><small>{human(e.start_at)} · {e.duration_minutes} mins</small><h4>{e.company} — {e.title}</h4><p>{e.location||e.kind.replace('_',' ')}</p></div>
    <div className="career-header-actions">{e.meeting_url&&<a className="career-link" href={e.meeting_url} target="_blank" rel="noreferrer noopener">Join meeting</a>}<button onClick={()=>start(undefined,e)}>Edit</button></div></article>)}
  </div>}
 </section>;
}
