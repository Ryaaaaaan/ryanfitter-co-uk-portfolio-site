import {useEffect,useMemo,useState} from 'react';
import '../styles/job-matches.css';

type Match={
 key:string;company:string;title:string;apply_url:string;source:string;
 hours:string;employment_type:string;location:string;salary:string;score:number;
 reason:string;warning:string;confidence:string;posted:string;state:string;
 first_seen:string;last_seen:string;role_tags?:string[];seniority?:string;
 cv_score?:number;lifestyle_score?:number;fit_evidence?:string[];
 remote_status?:string;hours_fit?:string;support_signals?:string[];score_basis?:string;
};
type SourceHealth={name:string;status:string;matched:number;detail?:string};
type Scan={
 id:number;started:string;finished:string|null;status:string;
 added:number;reviewed:number;existing?:number;saved_seen?:number;
 details:string;sources?:SourceHealth[];
};
type ScanResponse={
 matches:Match[];scan:Scan|null;history?:Scan[];
 total_saved?:number;total_dismissed?:number;
};
type Tab='new'|'saved'|'all';
type Sort='overall'|'cv'|'lifestyle'|'newest'|'company';
const empty:ScanResponse={matches:[],scan:null,history:[]};
const dateLabel=(value:string|null|undefined)=>value?new Date(value).toLocaleString('en-GB',{
 day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'
}):'Not yet scanned';
const shortLabel=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString('en-GB',{
 day:'numeric',month:'short'
}):'Unknown';

function Score({label,value,secondary=false}:{label:string;value:number;secondary?:boolean}){
 return <span className={'matches-score-chip'+(secondary?' matches-score-secondary':'')}>{label}: <strong>{value}/100</strong></span>;
}
export function JobMatches({csrf}:{csrf:string}){
 const [result,setResult]=useState<ScanResponse>(empty);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [query,setQuery]=useState(''),[tab,setTab]=useState<Tab>('new');
 const [hours,setHours]=useState<'all'|'good'|'other'>('all');
 const [role,setRole]=useState('all'),[seniority,setSeniority]=useState('all');
 const [sort,setSort]=useState<Sort>('overall');
 const [healthOpen,setHealthOpen]=useState(false);
 async function load(silent=false){
   if(!silent)setLoading(true);
   try{
     const r=await fetch('/admin/api/job-matches',{cache:'no-store'});
     if(!r.ok)throw Error('Could not load private job matches. Sign in again if your session has expired.');
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
 const roles=useMemo(()=>Array.from(new Set(result.matches.flatMap(m=>m.role_tags||[]))).sort(),[result.matches]);
 const seniorities=useMemo(()=>Array.from(new Set(result.matches.map(m=>m.seniority||'Not stated'))).sort(),[result.matches]);
 const matches=useMemo(()=>{
   const filtered=result.matches.filter(m=>{
     if(tab!=='all'&&m.state!==tab)return false;
     if(role!=='all'&&!(m.role_tags||[]).includes(role))return false;
     if(seniority!=='all'&&(m.seniority||'Not stated')!==seniority)return false;
     const hoursText=(m.hours+' '+m.employment_type+' '+(m.hours_fit||'')).toLowerCase();
     const flexible=/part.time|freelance|10–|15–|20–|25–|30\s*hour|hours within 30|hours range crosses 30|contract/i.test(hoursText);
     if(hours==='good'&&!flexible)return false;
     if(hours==='other'&&flexible)return false;
     const haystack=[m.company,m.title,m.reason,m.source,m.location,m.employment_type,
       m.seniority||'',...(m.role_tags||[])].join(' ').toLowerCase();
     return haystack.includes(query.trim().toLowerCase());
   });
   return filtered.sort((a,b)=>{
     if(sort==='company')return a.company.localeCompare(b.company);
     if(sort==='newest')return b.first_seen.localeCompare(a.first_seen);
     const get=(m:Match)=>sort==='cv'?m.cv_score??0:sort==='lifestyle'?m.lifestyle_score??0:m.score||0;
     return get(b)-get(a)||b.first_seen.localeCompare(a.first_seen);
   });
 },[result.matches,tab,hours,role,seniority,sort,query]);
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
     setMessage(name==='save'?'Saved to Applications. You can update its stage and notes there.':'Match dismissed. It will not appear in future scan results.');
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
     setMessage('Scan started. New results and source health will appear when it completes.');
     await load(true);
   }catch(e){setError(String(e));}finally{setBusy('');}
 }
 const newest=result.matches.filter(m=>m.state==='new').length;
 const saved=result.matches.filter(m=>m.state==='saved').length;
 const latest=result.scan;
 const errors=(latest?.sources||[]).filter(s=>s.status==='failed');
 const status=latest?.status==='success'?'Healthy':latest?.status==='partial'?'Partial results':
  latest?.status==='failed'?'Failed':latest?.status==='running'?'Running':'Not yet scanned';
 const strong=result.matches.filter(m=>m.state==='new'&&(m.score||0)>=75).length;
 return <section className="matches-screen">
  <div className="matches-head">
   <div><h2>Job matches</h2><p>A broader opportunity board, ranked against your CV and preferred working arrangements. All scores are estimates, not verified suitability.</p></div>
   <button type="button" className="matches-primary" onClick={()=>void trigger()} disabled={busy!==''||latest?.status==='running'}>
    {latest?.status==='running'?'Scanning…':'Run scan now'}
   </button>
  </div>
  <div className="matches-summary">
    <div><small>TO REVIEW</small><strong>{newest}</strong></div>
    <div><small>STRONG OVERALL (75+)</small><strong>{strong}</strong></div>
    <div><small>LAST SCAN</small><strong className="matches-scan-time">{dateLabel(latest?.finished||latest?.started)}</strong></div>
    <div><small>SCAN HEALTH</small><strong className="matches-scan-time">{status}</strong></div>
  </div>
  <div className="matches-status">
   <div className="matches-status-head"><div><strong>Automatic scans:</strong> Monday · Wednesday · Friday, approximately 8 AM UK time, plus manual scans.</div>
     <button type="button" aria-expanded={healthOpen} onClick={()=>setHealthOpen(!healthOpen)}>{healthOpen?'Hide scan health':'View scan health & history'}</button>
   </div>
   <div>{latest?<>Most recent: <strong>{latest.status}</strong> · {latest.reviewed} distinct matches · {latest.added} new · {latest.existing??'—'} already known · {latest.saved_seen??'—'} already saved</>:'No feed scan recorded yet.'}</div>
   {latest?.details&&<div className="matches-scan-error">Source issues: {latest.details}</div>}
   <p>Currently using Himalayas, Remotive and Jobicy. Reed and Adzuna can be enabled with developer API credentials. Indeed requires authorised partner access. Sources may disagree about remote status; check original vacancy details.</p>
  </div>
  {healthOpen&&<section className="matches-health-panel" aria-label="Scan health and history">
    <div className="matches-health-heading"><h3>Scan health</h3><p>Per-source checks and previous runs. Counts are deduplicated matches, not raw vacancies crawled.</p></div>
    <div className="matches-health-stats">
      <div><small>Matches this run</small><strong>{latest?.reviewed??'—'}</strong></div>
      <div><small>New this run</small><strong>{latest?.added??'—'}</strong></div>
      <div><small>Already known</small><strong>{latest?.existing??'—'}</strong></div>
      <div><small>Already saved this run</small><strong>{latest?.saved_seen??'—'}</strong></div>
      <div><small>Saved in dashboard</small><strong>{result.total_saved??saved}</strong></div>
      <div><small>Dismissed in dashboard</small><strong>{result.total_dismissed??'—'}</strong></div>
    </div>
    <h4>Sources</h4>
    <div className="matches-health-sources">
      {(latest?.sources?.length?latest.sources:[
        {name:'Himalayas',status:'not yet reported',matched:0},
        {name:'Remotive',status:'not yet reported',matched:0},
        {name:'Jobicy',status:'not yet reported',matched:0},
        {name:'Reed',status:'requires API credentials',matched:0},
        {name:'Adzuna',status:'requires API credentials',matched:0}
      ]).map(s=><div key={s.name} className="matches-health-source">
        <strong>{s.name}</strong><span className={'matches-health-status '+s.status}>{s.status.replace(/_/g,' ')}</span>
        <span>{s.status==='success'?s.matched+' matching results':'—'}</span>
        {s.detail&&<small>{s.detail}</small>}
      </div>)}
    </div>
    <h4>Recent scans</h4>
    <div className="matches-history-wrap">
     <table className="matches-history"><thead><tr><th>When</th><th>Result</th><th>Matched</th><th>New</th><th>Known</th><th>Saved</th></tr></thead>
     <tbody>{(result.history||[]).map(r=><tr key={r.id}><td>{dateLabel(r.finished||r.started)}</td><td>{r.status}</td><td>{r.reviewed}</td><td>{r.added}</td><td>{r.existing??'—'}</td><td>{r.saved_seen??'—'}</td></tr>)}</tbody></table>
    </div>
    <p className="matches-health-footnote">A successful scan means the configured APIs responded, not that every listed job is still open or meets your circumstances. Job-board limits can reduce coverage.</p>
  </section>}
  {errors.length>0&&<p className="jobs-error" role="alert">{errors.length} job source{errors.length===1?'':'s'} had errors on the last scan. See scan health for details.</p>}
  {error&&<p className="jobs-error" role="alert">{error}</p>}
  {message&&<p className="jobs-notice" role="status">{message}</p>}
  <div className="matches-filters">
    <div className="matches-tabs">
     {(['new','saved','all'] as const).map(value=><button type="button" key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>
       {value==='new'?'To review':value==='saved'?'Saved':'All'} {value==='new'?newest:value==='saved'?saved:result.matches.length}
     </button>)}
    </div>
    <label>Sort by<select value={sort} onChange={e=>setSort(e.target.value as Sort)}>
      <option value="overall">Best overall match</option>
      <option value="cv">Strongest CV match</option>
      <option value="lifestyle">Best working arrangements</option>
      <option value="newest">Recently discovered</option>
      <option value="company">Company A–Z</option>
    </select></label>
    <label>Role focus<select value={role} onChange={e=>setRole(e.target.value)}>
      <option value="all">All role types</option>{roles.map(x=><option value={x} key={x}>{x}</option>)}
    </select></label>
    <label>Seniority<select value={seniority} onChange={e=>setSeniority(e.target.value)}>
      <option value="all">All levels</option>{seniorities.map(x=><option key={x} value={x}>{x}</option>)}
    </select></label>
    <label>Hours<select value={hours} onChange={e=>setHours(e.target.value as typeof hours)}>
      <option value="all">Any hours</option><option value="good">Part-time / flexible</option><option value="other">Other / not stated</option>
    </select></label>
    <label>Search<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Company, skill, title…"/></label>
  </div>
  <div className="matches-results-heading"><strong>{matches.length} opportunities</strong><span>Sort changes the order; filters reduce the list.</span></div>
  {loading?<p className="jobs-empty">Loading matches…</p>:matches.length===0?<div className="jobs-empty">
    <h3>No matching vacancies</h3><p>Try another filter or run a fresh scan. The board will not invent jobs when sources return none.</p>
  </div>:<div className="matches-list">{matches.map(m=><article key={m.key} className="matches-card">
   <div className="matches-card-details">
     <div className="matches-tags">
       <Score label="Overall" value={m.score||0}/><Score label="CV" value={m.cv_score??0} secondary/><Score label="Working fit" value={m.lifestyle_score??0} secondary/>
       {m.hours&&<span>{m.hours}</span>}{m.location&&<span>{m.location}</span>}
     </div>
     <small className="matches-company">{m.company}</small>
     <h3>{m.title}</h3>
     <div className="matches-role-tags">{(m.role_tags||[]).map(t=><span key={t}>{t}</span>)}<span className="matches-seniority">{m.seniority||'Seniority not stated'}</span></div>
     <p className="matches-reason">{m.reason}</p>
     <div className="matches-fit-details">
       <span><strong>Work pattern:</strong> {m.remote_status||'Unconfirmed'}</span>
       <span><strong>Hours:</strong> {m.hours_fit||'Not specified'}</span>
       {(m.support_signals||[]).map(x=><span key={x} className="matches-support-signal">{x}</span>)}
     </div>
     <details className="matches-explanation"><summary>How was this match scored?</summary>
       <p>Based on your CV and the available job title/specification. It's a transparent, rules-based estimate, not an AI review or verification by the employer.</p>
       <ul>{(m.fit_evidence||[]).map((e,i)=><li key={i}>{e}</li>)}</ul>
     </details>
     <div className="matches-warning">Check before applying: {m.warning}</div>
     <div className="matches-meta">{m.salary&&<span>{m.salary}</span>}<span>{m.source}</span>{m.posted&&<span>Published {shortLabel(m.posted)}</span>}</div>
   </div>
   <div className="matches-card-actions">
     {m.state==='saved'?<span className="matches-saved">Already saved</span>:<button type="button" className="matches-primary" disabled={busy!==''} onClick={()=>void action(m.key,'save')}>{busy===m.key?'Saving…':'Save to applications'}</button>}
     <a href={m.apply_url} target="_blank" rel="noopener noreferrer">View original vacancy ↗</a>
     {m.state==='new'&&<button type="button" disabled={busy!==''} onClick={()=>void action(m.key,'dismiss')}>Not relevant</button>}
   </div>
  </article>)}</div>}
  <p className="matches-footer">The website scanner runs via GitHub Actions + AWS—not GPT Work. Your separate ChatGPT job-search automation runs independently. Indeed isn't scraped; Reed and Adzuna require configured developer credentials. Review employer eligibility, hours and travel terms before applying.</p>
 </section>;
}
