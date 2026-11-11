import {useEffect,useMemo,useState} from 'react';
import '../styles/job-matches.css';

type Match={
 key:string;company:string;title:string;apply_url:string;source:string;
 hours:string;employment_type:string;location:string;salary:string;score:number;
 reason:string;warning:string;confidence:string;posted:string;state:string;
 first_seen:string;last_seen:string;
};
type Scan={id:number;started:string;finished:string|null;status:string;added:number;reviewed:number;details:string};
type ScanResponse={matches:Match[];scan:Scan|null};
const showDate=(value:string|null|undefined)=>value?new Date(value).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Not yet scanned';

export function JobMatches({csrf}:{csrf:string}){
 const [result,setResult]=useState<ScanResponse>({matches:[],scan:null});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [query,setQuery]=useState(''),[tab,setTab]=useState<'new'|'saved'|'all'>('new');
 const [hours,setHours]=useState<'all'|'part'|'other'>('all');
 const [quality,setQuality]=useState<'all'|'strong'|'possible'|'explore'>('all');
 async function load(silent=false){
   if(!silent)setLoading(true);
   try{
     const r=await fetch('/admin/api/job-matches',{cache:'no-store'});
     if(!r.ok)throw Error('Could not load private job matches.');
     const data=await r.json() as ScanResponse;
     setResult(data);setError('');
     return data;
   }catch(e){setError(String(e));return null;}finally{if(!silent)setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{
   if(result.scan?.status!=='running')return;
   const timer=window.setInterval(()=>{void load(true);},5000);
   return()=>window.clearInterval(timer);
 },[result.scan?.id,result.scan?.status]);
 const matches=useMemo(()=>result.matches.filter(m=>{
   if(tab!=='all'&&m.state!==tab)return false;
   if(quality==='strong'&&m.score<80)return false;
   if(quality==='possible'&&(m.score<65||m.score>=80))return false;
   if(quality==='explore'&&m.score>=65)return false;
   if(hours==='part'&&!/10|15|20|25|30|part.time|contract|freelance/i.test(m.hours+' '+m.employment_type))return false;
   if(hours==='other'&&/10|15|20|25|30|part.time|contract|freelance/i.test(m.hours+' '+m.employment_type))return false;
   const content=[m.company,m.title,m.reason,m.source,m.location,m.employment_type].join(' ').toLowerCase();
   return content.includes(query.trim().toLowerCase());
 }),[result.matches,tab,hours,quality,query]);
 async function action(key:string,name:'save'|'dismiss'){
   setBusy(key);setMessage('');setError('');
   try{
     const r=await fetch('/admin/api/job-matches/'+key+'/action',{
       method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},
       body:JSON.stringify({action:name})
     });
     const data=await r.json() as {error?:string};
     if(!r.ok)throw Error(data.error||'Could not update this match.');
     await load(true);
     setMessage(name==='save'?'Saved to Applications. You can update its stage and notes there.':'Match dismissed. It will stay out of future scan results.');
   }catch(e){setError(String(e));}finally{setBusy('');}
 }
 async function trigger(){
   setBusy('scan');setMessage('');setError('');
   try{
     const r=await fetch('/admin/api/job-scans',{
       method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},
       body:'{}'
     });
     const data=await r.json() as {error?:string};
     if(!r.ok)throw Error(data.error||'Unable to start scan');
     setMessage('Scan started. New results will appear when it completes.');
     await load(true);
   }catch(e){setError(String(e));}finally{setBusy('');}
 }
 const newest=result.matches.filter(m=>m.state==='new').length;
 const saved=result.matches.filter(m=>m.state==='saved').length;
 const explore=result.matches.filter(m=>m.state==='new'&&m.score<65).length;
 return <section className="matches-screen">
  <div className="matches-head">
   <div><h2>Job matches</h2><p>Private, ranked vacancies from approved public job feeds, plus selected matches from your ChatGPT search.</p></div>
   <button type="button" className="matches-primary" onClick={()=>void trigger()} disabled={busy!==''||result.scan?.status==='running'}>
    {result.scan?.status==='running'?'Scanning…':'Run scan now'}
   </button>
  </div>
  <div className="matches-summary">
    <div><small>TO REVIEW</small><strong>{newest}</strong></div>
    <div><small>EXPLORE (WEAKER FIT)</small><strong>{explore}</strong></div>
    <div><small>LAST SCAN</small><strong className="matches-scan-time">{showDate(result.scan?.finished||result.scan?.started)}</strong></div>
    <div><small>SCAN FREQUENCY</small><strong className="matches-scan-time">Mon · Wed · Fri</strong></div>
  </div>
  <div className="matches-status">
   <div><strong>Automated schedule:</strong> Monday, Wednesday and Friday around 8:00 AM London time, plus an on-demand scan.</div>
   <div>{result.scan?<>Last attempt: <strong>{result.scan.status}</strong> · {result.scan.added} newly found · {result.scan.reviewed} matched</>:'Awaiting first feed scan; imported ChatGPT recommendations are available below.'}</div>
   {result.scan?.details&&<div className="matches-scan-error">Source issue: {result.scan.details}</div>}
   <p>Matching is automated; employer eligibility, posting status and fully remote arrangements need checking before applying. Sources: <a href="https://himalayas.app" target="_blank" rel="noreferrer">Himalayas</a>, <a href="https://remotive.com" target="_blank" rel="noreferrer">Remotive</a> and <a href="https://jobicy.com" target="_blank" rel="noreferrer">Jobicy</a>. Your previous ChatGPT recommendations are a separate one-time import.</p>
  </div>
  {error&&<p className="jobs-error" role="alert">{error}</p>}
  {message&&<p className="jobs-notice" role="status">{message}</p>}
  <div className="matches-filters">
    <div className="matches-tabs">
     {(['new','saved','all'] as const).map(value=><button type="button" key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>
       {value==='new'?'To review':value==='saved'?'Saved':'All'} {value==='new'?newest:value==='saved'?saved:result.matches.length}
     </button>)}
    </div>
    <label>Relevance<select value={quality} onChange={e=>setQuality(e.target.value as typeof quality)}>
      <option value="all">All relevant roles</option><option value="strong">Strong fit (80+)</option>
      <option value="possible">Possible (65–79)</option><option value="explore">Explore / lower fit (under 65)</option>
    </select></label>
    <label>Hours<select value={hours} onChange={e=>setHours(e.target.value as typeof hours)}>
      <option value="all">Any hours</option><option value="part">Part-time / flexible</option><option value="other">Other / not stated</option>
    </select></label>
    <label>Search<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Company, skill, title…"/></label>
  </div>
  {loading?<p className="jobs-empty">Loading matches…</p>:matches.length===0?<div className="jobs-empty">
    <h3>No matching vacancies</h3><p>Try clearing your filters or run a fresh scan. The board will not invent jobs when sources return none.</p>
  </div>:<div className="matches-list">{matches.map(m=><article key={m.key} className="matches-card">
   <div className="matches-card-details">
     <div className="matches-tags"><span className={"matches-score "+(m.score<65?"matches-score-low":"")}>{m.score>=80?"Strong":m.score>=65?"Possible":"Explore"} · Fit {m.score}/100</span><span>{m.hours||m.employment_type||'Hours not stated'}</span><span>{m.location||'Remote — location check needed'}</span></div>
     <small className="matches-company">{m.company}</small>
     <h3>{m.title}</h3>
     <p className="matches-reason">{m.reason}</p>
     <div className="matches-warning">{m.score<65&&<strong>Lower match — possibly unsuitable for your hours or experience. </strong>}Check before applying: {m.warning}</div>
     <div className="matches-meta">{m.salary&&<span>{m.salary}</span>}<span>{m.source}</span>{m.posted&&<span>Published {m.posted}</span>}</div>
   </div>
   <div className="matches-card-actions">
     {m.state==='saved'?<span className="matches-saved">Already saved</span>:<button type="button" className="matches-primary" disabled={busy!==''} onClick={()=>void action(m.key,'save')}>{busy===m.key?'Saving…':'Save to applications'}</button>}
     <a href={m.apply_url} target="_blank" rel="noopener noreferrer">View original vacancy ↗</a>
     {m.state==='new'&&<button type="button" disabled={busy!==''} onClick={()=>void action(m.key,'dismiss')}>Not relevant</button>}
   </div>
  </article>)}</div>}
  <p className="matches-footer">This screen is private and doesn't automatically apply to roles. Your separate ChatGPT job-search report continues on its existing schedule; the website scanner has its own supported-source coverage.</p>
 </section>;
}
