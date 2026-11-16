import {useEffect, useMemo, useState} from 'react';
import '../styles/project-portfolio.css';

type Status='backlog'|'active'|'waiting'|'done'|'parked';
type Priority='P0'|'P1'|'P2'|'P3'|'P4';
type Step={id:string;text:string;done:boolean;due_date:string};
type Data={
 title:string;category:string;board_id:string;priority:Priority;status:Status;
 hours_low:number;hours_high:number;cost_low:number;cost_high:number;
 due_date:string;benefit:string;next_step:string;later:string;notes:string;checklist:Step[]
};
type Project=Data&{id:number;revision:number;created_at:string;updated_at:string};
type Tab={id:string;name:string};
type TabsState={revision:number;tabs:Tab[]};
const fresh:Data={title:'',category:'Commercial',board_id:'other',priority:'P2',status:'backlog',
 hours_low:0,hours_high:0,cost_low:0,cost_high:0,due_date:'',
 benefit:'',next_step:'',later:'',notes:'',checklist:[]};
const stages:Record<Status,string>={backlog:'Queued',active:'In progress',waiting:'Waiting',done:'Completed',parked:'Parked'};
const defaults=['Commercial','Income','Software','Privacy','Infrastructure','Research','Electronics','Creative'];
const currency=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const completed=(p:Project)=>p.checklist.filter(i=>i.done).length;
const progress=(p:Project)=>p.checklist.length?Math.round(100*completed(p)/p.checklist.length):0;
const shortDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const weekRange=(p:Project,h:number)=>(Math.ceil(p.hours_low/h*10)/10)+'–'+(Math.ceil(p.hours_high/h*10)/10)+' weeks';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const asData=(p:Project):Data=>({
 title:p.title,category:p.category,board_id:p.board_id,priority:p.priority,status:p.status,
 hours_low:p.hours_low,hours_high:p.hours_high,cost_low:p.cost_low,cost_high:p.cost_high,
 due_date:p.due_date,benefit:p.benefit,next_step:p.next_step,later:p.later,notes:p.notes,
 checklist:p.checklist.map(s=>({...s}))
});
export function ProjectPortfolio({csrf}:{csrf:string}){
 const [items,setItems]=useState<Project[]>([]);
 const [load,setLoad]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all');
 const [priority,setPriority]=useState('all'),[stage,setStage]=useState('all');
 const [selected,setSelected]=useState<number|null>(null);
 const [tabs,setTabs]=useState<TabsState>({revision:1,tabs:[]});
 const [activeTab,setActiveTab]=useState('lopt');
 const [view,setView]=useState<'board'|'list'>('board');
 const [manageTabs,setManageTabs]=useState(false);
 const [tabDraft,setTabDraft]=useState<Tab[]>([]);
 const [dragTab,setDragTab]=useState<string|null>(null);
 const [dragProject,setDragProject]=useState<number|null>(null);
 const [editor,setEditor]=useState<{item:Project|null;form:Data}|null>(null);
 const [stepText,setStepText]=useState(''),[stepDue,setStepDue]=useState('');
 const [stepEditor,setStepEditor]=useState<{id:string;text:string;due_date:string}|null>(null);
 const project=items.find(p=>p.id===selected)||null;
 const categories=useMemo(()=>Array.from(new Set([...defaults,...items.map(p=>p.category)])).sort(),[items]);
 const visible=useMemo(()=>items.filter(p=>{
  if(activeTab!=='all'&&p.board_id!==activeTab)return false;
  if(category!=='all'&&p.category!==category)return false;
  if(priority!=='all'&&p.priority!==priority)return false;
  if(stage!=='all'&&p.status!==stage)return false;
  return [p.title,p.category,p.benefit,p.next_step,p.notes].join(' ').toLowerCase().includes(query.trim().toLowerCase());
 }).sort((a,b)=>a.priority.localeCompare(b.priority)||a.title.localeCompare(b.title)),[items,activeTab,query,category,priority,stage]);
 async function refreshTabs(){
  const r=await fetch('/admin/api/project-tabs',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw Error('Could not load project tabs.');
  const data=await r.json() as TabsState;
  setTabs(data);
  setActiveTab(current=>current==='all'||data.tabs.some(t=>t.id===current)?current:(data.tabs[0]?.id||'all'));
 }
 async function refresh(){
  const r=await fetch('/admin/api/projects',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw Error('Could not load private projects.');
  const data=await r.json() as {projects:Project[]};
  setItems(data.projects);
 }
 useEffect(()=>{void Promise.all([refresh(),refreshTabs()]).catch(e=>setError(String(e))).finally(()=>setLoad(false));},[]);
 async function call(path:string,method:string,body:unknown){
  const r=await fetch(path,{method,credentials:'same-origin',headers:{
    'Content-Type':'application/json','X-CSRF-Token':csrf
  },body:JSON.stringify(body)});
  if(!r.ok){const v=await r.json().catch(()=>({error:'Request failed'})) as {error?:string};
    throw Error(v.error||'Unable to save changes.');}
  return r.status===204?null:r.json();
 }
 async function run(fn:()=>Promise<void>){
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{await fn();await refresh();}
  catch(e){setError(String(e));}
  finally{setBusy(false);}
 }
 async function save(){
  if(!editor||!editor.form.title.trim())return;
  const {item,form}=editor;
  await run(async()=>{
   if(item)await call('/admin/api/projects/'+item.id,'PUT',{revision:item.revision,project:form});
   else await call('/admin/api/projects','POST',form);
   setEditor(null);setNotice(item?'Project updated.':'Project added.');
  });
 }
 function edit(p:Project|null){
  setEditor({item:p,form:p?asData(p):{...fresh,board_id:activeTab==='all'?'other':activeTab,checklist:[]}});
  setError('');
 }
 async function update(p:Project,data:Data){
  await run(async()=>{await call('/admin/api/projects/'+p.id,'PUT',{revision:p.revision,project:data});});
 }
 async function addStep(p:Project){
  const t=stepText.trim();if(!t)return;
  if(p.checklist.length>=80){setError('Each project supports up to 80 steps.');return;}
  const next=[...p.checklist,{id:'step_'+Math.random().toString(36).slice(2,16),text:t,done:false,due_date:stepDue}];
  await update(p,{...asData(p),checklist:next});
  setStepText('');setStepDue('');
 }
 async function removeProject(p:Project){
  if(!window.confirm('Permanently delete '+p.title+' and its checklist?'))return;
  await run(async()=>{
    await call('/admin/api/projects/'+p.id,'DELETE',{revision:p.revision});
    setSelected(null);setNotice('Project deleted.');
  });
 }
 async function restoreStarter(){
  if(!window.confirm('Restore missing projects from the 2026 plan? Existing edits remain untouched.'))return;
  await run(async()=>{
    const r=await call('/admin/api/projects/import-starter','POST',{}) as {added:number};
    setNotice('Restored '+r.added+' missing projects; existing projects were not overwritten.');
  });
 }
 async function saveTabs(){
  await run(async()=>{
   const data=await call('/admin/api/project-tabs','PUT',{revision:tabs.revision,tabs:tabDraft}) as TabsState;
   setTabs(data);setManageTabs(false);
   if(activeTab!=='all'&&!data.tabs.some(t=>t.id===activeTab))setActiveTab('all');
   setNotice('Tabs saved and reordered.');
  });
 }
 function startManageTabs(){setTabDraft(tabs.tabs.map(t=>({...t})));setManageTabs(true);setError('');}
 function addTab(){
  if(tabDraft.length>=40){setError('A maximum of 40 tabs is supported.');return;}
  setTabDraft(v=>[...v,{id:'tab_'+Math.random().toString(36).slice(2,12),name:'New tab'}]);
 }
 function moveTab(from:number,to:number){
  if(to<0||to>=tabDraft.length||from===to)return;
  setTabDraft(v=>{const copy=[...v];const [moved]=copy.splice(from,1);copy.splice(to,0,moved);return copy;});
 }
 async function dropProject(id:number,status:Status){
  const p=items.find(x=>x.id===id);setDragProject(null);
  if(p&&p.status!==status)await update(p,{...asData(p),status});
 }
 function exportBackup(){
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),projects:items,tabs},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='ryan-projects-backup.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="portfolio-screen">
  <div className="portfolio-header">
   <div><span className="portfolio-kicker">NOVEMBER 2026 MASTER PLAN</span><h2>Projects</h2>
    <p>Commercial, coding and fun projects in one private, editable portfolio.</p></div>
   <div className="portfolio-actions"><a href="/admin/tasks" className="portfolio-secondary">Day-to-day tasks</a>
    <button type="button" className="portfolio-primary" onClick={()=>edit(null)}>+ New project</button></div>
  </div>
  <div className="portfolio-metrics">
   <div><strong>{items.length}</strong><span>Total projects</span></div>
   <div><strong>{items.filter(p=>p.status==='active').length}</strong><span>In progress</span></div>
   <div><strong>{items.filter(p=>p.status==='done').length}</strong><span>Finished</span></div>
   <div><strong>{items.reduce((n,p)=>n+completed(p),0)}</strong><span>Completed steps</span></div>
  </div>
  <div className="portfolio-cap"><strong>Weekly planning limit: 70 hours across all projects.</strong> Hour estimates below are for the next deliverable, not for indefinitely finishing a business. P0 means immediate, P4 means intentionally deferred.</div>
  {error&&<p className="portfolio-error" role="alert">{error}</p>}
  {notice&&<p className="portfolio-success" role="status">{notice}</p>}
  <div className="portfolio-workstream-nav" aria-label="Project workstream tabs">
   <div className="portfolio-tabs" role="tablist" aria-label="Workstreams">
    <button type="button" role="tab" aria-selected={activeTab==='all'} className={'portfolio-tab'+(activeTab==='all'?' is-active':'')} onClick={()=>{setActiveTab('all');setSelected(null)}}>All projects <span>{items.length}</span></button>
    {tabs.tabs.map(t=><button key={t.id} type="button" role="tab" aria-selected={activeTab===t.id}
      className={'portfolio-tab'+(activeTab===t.id?' is-active':'')} onClick={()=>{setActiveTab(t.id);setSelected(null)}}>
      {t.name} <span>{items.filter(p=>p.board_id===t.id).length}</span>
    </button>)}
   </div>
   <button type="button" className="portfolio-tab-manage" onClick={startManageTabs} title="Add, rename, delete or reorder workstream tabs">⚙ Manage tabs</button>
  </div>
  <div className="portfolio-board-toolbar">
   <div><strong>{activeTab==='all'?'All projects':tabs.tabs.find(t=>t.id===activeTab)?.name||'Workstream'}</strong><small>Drag project cards between columns, or open a card to edit its details.</small></div>
   <div className="portfolio-view-switch" role="group" aria-label="Project display mode">
    <button type="button" aria-pressed={view==='board'} className={view==='board'?'active':''} onClick={()=>setView('board')}>▦ Board</button>
    <button type="button" aria-pressed={view==='list'} className={view==='list'?'active':''} onClick={()=>setView('list')}>☷ List</button>
   </div>
  </div>
  <div className="portfolio-filters">
   <label>Search<input type="search" placeholder="Project name, benefit, note…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">All priorities</option>{['P0','P1','P2','P3','P4'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label>Status<select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">All statuses</option>{(Object.keys(stages) as Status[]).map(s=><option key={s} value={s}>{stages[s]}</option>)}</select></label>
  </div>
  {load?<p>Loading projects…</p>:<div className={'portfolio-body'+(view==='board'?' portfolio-board-mode':'')}>
    {view==='board'?<div className="portfolio-kanban" aria-label="Project status board">
     {(Object.keys(stages) as Status[]).map(status=><section key={status} className="portfolio-kanban-column"
       aria-label={stages[status]} onDragOver={e=>e.preventDefault()}
       onDrop={e=>{e.preventDefault();if(dragProject!==null)void dropProject(dragProject,status);}}>
      <header><strong>{stages[status]}</strong><span>{visible.filter(p=>p.status===status).length}</span></header>
      <div className="portfolio-kanban-stack">
      {visible.filter(p=>p.status===status).map(p=><button type="button" key={p.id} draggable={!busy}
        className={'portfolio-kanban-card'+(p.id===selected?' selected':'')}
        onDragStart={e=>{setDragProject(p.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(p.id));}}
        onDragEnd={()=>setDragProject(null)}
        onClick={()=>{setSelected(p.id);setStepEditor(null);}}>
       <div className="portfolio-kanban-label"><em className={'portfolio-prio '+p.priority}>{p.priority}</em><span>{p.category}</span></div>
       <strong>{p.title}</strong>
       <span className="portfolio-kanban-meta">
        {p.due_date&&<span className={p.due_date<today()&&p.status!=='done'?'portfolio-late':''}>◷ {shortDate(p.due_date)}</span>}
        <span>☑ {completed(p)}/{p.checklist.length}</span>
       </span>
       <span className="portfolio-progress"><span style={{width:progress(p)+'%'}}/></span>
      </button>)}
      {visible.every(p=>p.status!==status)&&<p className="portfolio-kanban-empty">Drop a card here</p>}
      </div>
      <button type="button" className="portfolio-kanban-add" onClick={()=>{edit(null);setEditor(v=>v?{...v,form:{...v.form,status}}:v)}}>+ Add project</button>
     </section>)}
    </div>:<>    <div className="portfolio-list" aria-label="Project list">
     {visible.length===0?<p>No matching projects.</p>:visible.map(p=><button type="button" key={p.id}
       className={'portfolio-list-item'+(p.id===selected?' current':'')} onClick={()=>{setSelected(p.id);setStepEditor(null);}}>
       <span className="portfolio-list-top"><strong>{p.title}</strong><em className={'portfolio-prio '+p.priority}>{p.priority}</em></span>
       <span className="portfolio-sub"><span>{p.category}</span><span>{stages[p.status]}</span><span>{p.hours_low}–{p.hours_high}h</span></span>
       <span className="portfolio-progress"><span style={{width:progress(p)+'%'}}/></span>
       <span className="portfolio-list-bottom">{completed(p)}/{p.checklist.length} steps{p.due_date?' · Due '+shortDate(p.due_date):''}</span>
      </button>)}
    </div>
</>}
    <article className="portfolio-detail">
     {!project?<div className="portfolio-placeholder"><h3>Your master project portfolio</h3><p>Select a project on the left to see its milestones, cash requirement, hours, deadline and checklists. Every field can be edited.</p><p>All 46 November plan projects were imported on first visit; future projects can be added without code changes.</p></div>:<>
      <div className="portfolio-detail-title"><div><span className="portfolio-kicker">{project.priority} · {project.category} · {tabs.tabs.find(t=>t.id===project.board_id)?.name||'Other'}</span><h3>{project.title}</h3><p>{stages[project.status]}</p></div><button type="button" className="portfolio-secondary" onClick={()=>edit(project)}>Edit project</button></div>
      <div className="portfolio-mini-metrics"><div><small>Remaining estimate</small><strong>{project.hours_low}–{project.hours_high}h</strong></div><div><small>Initial added cost</small><strong>{currency(project.cost_low)}–{currency(project.cost_high)}</strong></div><div><small>Deadline</small><strong>{project.due_date?shortDate(project.due_date):'Not set'}</strong></div></div>
      <details className="portfolio-hours"><summary>Timeframes at 5, 10, 20 or 40 hours/week</summary>
       <div className="portfolio-hours-grid">{[5,10,20,40].map(h=><div key={h}><strong>{h}h/week</strong><span>{weekRange(project,h)}</span></div>)}</div>
       <small>Only valid if that time is actually allocated to this one project. External waiting can make calendar duration longer.</small>
      </details>
      {project.next_step&&<div className="portfolio-info"><h4>Next milestone</h4><p>{project.next_step}</p></div>}
      {project.benefit&&<div className="portfolio-info"><h4>First useful benefit</h4><p>{project.benefit}</p></div>}
      {project.later&&<div className="portfolio-info"><h4>Speculative improvements / later</h4><p>{project.later}</p></div>}
      {project.notes&&<div className="portfolio-info"><h4>Notes and dependencies</h4><p>{project.notes}</p></div>}
      <div className="portfolio-check-heading"><h4>Checklist</h4><strong>{progress(project)}%</strong></div>
      <span className="portfolio-progress large"><span style={{width:progress(project)+'%'}}/></span>
      <ul className="portfolio-checks">{project.checklist.map(step=><li key={step.id}>
       {stepEditor?.id===step.id?<form className="portfolio-step-edit" onSubmit={e=>{e.preventDefault();if(!stepEditor.text.trim())return;
         void update(project,{...asData(project),checklist:project.checklist.map(x=>x.id===step.id?{...x,text:stepEditor.text.trim(),due_date:stepEditor.due_date}:x)}).then(()=>setStepEditor(null));}}>
         <input aria-label="Step text" maxLength={300} value={stepEditor.text} required onChange={e=>setStepEditor(v=>v?{...v,text:e.target.value}:v)}/>
         <input aria-label="Step deadline" type="date" value={stepEditor.due_date} onChange={e=>setStepEditor(v=>v?{...v,due_date:e.target.value}:v)}/>
         <button disabled={busy} type="submit">Save</button><button type="button" onClick={()=>setStepEditor(null)}>Cancel</button>
       </form>:<>
        <label><input type="checkbox" checked={step.done} disabled={busy} onChange={()=>void update(project,{...asData(project),checklist:project.checklist.map(x=>x.id===step.id?{...x,done:!x.done}:x)})}/>
         <span className={step.done?'portfolio-struck':''}>{step.text}{step.due_date&&<small className={step.due_date<today()&&!step.done?'portfolio-late':''}>Due {shortDate(step.due_date)}</small>}</span></label>
        <div className="portfolio-step-buttons"><button type="button" title="Edit step and date" disabled={busy} onClick={()=>setStepEditor({id:step.id,text:step.text,due_date:step.due_date||''})}>Edit</button>
         <button type="button" title="Remove step" disabled={busy} onClick={()=>void update(project,{...asData(project),checklist:project.checklist.filter(x=>x.id!==step.id)})}>×</button></div>
       </>}</li>)}</ul>
      <form className="portfolio-add-step" onSubmit={e=>{e.preventDefault();void addStep(project);}}>
       <label>New checklist item<input placeholder="What needs doing?" maxLength={300} required value={stepText} onChange={e=>setStepText(e.target.value)}/></label>
       <label>Optional deadline<input aria-label="Checklist deadline" type="date" value={stepDue} onChange={e=>setStepDue(e.target.value)}/></label>
       <button type="submit" className="portfolio-primary" disabled={busy||!stepText.trim()}>Add step</button>
      </form>
      <div className="portfolio-board-card-actions">
       <label>Move to tab <select disabled={busy} value={project.board_id} onChange={e=>void update(project,{...asData(project),board_id:e.target.value}).then(()=>setSelected(null))}>
        {tabs.tabs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
       </select></label>
       <label>Move to column <select disabled={busy} value={project.status} onChange={e=>void update(project,{...asData(project),status:e.target.value as Status})}>
        {(Object.keys(stages) as Status[]).map(key=><option key={key} value={key}>{stages[key]}</option>)}
       </select></label>
      </div>
      <footer className="portfolio-detail-footer"><button type="button" className="portfolio-danger" disabled={busy} onClick={()=>void removeProject(project)}>Delete project</button><small>Updated {new Date(project.updated_at).toLocaleDateString('en-GB')}</small></footer>
     </>}
    </article>
   </div>}
   <footer className="portfolio-page-footer"><button type="button" disabled={busy} onClick={restoreStarter}>Restore missing November plan projects</button><button type="button" onClick={exportBackup} disabled={!items.length}>Export private JSON backup</button><span>Project records are stored on your private server, not on the public website.</span></footer>
  {editor&&<div className="portfolio-modal-bg" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditor(null);}}>
   <form className="portfolio-modal" onSubmit={e=>{e.preventDefault();void save();}}>
    <header><h3>{editor.item?'Edit project':'Add project'}</h3><p>Manage all of these fields without changing code.</p></header>
    <label>Project title<input autoFocus required maxLength={180} value={editor.form.title} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,title:e.target.value}}:v)}/></label>
    <div className="portfolio-form-grid">
     <label>Workstream tab<select value={editor.form.board_id} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,board_id:e.target.value}}:v)}>
      {tabs.tabs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
     </select></label>
     <label>Category<input list="portfolio-category-list" required maxLength={60} value={editor.form.category} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,category:e.target.value}}:v)}/><datalist id="portfolio-category-list">{categories.map(c=><option key={c} value={c}/>)}</datalist></label>
     <label>Priority<select value={editor.form.priority} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,priority:e.target.value as Priority}}:v)}>{['P0','P1','P2','P3','P4'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label>Status<select value={editor.form.status} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,status:e.target.value as Status}}:v)}>{(Object.keys(stages) as Status[]).map(s=><option key={s} value={s}>{stages[s]}</option>)}</select></label>
     <label>Project deadline<input type="date" value={editor.form.due_date} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,due_date:e.target.value}}:v)}/></label>
     {(['hours_low','hours_high','cost_low','cost_high'] as const).map(field=><label key={field}>{({hours_low:'Minimum hours',hours_high:'Maximum hours',cost_low:'Minimum cost (£)',cost_high:'Maximum cost (£)'})[field]}<input type="number" required min="0" max="1000000" step="1" value={editor.form[field]} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,[field]:Math.max(0,Math.round(Number(e.target.value)||0))}}:v)}/></label>)}
    </div>
    {(['next_step','benefit','later','notes'] as const).map(field=><label key={field}>{({next_step:'Next achievable milestone',benefit:'First useful benefit',later:'Later improvements',notes:'Notes, links and dependencies'})[field]}
     <textarea rows={field==='notes'?4:2} maxLength={field==='notes'?8000:field==='benefit'?650:1000} value={editor.form[field]} onChange={e=>setEditor(v=>v?{...v,form:{...v.form,[field]:e.target.value}}:v)}/></label>)}
    {editor.item&&<p className="portfolio-modal-note">To edit checklist items and their deadlines, save and use the project detail view. Existing checklist progress will be preserved.</p>}
    <div className="portfolio-modal-actions"><button type="button" disabled={busy} onClick={()=>setEditor(null)}>Cancel</button><button type="submit" disabled={busy} className="portfolio-primary">{busy?'Saving…':'Save project'}</button></div>
   </form>
  </div>}
 </section>;
}
