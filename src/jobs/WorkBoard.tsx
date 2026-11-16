import {useEffect,useMemo,useState} from 'react';
import '../styles/work-board.css';

type Status='todo'|'in_progress'|'blocked'|'done';
type Priority='low'|'normal'|'high';
type TaskData={title:string;project:string;notes:string;due_date:string;status:Status;priority:Priority};
type Task=TaskData&{id:number;revision:number;created_at:string;updated_at:string};
const defaultTask:TaskData={title:'',project:'Personal',notes:'',due_date:'',status:'todo',priority:'normal'};
const stages:{key:Status;name:string}[]=[
 {key:'todo',name:'To do'},{key:'in_progress',name:'In progress'},
 {key:'blocked',name:'Waiting / blocked'},{key:'done',name:'Done'}
];
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const dixyProject='Dixy takeaway website';
const dixyTasks:TaskData[]=[
 {title:'Confirm the brief, deliverables and success criteria',project:dixyProject,notes:'Agree what the £1,000 setup covers: pages, menu setup, ordering, revisions, launch and handover. Record exclusions and the monthly service after the included three months.',due_date:'',status:'todo',priority:'high'},
 {title:'Audit the current site, menu and ordering journey',project:dixyProject,notes:'Capture current menu categories, prices, descriptions, popular items, delivery/collection rules, address and existing order journey. Owner confirms what is current.',due_date:'',status:'todo',priority:'high'},
 {title:'Collect brand assets and restaurant information',project:dixyProject,notes:'Request approved logo, brand colours, food photography, phone number, opening hours, service area, delivery fees and social links.',due_date:'',status:'todo',priority:'high'},
 {title:'Confirm domain registration and DNS plan',project:dixyProject,notes:'Restaurant is named as legal registrant. Confirm registrar access, renewals, DNS contact, and whether the current OrderYOYO domain must redirect at launch.',due_date:'',status:'todo',priority:'high'},
 {title:'Create the owner review design',project:dixyProject,notes:'Design a mobile-first homepage, About, Contact and menu concept. Keep the ordering action clearly labelled as a draft until the owner approves it.',due_date:'',status:'todo',priority:'high'},
 {title:'Review design with the owner and record changes',project:dixyProject,notes:'Show desktop and mobile layouts. Capture one consolidated revision round and get written approval for the visual direction.',due_date:'',status:'todo',priority:'high'},
 {title:'Confirm the recurring cost and support schedule',project:dixyProject,notes:'List domain renewal, AWS, Orderable licence, automatic printing service, payment fees and 5limes care fee. Define response times and what counts as extra work.',due_date:'',status:'todo',priority:'high'},
 {title:'Choose the menu and ordering configuration',project:dixyProject,notes:'Confirm WooCommerce + Orderable features needed: grid/list, images, meal options, extras, collection/delivery scheduling, delivery zones and order limits.',due_date:'',status:'todo',priority:'normal'},
 {title:'Check the restaurant printer and always-on device',project:dixyProject,notes:'Record printer make/model, paper width, USB/network connection and the computer/device that can stay on. Confirm supported drivers before buying anything.',due_date:'',status:'todo',priority:'high'},
 {title:'Set up WordPress staging and protected administration',project:dixyProject,notes:'Provision a separate staging copy, HTTPS, unique admin accounts, backups, update policy and basic security monitoring before entering real customer data.',due_date:'',status:'todo',priority:'normal'},
 {title:'Build the branded public pages',project:dixyProject,notes:'Implement homepage, About, Contact and the menu/order entry point from the approved design. Check mobile layout and accessibility.',due_date:'',status:'todo',priority:'normal'},
 {title:'Install WooCommerce and Orderable',project:dixyProject,notes:'Configure the ordering pages and chosen menu layout. Verify any required paid Orderable features and licence ownership before purchase.',due_date:'',status:'todo',priority:'normal'},
 {title:'Load and verify the menu',project:dixyProject,notes:'Enter owner-approved item names, prices, descriptions, categories, photos, meal choices, extras and allergen details. Owner signs off the final menu.',due_date:'',status:'todo',priority:'normal'},
 {title:'Configure delivery, collection and opening rules',project:dixyProject,notes:'Set trading hours, lead times, collection slots, delivery area/postcodes, minimum spend, fees, order capacity and temporary order pause controls.',due_date:'',status:'todo',priority:'normal'},
 {title:'Set up the restaurant-owned payment account',project:dixyProject,notes:'Connect the owner’s payment gateway account and test successful payment, failed payment, refund and order confirmation emails.',due_date:'',status:'todo',priority:'high'},
 {title:'Configure automatic kitchen ticket printing',project:dixyProject,notes:'Connect Orderable/BizPrint to the local print station, create a clear kitchen ticket, choose print triggers and copies, and test duplicates and printer disconnect recovery.',due_date:'',status:'todo',priority:'high'},
 {title:'Run end-to-end test orders with the owner',project:dixyProject,notes:'Test mobile and desktop ordering, payment, customer emails, kitchen auto-print, pickup/delivery details, cancellations, refunds and the manual fallback if printing fails.',due_date:'',status:'todo',priority:'high'},
 {title:'Create owner login and practise menu updates',project:dixyProject,notes:'Give the owner a separate least-privilege account. Walk through changing a price, adding a menu item/photo, marking an item unavailable and pausing orders.',due_date:'',status:'todo',priority:'normal'},
 {title:'Prepare legal, privacy and customer information',project:dixyProject,notes:'Confirm the restaurant supplies accurate business, allergen, delivery, privacy, cookie and terms information before launch.',due_date:'',status:'todo',priority:'normal'},
 {title:'Plan DNS switch, redirects and launch checks',project:dixyProject,notes:'Only after sign-off: connect the new domain, test HTTPS and all routes, preserve useful links, confirm Google Business Profile URL, and keep a rollback path to the existing ordering site.',due_date:'',status:'todo',priority:'high'},
 {title:'Launch, monitor and hand over the support plan',project:dixyProject,notes:'Monitor the first live orders and print queue, provide owner notes for routine menu edits, document backups and emergency contacts, and start the agreed monthly care plan after the included three months.',due_date:'',status:'todo',priority:'normal'}
];
export function WorkBoard({csrf}:{csrf:string}){
 const [tasks,setTasks]=useState<Task[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [showForm,setShowForm]=useState(false),[editing,setEditing]=useState<Task|null>(null);
 const [form,setForm]=useState<TaskData>({...defaultTask});
 const [query,setQuery]=useState(''),[project,setProject]=useState('all');
 const [showDone,setShowDone]=useState(true);
 async function load(silent=false){
   if(!silent)setLoading(true);
   try{
     const response=await fetch('/admin/api/tasks',{credentials:'same-origin',cache:'no-store'});
     if(!response.ok)throw Error('Could not load the private work board.');
     const data=await response.json() as {tasks:Task[]};
     let currentTasks=data.tasks;
     const existingDixyTitles=new Set(currentTasks.filter(task=>task.project===dixyProject).map(task=>task.title));
     const missingDixyTasks=dixyTasks.filter(task=>!existingDixyTitles.has(task.title));
     if(missingDixyTasks.length){
       for(const task of missingDixyTasks){
         const created=await fetch('/admin/api/tasks',{method:'POST',credentials:'same-origin',headers:{
           'Content-Type':'application/json','X-CSRF-Token':csrf
         },body:JSON.stringify(task)});
         if(!created.ok)throw Error('Could not add the Dixy project checklist to the work board.');
       }
       const refreshed=await fetch('/admin/api/tasks',{credentials:'same-origin',cache:'no-store'});
       if(!refreshed.ok)throw Error('Could not refresh the private work board.');
       currentTasks=(await refreshed.json() as {tasks:Task[]}).tasks;
     }
     setTasks(currentTasks);setError('');
   }catch(e){setError(String(e));}finally{if(!silent)setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const projects=useMemo(()=>Array.from(new Set(tasks.map(task=>task.project))).sort(),[tasks]);
 const visible=useMemo(()=>tasks.filter(task=>{
   if(project!=='all'&&task.project!==project)return false;
   if(!showDone&&task.status==='done')return false;
   return [task.title,task.project,task.notes].join(' ').toLowerCase().includes(query.toLowerCase());
 }).sort((a,b)=>Number(b.priority==='high')-Number(a.priority==='high')||
   (a.due_date||'9999').localeCompare(b.due_date||'9999')||
   b.updated_at.localeCompare(a.updated_at)),[tasks,project,query,showDone]);
 const overdue=tasks.filter(t=>t.due_date&&t.due_date<today()&&t.status!=='done').length;
 function open(task?:Task){
   setEditing(task||null);setForm(task?{
     title:task.title,project:task.project,notes:task.notes,
     due_date:task.due_date,status:task.status,priority:task.priority
   }:{...defaultTask,project:project==='all'?'Personal':project});
   setError('');setMessage('');setShowForm(true);
 }
 async function mutate(path:string,method:string,body:unknown){
   const response=await fetch(path,{method,credentials:'same-origin',headers:{
     'Content-Type':'application/json','X-CSRF-Token':csrf
   },body:JSON.stringify(body)});
   if(!response.ok){
     const data=await response.json().catch(()=>({error:'Could not save task'})) as {error?:string};
     throw Error(data.error||'Could not save task');
   }
 }
 async function submit(){
   if(!form.title.trim()){setError('Task title is required.');return;}
   setBusy(true);setError('');
   try{
     if(editing)await mutate('/admin/api/tasks/'+editing.id,'PUT',{revision:editing.revision,task:form});
     else await mutate('/admin/api/tasks','POST',form);
     setShowForm(false);setEditing(null);setMessage(editing?'Task updated.':'Task created.');
     await load(true);
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function move(task:Task,status:Status){
   if(task.status===status)return;
   setBusy(true);setError('');
   try{
     await mutate('/admin/api/tasks/'+task.id,'PUT',{revision:task.revision,task:{
       title:task.title,project:task.project,notes:task.notes,
       due_date:task.due_date,priority:task.priority,status
     }});
     await load(true);
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function remove(){
   if(!editing||!window.confirm('Delete this task? This cannot be undone.'))return;
   setBusy(true);setError('');
   try{
     await mutate('/admin/api/tasks/'+editing.id,'DELETE',{revision:editing.revision});
     setShowForm(false);setEditing(null);setMessage('Task deleted.');
     await load(true);
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 return <section className="work-screen">
  <div className="work-head">
    <div><h2>Work board</h2><p>Keep LoftyCards, LOPT, portfolio and personal tasks in one private place.</p></div>
    <button type="button" className="work-primary" onClick={()=>open()}>+ Add task</button>
  </div>
  <div className="work-summary">
    <div><strong>{tasks.filter(t=>t.status!=='done').length}</strong><span>Open tasks</span></div>
    <div><strong>{tasks.filter(t=>t.status==='in_progress').length}</strong><span>In progress</span></div>
    <div><strong>{overdue}</strong><span>Overdue</span></div>
    <div><strong>{tasks.filter(t=>t.status==='done').length}</strong><span>Completed</span></div>
  </div>
  {error&&<p role="alert" className="work-error">{error}</p>}
  {message&&<p role="status" className="work-notice">{message}</p>}
  <div className="work-toolbar">
    <label>Project<select value={project} onChange={e=>setProject(e.target.value)}>
      <option value="all">All projects</option>{projects.map(p=><option key={p} value={p}>{p}</option>)}
    </select></label>
    <label>Search<input type="search" value={query} placeholder="Find a task…" onChange={e=>setQuery(e.target.value)}/></label>
    <label className="work-check"><input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)}/> Show completed</label>
  </div>
  {loading?<p className="work-empty">Loading tasks…</p>:<div className="work-columns">
    {stages.filter(stage=>stage.key!=='done'||showDone).map(stage=>{
      const items=visible.filter(task=>task.status===stage.key);
      return <div key={stage.key} className="work-column">
        <h3>{stage.name} <span>{items.length}</span></h3>
        {items.map(task=><article key={task.id} className="work-card">
          <div className="work-card-top"><span>{task.project}</span><span className={'work-priority work-'+task.priority}>{task.priority}</span></div>
          <button type="button" className="work-task-title" onClick={()=>open(task)}>{task.title}</button>
          {task.notes&&<p>{task.notes.length>150?task.notes.slice(0,150)+'…':task.notes}</p>}
          {task.due_date&&<div className={'work-due'+(task.due_date<today()&&task.status!=='done'?' work-overdue':'')}>
             Due {new Date(task.due_date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
          </div>}
          <label>Move to<select disabled={busy} aria-label={'Move '+task.title+' to'} value={task.status}
            onChange={e=>void move(task,e.target.value as Status)}>
            {stages.map(next=><option key={next.key} value={next.key}>{next.name}</option>)}
          </select></label>
        </article>)}
        {items.length===0&&<p className="work-empty-column">Nothing here yet</p>}
      </div>;
    })}
  </div>}
  {showForm&&<div className="work-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setShowForm(false)}}>
    <form className="work-modal" onSubmit={e=>{e.preventDefault();void submit()}}>
      <h3>{editing?'Edit task':'New task'}</h3>
      <label>Task title<input autoFocus required maxLength={220} value={form.title}
        onChange={e=>setForm(x=>({...x,title:e.target.value}))}/></label>
      <label>Project / workstream<input maxLength={80} list="work-project-options" value={form.project}
        onChange={e=>setForm(x=>({...x,project:e.target.value}))}/></label>
      <datalist id="work-project-options">{['Personal','LoftyCards','LOPT','Portfolio',...projects].map(p=><option key={p} value={p}/>)}</datalist>
      <div className="work-form-row">
        <label>Stage<select value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value as Status}))}>
          {stages.map(x=><option value={x.key} key={x.key}>{x.name}</option>)}</select></label>
        <label>Priority<select value={form.priority} onChange={e=>setForm(x=>({...x,priority:e.target.value as Priority}))}>
          <option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label>
      </div>
      <label>Due date<input type="date" value={form.due_date} onChange={e=>setForm(x=>({...x,due_date:e.target.value}))}/></label>
      <label>Notes<textarea rows={4} maxLength={6000} value={form.notes}
        onChange={e=>setForm(x=>({...x,notes:e.target.value}))}/></label>
      <div className="work-modal-actions">
        {editing&&<button type="button" className="work-delete" disabled={busy} onClick={()=>void remove()}>Delete</button>}
        <button type="button" disabled={busy} onClick={()=>setShowForm(false)}>Cancel</button>
        <button type="submit" disabled={busy} className="work-primary">{busy?'Saving…':'Save task'}</button>
      </div>
    </form>
  </div>}
 </section>;
}
