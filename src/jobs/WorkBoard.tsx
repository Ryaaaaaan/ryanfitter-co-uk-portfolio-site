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
     setTasks(data.tasks);setError('');
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
