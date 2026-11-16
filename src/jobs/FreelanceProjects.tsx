import {useEffect,useState,type CSSProperties} from "react";
import "../styles/freelance-projects.css";

type MenuItem={name:string;description:string;price:string};
type Design={brand:string;headline:string;subheading:string;cta:string;accent:string;phone:string;address:string;delivery_note:string;menu:MenuItem[]};
type Project={id:string;revision:number;created_at:string;updated_at:string;title:string;client:string;status:"discovery"|"design"|"build"|"review"|"complete";summary:string;scope:string;tech_stack:string;repository_url:string;preview_url:string;design:Design};
type Tab="overview"|"cms"|"preview";
const statuses:Project["status"][]=["discovery","design","build","review","complete"];
const emptyDesign:Design={brand:"New takeaway",headline:"Hot, fresh and ready when you are",subheading:"Your local favourites, made fresh and ready for collection or delivery.",cta:"Order now",accent:"#b91c1c",phone:"",address:"",delivery_note:"Collection and delivery details to be confirmed.",menu:[]};
const blank:Omit<Project,"id"|"revision"|"created_at"|"updated_at">={title:"",client:"",status:"discovery",summary:"",scope:"",tech_stack:"",repository_url:"",preview_url:"",design:emptyDesign};

export function FreelanceProjects({csrf}:{csrf:string}){
 const [projects,setProjects]=useState<Project[]>([]),[selectedId,setSelectedId]=useState("");
 const [draft,setDraft]=useState<Project|null>(null),[tab,setTab]=useState<Tab>("overview");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [device,setDevice]=useState<"desktop"|"mobile">("desktop");
 const selected=projects.find(p=>p.id===selectedId)||null;
 async function load(){
   setLoading(true);
   try{
     const response=await fetch("/admin/api/freelance-projects",{credentials:"same-origin",cache:"no-store"});
     if(!response.ok)throw Error("Could not load freelance projects.");
     const data=await response.json() as {projects:Project[]};
     setProjects(data.projects);
     const next=data.projects.find(p=>p.id===selectedId)||data.projects[0]||null;
     setSelectedId(next?.id||"");setDraft(next?structuredClone(next):null);setError("");
   }catch(e){setError(String(e));}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 function change<K extends keyof Project>(key:K,value:Project[K]){setDraft(old=>old?{...old,[key]:value}:old);setNotice("");}
 function changeDesign<K extends keyof Design>(key:K,value:Design[K]){setDraft(old=>old?{...old,design:{...old.design,[key]:value}}:old);setNotice("");}
 function changed(){return !!draft&&!!selected&&JSON.stringify({...draft,updated_at:""})!==JSON.stringify({...selected,updated_at:""});}
 async function write(url:string,method:string,payload:unknown){
   const response=await fetch(url,{method,credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:JSON.stringify(payload)});
   if(!response.ok){const data=await response.json().catch(()=>({error:"Could not save project."})) as {error?:string};throw Error(data.error||"Could not save project.");}
   return response.status===204?null:response.json();
 }
 async function save(){
   if(!draft)return;
   if(!draft.title.trim()||!draft.client.trim()){setError("Add a project name and client before saving.");return;}
   setBusy(true);setError("");
   try{
     await write("/admin/api/freelance-projects/"+encodeURIComponent(draft.id),"PUT",{revision:draft.revision,project:{
       title:draft.title,client:draft.client,status:draft.status,summary:draft.summary,scope:draft.scope,tech_stack:draft.tech_stack,repository_url:draft.repository_url,preview_url:draft.preview_url,design:draft.design
     }});
     setNotice("Project and design draft saved.");await load();
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function addProject(){
   setBusy(true);setError("");
   try{
     const data=await write("/admin/api/freelance-projects","POST",blank) as {project:Project};
     setProjects(old=>[data.project,...old]);setSelectedId(data.project.id);setDraft(structuredClone(data.project));setTab("overview");setNotice("Project added. Add the scope and delivery details.");
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function remove(){
   if(!draft||!window.confirm("Delete this freelance project and its design draft? This cannot be undone."))return;
   setBusy(true);setError("");
   try{await write("/admin/api/freelance-projects/"+encodeURIComponent(draft.id),"DELETE",{revision:draft.revision});setNotice("Project deleted.");await load();}
   catch(e){setError(String(e));}finally{setBusy(false);}
 }
 function updateMenu(index:number,key:keyof MenuItem,value:string){
   if(!draft)return;
   const menu=draft.design.menu.map((item,i)=>i===index?{...item,[key]:value}:item);changeDesign("menu",menu);
 }
 return <section className="freelance-screen">
  <header className="freelance-header">
   <div><span className="freelance-eyebrow">CLIENT WORKSPACE</span><h2>Freelance projects</h2><p>Keep each brief, build notes and design preview together, separate from job applications.</p></div>
   <button className="freelance-primary" type="button" onClick={()=>void addProject()} disabled={busy}>＋ Add project</button>
  </header>
  {error&&<div className="freelance-alert" role="alert">{error}</div>}
  {notice&&<div className="freelance-notice" role="status">{notice}</div>}
  <div className="freelance-layout">
   <aside className="freelance-project-list" aria-label="Freelance projects">
    <div className="freelance-list-head"><strong>Projects</strong><span>{projects.length}</span></div>
    {loading?<p className="freelance-muted">Loading projects…</p>:projects.map(project=><button key={project.id} type="button" className={"freelance-project-row"+(project.id===selectedId?" selected":"")} onClick={()=>{setSelectedId(project.id);setDraft(structuredClone(project));setTab("overview");setError("");setNotice("");}}>
      <strong>{project.title}</strong><span>{project.client}</span><small>{project.status}</small>
    </button>)}
    {!loading&&projects.length===0&&<p className="freelance-muted">Add a client project to get started.</p>}
   </aside>
   {draft?<main className="freelance-workspace">
    <div className="freelance-project-heading">
     <div><span className="freelance-eyebrow">{draft.client||"NEW CLIENT PROJECT"}</span><h3>{draft.title||"Untitled project"}</h3><p>{draft.summary||"Add a short project summary."}</p></div>
     <div className="freelance-save-row"><span className={"freelance-state state-"+draft.status}>{draft.status}</span><button className="freelance-primary" type="button" onClick={()=>void save()} disabled={busy||!changed()}>{busy?"Saving…":"Save changes"}</button></div>
    </div>
    <nav className="freelance-tabs" aria-label="Project workspace tabs">
      {(["overview","cms","preview"] as Tab[]).map(value=><button key={value} type="button" className={tab===value?"active":""} onClick={()=>setTab(value)}>{value==="cms"?"Design CMS":value==="preview"?"Live preview":"Scope & build"}</button>)}
    </nav>
    {tab==="overview"?<div className="freelance-overview">
      <div className="freelance-form-card"><h4>Project brief</h4>
       <label>Project name<input value={draft.title} onChange={e=>change("title",e.target.value)} maxLength={140}/></label>
       <label>Client<input value={draft.client} onChange={e=>change("client",e.target.value)} maxLength={140}/></label>
       <label>Project status<select value={draft.status} onChange={e=>change("status",e.target.value as Project["status"])}>{statuses.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></label>
       <label>Summary<textarea rows={3} value={draft.summary} onChange={e=>change("summary",e.target.value)} maxLength={1200}/></label>
       <label>Scope<textarea rows={7} placeholder="Deliverables, decisions, exclusions and sign-off…" value={draft.scope} onChange={e=>change("scope",e.target.value)} maxLength={6000}/></label>
       <label>Tech and services<textarea rows={4} placeholder="Framework, hosting, ordering provider, analytics…" value={draft.tech_stack} onChange={e=>change("tech_stack",e.target.value)} maxLength={1600}/></label>
       <div className="freelance-two-fields"><label>Repository URL<input type="url" placeholder="https://…" value={draft.repository_url} onChange={e=>change("repository_url",e.target.value)}/></label><label>Live site URL (optional)<input type="url" placeholder="https://…" value={draft.preview_url} onChange={e=>change("preview_url",e.target.value)}/></label></div>
      </div>
      <aside className="freelance-side-note"><span className="freelance-eyebrow">WORKFLOW</span><h4>Brief → design → build → review</h4><p>Use the status to show where the project sits. Store the delivery brief and technical decisions here, then use Design CMS to shape the storefront content and preview the draft as you work.</p>
       <div className="freelance-quick-links"><button type="button" onClick={()=>setTab("cms")}>Edit storefront content ↗</button>{draft.preview_url&&<a href={draft.preview_url} target="_blank" rel="noreferrer">Open live site ↗</a>}{draft.repository_url&&<a href={draft.repository_url} target="_blank" rel="noreferrer">Open repository ↗</a>}</div>
      </aside>
     </div>:tab==="cms"?<div className="freelance-cms">
      <div className="freelance-form-card"><div className="freelance-card-title"><div><h4>Storefront content</h4><p>These are editable draft fields. Save changes to keep the CMS content.</p></div><label className="freelance-colour">Accent<input type="color" value={draft.design.accent} onChange={e=>changeDesign("accent",e.target.value)}/></label></div>
       <label>Brand name<input value={draft.design.brand} onChange={e=>changeDesign("brand",e.target.value)}/></label>
       <label>Hero headline<input value={draft.design.headline} onChange={e=>changeDesign("headline",e.target.value)}/></label>
       <label>Hero description<textarea rows={3} value={draft.design.subheading} onChange={e=>changeDesign("subheading",e.target.value)}/></label>
       <label>Order button label<input value={draft.design.cta} onChange={e=>changeDesign("cta",e.target.value)}/></label>
       <div className="freelance-two-fields"><label>Phone number<input value={draft.design.phone} onChange={e=>changeDesign("phone",e.target.value)}/></label><label>Area / address<input value={draft.design.address} onChange={e=>changeDesign("address",e.target.value)}/></label></div>
       <label>Collection and delivery note<textarea rows={2} value={draft.design.delivery_note} onChange={e=>changeDesign("delivery_note",e.target.value)}/></label>
       <div className="freelance-card-title"><div><h4>Menu preview</h4><p>Use indicative items until the client confirms the live menu and prices.</p></div><button type="button" className="freelance-secondary" onClick={()=>changeDesign("menu",[...draft.design.menu,{name:"New menu item",description:"Description to confirm.",price:"£0.00"}])}>＋ Add item</button></div>
       {draft.design.menu.map((item,index)=><div className="freelance-menu-edit" key={index}><label>Item<input value={item.name} onChange={e=>updateMenu(index,"name",e.target.value)}/></label><label>Description<input value={item.description} onChange={e=>updateMenu(index,"description",e.target.value)}/></label><label>Price<input value={item.price} onChange={e=>updateMenu(index,"price",e.target.value)}/></label><button type="button" aria-label={"Remove "+item.name} onClick={()=>changeDesign("menu",draft.design.menu.filter((_,i)=>i!==index))}>×</button></div>)}
      </div>
      <div className="freelance-cms-preview"><div className="freelance-preview-bar"><strong>Draft preview</strong><button type="button" onClick={()=>setTab("preview")}>Open larger preview ↗</button></div><Storefront design={draft.design}/></div>
     </div>:<div className="freelance-preview-workspace">
       <div className="freelance-preview-toolbar"><div><h4>Live design preview</h4><p>Updates as you edit CMS fields. Save to persist the current draft.</p></div><div className="freelance-device-switch"><button className={device==="desktop"?"active":""} onClick={()=>setDevice("desktop")} type="button">Desktop</button><button className={device==="mobile"?"active":""} onClick={()=>setDevice("mobile")} type="button">Mobile</button></div></div>
       {draft.preview_url&&<div className="freelance-live-link">A live site URL is saved for this project: <a href={draft.preview_url} target="_blank" rel="noreferrer">open in a new tab ↗</a></div>}
       <div className={"freelance-preview-frame "+(device==="mobile"?"mobile":"")}><Storefront design={draft.design}/></div>
     </div>}
    <footer className="freelance-footer"><small>Private project data · saved to your admin workspace</small><button type="button" className="freelance-delete" disabled={busy} onClick={()=>void remove()}>Delete project</button></footer>
   </main>:<div className="freelance-empty">Select a project to open its workspace.</div>}
  </div>
 </section>;
}

function Storefront({design}:{design:Design}){
 return <div className="takeaway-preview" style={{"--takeaway-accent":design.accent} as CSSProperties}>
   <div className="takeaway-top"><span>LOCAL TAKEAWAY</span><span>{design.address||"Your local area"}</span></div>
   <header className="takeaway-brand"><strong>{design.brand}</strong><span>{design.phone||"Collection · Delivery"}</span></header>
   <section className="takeaway-hero"><div><span className="takeaway-pill">FRESHLY MADE · READY TO ORDER</span><h2>{design.headline}</h2><p>{design.subheading}</p><button type="button">{design.cta} <b>→</b></button></div><div className="takeaway-food-art" aria-hidden="true"><span>🍗</span><i>✦</i></div></section>
   <section className="takeaway-menu"><div className="takeaway-menu-heading"><div><small>THE MENU</small><h3>Local favourites</h3></div><button type="button">View full menu →</button></div>
     <div className="takeaway-menu-grid">{(design.menu.length?design.menu:[{name:"Menu item preview",description:"Add items in the Design CMS.",price:"£—"}]).map((item,i)=><article key={i}><div className={"takeaway-food-thumb thumb-"+(i%3)}>🍟</div><div><strong>{item.name}</strong><p>{item.description}</p><b>{item.price}</b></div><button type="button" aria-label={"Add "+item.name}>＋</button></article>)}</div>
   </section><footer className="takeaway-footer">{design.delivery_note}{design.phone?" · "+design.phone:""}</footer>
 </div>;
}
