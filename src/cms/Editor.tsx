import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,KeyboardEvent as ReactKeyboardEvent,PointerEvent as ReactPointerEvent} from 'react';
import type {SiteContent,Section} from './model';
import {blankSite,starterSite,screenshotSection,extraSections,clone} from './model';
import type {Project} from '../portfolioData';
import {PortfolioChrome} from '../components/PortfolioChrome';
import {ProjectDetail} from '../components/ProjectDetail';
import {PortfolioSection} from './Sections';
import './editor.css';

type Value=string|number|boolean|Value[]|{[key:string]:Value};
type Snapshot={draft:SiteContent;revision:number;publishedRevision:number};
type UploadedImage={filename:string;url:string;size:number};
type Viewport='desktop'|'laptop'|'tablet'|'phone'|'custom';
const previewPresets:Record<Exclude<Viewport,'custom'>,number>={
  desktop:1440,laptop:1280,tablet:768,phone:390
};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
type Page='home'|'projects';
type PickImage=(onSelect:(url:string)=>void)=>void;
const pretty=(v:string)=>v.replace(/_/g,' ').replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
const sectionNames:Record<string,string>={
 text:'Content / text',hero:'Hero',stats:'Stats / numbers',projects:'Portfolio projects',
 expertise:'Skills / features',about:'About',contact:'Contact',image:'Screenshot / image',
 image_text:'Image + text',gallery:'Image gallery',testimonial:'Testimonial',
 cta:'Call to action',divider:'Spacer / divider'
};
const templates=Array.from(new Map(
 [blankSite.sections[0],...starterSite.sections,screenshotSection,...extraSections]
 .map(s=>[s.type,s])
).values());
const cloneEmpty=(value:Value):Value=>
 typeof value==='string'?'':typeof value==='number'?value:typeof value==='boolean'?value:
 Array.isArray(value)?[]:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,cloneEmpty(v)]));
function newArrayItem(name:string,values:Value[],sectionType:string):Value{
 if(name==='links'||name==='buttons')return {label:'New link',href:'#contact'};
 if(name==='projects')return {...clone(starterSite.projects[0]),slug:'new-project-'+Date.now(),client:'New project'} as unknown as Value;
 if(name==='items'){
   if(sectionType==='gallery')return {image:'',caption:'New screenshot'};
   if(sectionType==='stats')return {value:'',label:''};
   return {heading:'New feature',body:'Add a description'};
 }
 if(name==='facts')return {value:'',label:''};
 if(name==='skills'||name==='paragraphs'||name==='work'||name==='tools')return 'New item';
 if(values.length)return cloneEmpty(values[values.length-1]);
 return '';
}
function Field({
 value,onChange,name='Settings',sectionType='',onPickImage
}:{value:Value;onChange:(v:Value)=>void;name?:string;sectionType?:string;onPickImage:PickImage}){
 if(typeof value==='boolean')return <label className="visual-check"><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)}/><span>{pretty(name)}</span></label>;
 if(typeof value==='number'){
   const bounded=name==='padding'||name==='fontSize'||name==='contentWidth';
   const min=name==='contentWidth'?320:name==='fontSize'?12:0;
   const max=name==='contentWidth'?1600:name==='fontSize'?48:240;
   return <label className="visual-field">{pretty(name)} {bounded&&<output>{value}{name==='contentWidth'||name==='padding'||name==='fontSize'?'px':''}</output>}
     {bounded?<input type="range" min={min} max={max} step={name==='contentWidth'?10:1} value={value} onChange={e=>onChange(Number(e.target.value))}/>:
     <input type="number" value={value} onChange={e=>onChange(Number(e.target.value)||0)}/>}</label>;
 }
 if(typeof value==='string'){
   if(name==='id'||name==='type')return <p className="visual-readonly">{pretty(name)}: <code>{value}</code></p>;
   const options=name==='font'?['sans','serif','mono']:
     name==='align'?['left','center','right']:
     name==='imageSide'?['left','right']:null;
   if(options)return <label className="visual-field">{pretty(name)}<select value={value} onChange={e=>onChange(e.target.value)}>
     {options.map(o=><option key={o} value={o}>{pretty(o)}</option>)}
   </select></label>;
   if(name==='image')return <div className="visual-field visual-image-field"><strong>Image</strong>
     {value?<img src={value} alt="Selected portfolio media" loading="lazy"/>:<div className="visual-image-empty">No image selected</div>}
     <div className="visual-button-row"><button type="button" onClick={()=>onPickImage(url=>onChange(url))}>{value?'Change image':'Choose image'}</button>
       {value&&<button type="button" onClick={()=>onChange('')}>Remove</button>}</div>
   </div>;
   const isColor=['background','text','muted','accent','panel'].includes(name)
     &&(value===''||/^#[0-9a-fA-F]{6}$/.test(value));
   if(isColor)return <label className="visual-field">{pretty(name)}
     <div className="visual-colour-row"><input type="color" aria-label={pretty(name)+' colour'} value={/^#[0-9a-fA-F]{6}$/.test(value)?value:'#ffffff'} onChange={e=>onChange(e.target.value)}/>
       <input aria-label={pretty(name)+' hex value'} value={value} placeholder="Inherit" onChange={e=>onChange(e.target.value)}/></div>
     {value===''&&<small>Inherits the site theme</small>}
   </label>;
   const multiline=['body','description','summary','challenge','result','note','text','caption','emphasis'].includes(name)||value.length>125;
   return <label className="visual-field">{pretty(name)}
    {multiline?<textarea rows={4} value={value} onChange={e=>onChange(e.target.value)}/>:
    <input value={value} onChange={e=>onChange(e.target.value)}/>}
   </label>;
 }
 if(Array.isArray(value)){
   return <fieldset className="visual-fieldset"><legend>{pretty(name)}</legend>
     {value.map((item,i)=><div className="visual-array-item" key={i}>
       <div className="visual-array-head"><strong>{pretty(name)} {i+1}</strong><div className="visual-button-row">
        <button type="button" disabled={i===0} onClick={()=>{const next=[...value];[next[i-1],next[i]]=[next[i],next[i-1]];onChange(next);}}>↑</button>
        <button type="button" disabled={i===value.length-1} onClick={()=>{const next=[...value];[next[i],next[i+1]]=[next[i+1],next[i]];onChange(next);}}>↓</button>
        <button type="button" onClick={()=>onChange(value.filter((_,j)=>j!==i))}>×</button>
       </div></div>
       <Field value={item} name={typeof item==='object'?'Details':pretty(name)+' '+(i+1)} onChange={v=>onChange(value.map((x,j)=>j===i?v:x))} sectionType={sectionType} onPickImage={onPickImage}/>
     </div>)}
     <button type="button" className="visual-add-mini" onClick={()=>onChange([...value,newArrayItem(name,value,sectionType)])}>+ Add {name==='items'?'item':name==='links'?'link':'entry'}</button>
   </fieldset>;
 }
 return <fieldset className="visual-fieldset"><legend>{pretty(name)}</legend>
  {Object.entries(value).map(([k,v])=><Field key={k} value={v} name={k} sectionType={sectionType} onPickImage={onPickImage} onChange={newValue=>onChange({...value,[k]:newValue})}/>)}
 </fieldset>;
}

export function CmsEditor({csrf}:{csrf:string}){
 const [draft,setDraft]=useState<SiteContent|null>(null);
 const [revision,setRevision]=useState(0),[published,setPublished]=useState(0);
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 const [selected,setSelected]=useState('sections'),[page,setPage]=useState<Page>('home');
 const [viewport,setViewport]=useState<Viewport>('desktop'),[focus,setFocus]=useState(false);
 const [customWidth,setCustomWidth]=useState(1100),[fitToStage,setFitToStage]=useState(true);
 const [showRail,setShowRail]=useState(true),[showInspector,setShowInspector]=useState(true);
 const [railWidth,setRailWidth]=useState(198),[inspectorWidth,setInspectorWidth]=useState(288);
 const studioRef=useRef<HTMLDivElement>(null);
 const splitter=useRef<{side:'rail'|'inspector';pointerId:number;x:number;width:number}|null>(null);
 const frameResizer=useRef<{pointerId:number;x:number;width:number;zoom:number}|null>(null);
 const [images,setImages]=useState<UploadedImage[]>([]),[mediaOpen,setMediaOpen]=useState(false);
 const [picker,setPicker]=useState<((url:string)=>void)|null>(null);
 const [railOpen,setRailOpen]=useState(false),[inspectorOpen,setInspectorOpen]=useState(false);
 const [dragIndex,setDragIndex]=useState<number|null>(null);
 const [undoSite,setUndoSite]=useState<SiteContent|null>(null);
 const stageRef=useRef<HTMLDivElement>(null);
 const [stageWidth,setStageWidth]=useState(1200);
 useEffect(()=>{
   const el=stageRef.current;if(!el)return;
   const observer=new ResizeObserver(entries=>setStageWidth(entries[0].contentRect.width));
   observer.observe(el);setStageWidth(el.clientWidth);
   return ()=>observer.disconnect();
 },[draft!==null,focus,showRail,showInspector]);
 function setPreviewWidth(next:number){
   setCustomWidth(clamp(Math.round(next),320,1920));setViewport('custom');
 }
 function startSplitter(event:ReactPointerEvent<HTMLDivElement>,side:'rail'|'inspector'){
   if(event.button!==0)return;
   event.preventDefault();
   splitter.current={side,pointerId:event.pointerId,x:event.clientX,
     width:side==='rail'?railWidth:inspectorWidth};
   event.currentTarget.setPointerCapture(event.pointerId);
 }
 function moveSplitter(event:ReactPointerEvent<HTMLDivElement>){
   const drag=splitter.current;
   if(!drag||drag.pointerId!==event.pointerId)return;
   const width=studioRef.current?.clientWidth||1300;
   const minimumStage=400;
   const other=drag.side==='rail'?(showInspector?inspectorWidth:0):(showRail?railWidth:0);
   const maximum=Math.max(160,Math.min(drag.side==='rail'?330:430,width-other-minimumStage-12));
   const delta=(event.clientX-drag.x)*(drag.side==='rail'?1:-1);
   if(drag.side==='rail')setRailWidth(clamp(drag.width+delta,150,maximum));
   else setInspectorWidth(clamp(drag.width+delta,225,Math.max(225,maximum)));
 }
 function finishSplitter(event:ReactPointerEvent<HTMLDivElement>){
   if(splitter.current?.pointerId!==event.pointerId)return;
   splitter.current=null;
   if(event.currentTarget.hasPointerCapture(event.pointerId))
     event.currentTarget.releasePointerCapture(event.pointerId);
 }
 function resizeWithKey(event:ReactKeyboardEvent<HTMLDivElement>,side:'rail'|'inspector'){
   if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
   event.preventDefault();
   const direction=(event.key==='ArrowRight'?1:-1)*(side==='rail'?1:-1);
   if(side==='rail')setRailWidth(current=>clamp(current+direction*18,150,330));
   else setInspectorWidth(current=>clamp(current+direction*18,225,430));
 }
 function startFrameResize(event:ReactPointerEvent<HTMLDivElement>,width:number,zoom:number){
   if(event.button!==0)return;
   event.preventDefault();event.stopPropagation();
   frameResizer.current={pointerId:event.pointerId,x:event.clientX,width,zoom};
   event.currentTarget.setPointerCapture(event.pointerId);
 }
 function moveFrameResize(event:ReactPointerEvent<HTMLDivElement>){
   const drag=frameResizer.current;
   if(!drag||drag.pointerId!==event.pointerId)return;
   // The frame is centred; moving its right edge expands both sides.
   setPreviewWidth(drag.width+2*(event.clientX-drag.x)/drag.zoom);
 }
 function finishFrameResize(event:ReactPointerEvent<HTMLDivElement>){
   if(frameResizer.current?.pointerId!==event.pointerId)return;
   frameResizer.current=null;
   if(event.currentTarget.hasPointerCapture(event.pointerId))
     event.currentTarget.releasePointerCapture(event.pointerId);
 }

 async function loadMedia(){
   try{
     const response=await fetch('/admin/api/media',{cache:'no-store',credentials:'same-origin'});
     if(!response.ok)throw Error('Unable to load media library.');
     setImages((await response.json() as {images:UploadedImage[]}).images);
   }catch(e){setError(String(e));}
 }
 async function uploadImage(file?:File){
   if(!file)return;
   setBusy(true);setError('');setMessage('');
   try{
     if(file.size>5*1024*1024)throw Error('File must be under 5 MB.');
     const body=new FormData();body.append('file',file);
     const response=await fetch('/admin/api/media',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf},body});
     const result=await response.json() as {error?:string;url?:string};
     if(!response.ok||!result.url)throw Error(result.error||'Image upload failed.');
     await loadMedia();
     if(picker){picker(result.url);closeMedia();setMessage('Uploaded and selected. Draft preview updated; save when ready.');}
     else setMessage('Image uploaded to your private library. Select it on any section or case study.');
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 function receive(s:Snapshot){
   setDraft(s.draft);setRevision(s.revision);setPublished(s.publishedRevision);setDirty(false);
 }
 async function load(){
   setBusy(true);
   try{
     const response=await fetch('/admin/api/cms',{cache:'no-store',credentials:'same-origin'});
     if(!response.ok)throw Error('Unable to load CMS. Check your private login.');
     receive(await response.json() as Snapshot);setError('');
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 useEffect(()=>{void load();void loadMedia();},[]);
 useEffect(()=>{const guard=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',guard);return ()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 function edit(next:SiteContent){setDraft(next);setDirty(true);setError('');setMessage('');}
 function select(next:string,whichPage=page){
   setPage(whichPage);setSelected(next);setInspectorOpen(true);setRailOpen(false);setShowInspector(true);
 }
 function useTemplate(template:SiteContent){
   if(!draft)return;
   if(dirty&&!window.confirm('Replace your unsaved changes with this starter? Your published website will not change.'))return;
   setUndoSite(clone(draft));const next=clone(template);
   edit(next);setPage('home');select(next.sections[0]?.id||'sections','home');
   setMessage('Template loaded. You are now seeing its LIVE DRAFT in the centre. Edit anything on the right, then save or publish.');
   stageRef.current?.scrollTo({top:0,behavior:'smooth'});
 }
 function undoTemplate(){
   if(!undoSite)return;
   const previous=clone(undoSite);setUndoSite(null);edit(previous);
   setPage('home');select(previous.sections[0]?.id||'sections','home');
   setMessage('Previous draft restored. Nothing on the public site was changed.');
 }
 async function write(publish:boolean){
   if(!draft)return;
   if(publish&&!window.confirm('Publish these changes to ryanfitter.co.uk now? They will be publicly visible.'))return;
   setBusy(true);setError('');setMessage('');
   try{
     const request=async(path:string,body:unknown,method:string)=>{
       const response=await fetch(path,{method,credentials:'same-origin',
         headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
       const data=await response.json() as Snapshot&{error?:string};
       if(!response.ok)throw Error(data.error||'Save failed. Reload if this draft changed in another tab.');
       return data;
     };
     let result=await request('/admin/api/cms',{document:draft,revision},'PUT');
     receive(result);
     if(publish){result=await request('/admin/api/cms/publish',{revision:result.revision},'POST');receive(result);}
     setUndoSite(null);setMessage(publish?'Published successfully. Your live site now reflects the preview.':'Draft saved. The public website is unchanged.');
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 function addSection(template:Section){
   if(!draft)return;
   const next=clone(template);next.id=template.type+'-'+Date.now();
   edit({...draft,sections:[...draft.sections,next]});
   select(next.id,'home');setMessage('Section added and displayed in the live preview.');
 }
 function updateSection(next:Section){
   if(!draft)return;
   const index=draft.sections.findIndex(s=>s.id===selected);
   if(index<0)return;
   edit({...draft,sections:draft.sections.map((s,i)=>i===index?next:s)});
   if(next.id!==selected)setSelected(next.id);
 }
 function moveSection(from:number,to:number){
   if(!draft||from===to||from<0||to<0)return;
   const array=[...draft.sections];const [item]=array.splice(from,1);array.splice(to,0,item);
   edit({...draft,sections:array});
 }
 function removeSection(index:number){
   if(!draft||!window.confirm('Remove this section from the draft? Nothing is published until you choose Publish.'))return;
   edit({...draft,sections:draft.sections.filter((_,i)=>i!==index)});
   setSelected(draft.sections.filter((_,i)=>i!==index)[0]?.id||'sections');
 }
 function duplicateSection(index:number){
   if(!draft)return;
   const next=clone(draft.sections[index]);next.id=next.type+'-'+Date.now();
   const sections=[...draft.sections];sections.splice(index+1,0,next);
   edit({...draft,sections});select(next.id,'home');
 }
 function addProject(){
   if(!draft||!starterSite.projects[0])return;
   const project=clone(starterSite.projects[0]);
   project.slug='project-'+Date.now();project.number=String(draft.projects.length+1).padStart(2,'0');
   project.client='New project';project.title='My new case study';
   project.image='';project.note='';
   edit({...draft,projects:[...draft.projects,project]});select('project:'+project.slug,'projects');
 }
 const section=draft?.sections.find(x=>x.id===selected);
 const project=draft?.projects.find(x=>selected==='project:'+x.slug);
 const projectForPreview=draft?.projects.find(x=>x.slug===(project?.slug||draft?.projects[0]?.slug));
 function updateProject(value:Project){
   if(!draft||!project)return;
   edit({...draft,projects:draft.projects.map(p=>p.slug===project.slug?value:p)});
   if(value.slug!==project.slug)setSelected('project:'+value.slug);
 }
 function openMedia(onSelect?:(url:string)=>void){
   setPicker(()=>onSelect||null);setMediaOpen(true);void loadMedia();
 }
 function closeMedia(){setMediaOpen(false);setPicker(null);}
 function selectImage(url:string){
   if(picker){picker(url);closeMedia();setMessage('Screenshot selected. The live preview is updated.');}
   else {void navigator.clipboard?.writeText(url);setMessage('Image URL copied. Choose a section to attach it.');}
 }
 const pickImage:PickImage=onSelect=>openMedia(onSelect);
 const selectedProject=selected.startsWith('project:');
 const selectedTitle=section?sectionNames[section.type]||pretty(section.type):project?project.client:pretty(selected);
 const statusText=busy?'Working…':dirty?'Unsaved draft changes':revision===published?'All changes published':'Saved draft awaiting publication';
 const designWidth=viewport==='custom'?customWidth:previewPresets[viewport];
 const previewZoom=fitToStage?Math.min(1,Math.max(.25,(stageWidth-46)/designWidth)):1;
 const frameStyle={'--cms-live-width':designWidth+'px',zoom:previewZoom} as CSSProperties;
 const previewLayout=designWidth<=540?'mobile':designWidth<=900?'tablet':'desktop';
 const studioStyle={'--vc-rail-width':(showRail?railWidth:0)+'px',
   '--vc-inspector-width':(showInspector?inspectorWidth:0)+'px',
   '--vc-left-grip':(showRail?8:0)+'px',
   '--vc-right-grip':(showInspector?8:0)+'px'} as CSSProperties;

 function inspect(key:string){select(key);}
 function onCanvasKey(e:ReactKeyboardEvent<HTMLDivElement>,id:string){
   if(e.key==='Enter'||e.key===' '){e.preventDefault();select(id,'home');}
 }
 return <section className="cms-editor visual-cms">
   <header className="visual-cms-header">
     <details className="visual-workspace-menu">
       <summary aria-label="Open workspace navigation">☰ <span>Workspace</span></summary>
       <nav aria-label="Workspace navigation">
         <a href="/admin">Overview</a>
         <a href="/admin/job-matches">Job matches</a>
         <a href="/admin/jobs">Applications</a>
         <a href="/admin/interviews">Interview calendar</a>
         <a href="/admin/cvs">My CVs</a>
         <a href="/admin/cms" aria-current="page">Portfolio CMS</a>
       </nav>
     </details>
     <div className="visual-cms-title">
       <h2>Portfolio builder <span>Live draft</span></h2>
     </div>
     <div className="visual-cms-toolbar">
       <span className={'visual-cms-state'+(dirty?' is-dirty':'')}>{statusText}</span>
       <a href="/" target="_blank" rel="noopener noreferrer" className="visual-cms-link">Live site ↗</a>
       <button type="button" onClick={()=>void write(false)} disabled={!draft||busy}>Save draft</button>
       <button type="button" className="visual-publish" disabled={!draft||busy} onClick={()=>void write(true)}>Publish</button>
     </div>
   </header>
   {error&&<div className="visual-cms-error" role="alert">{error} <button onClick={()=>{if(!dirty||window.confirm('Discard unsaved edits?'))void load();}}>Reload draft</button></div>}
   {message&&<div className="visual-cms-message" role="status">{message} {undoSite&&<button type="button" onClick={undoTemplate}>Undo</button>}<button type="button" aria-label="Dismiss message" onClick={()=>setMessage('')}>×</button></div>}
   {draft?<div ref={studioRef} style={studioStyle} className={'visual-cms-studio'+(focus?' visual-cms-focus':'')+(railOpen?' rail-open':'')+(inspectorOpen?' inspector-open':'')+(!showRail?' visual-rail-hidden':'')+(!showInspector?' visual-inspector-hidden':'')}>
      <aside className="visual-cms-rail" aria-label="Portfolio content sections">
        <div className="visual-rail-head"><strong>Pages & sections</strong><button type="button" className="visual-close-panel" onClick={()=>setRailOpen(false)}>Close</button></div>
        <label className="visual-rail-page">Editing page
          <select value={page} onChange={e=>{const p=e.target.value as Page;setPage(p);setSelected(p==='home'?'sections':'projects');}}>
           <option value="home">Home page</option><option value="projects">Case study pages</option>
          </select>
        </label>
        {page==='home'?<>
          <p className="visual-rail-caption">PAGE CONTENT <span>{draft.sections.length} sections</span></p>
          <button className={'visual-section-entry'+(selected==='header'?' active':'')} onClick={()=>inspect('header')}>◧ <span>Header / navigation</span></button>
          <div className="visual-rail-sections">
           {draft.sections.map((s,i)=><div className={'visual-rail-section'+(selected===s.id?' active':'')}
            key={s.id} draggable onDragStart={()=>setDragIndex(i)} onDragEnd={()=>setDragIndex(null)}
            onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragIndex!==null)moveSection(dragIndex,i);setDragIndex(null);}}>
              <button type="button" className="visual-rail-select" aria-pressed={selected===s.id} onClick={()=>select(s.id,'home')}>
                <span className="visual-drag">⠿</span><span><strong>{s.heading||sectionNames[s.type]||s.type}</strong><small>{sectionNames[s.type]||pretty(s.type)}{!s.enabled?' · hidden':''}</small></span>
              </button>
              <div className="visual-rail-controls">
                <button type="button" title="Move up" disabled={i===0} onClick={()=>moveSection(i,i-1)}>↑</button>
                <button type="button" title="Move down" disabled={i===draft.sections.length-1} onClick={()=>moveSection(i,i+1)}>↓</button>
              </div>
           </div>)}
          </div>
          <details className="visual-add-menu"><summary>+ Add section</summary>
             <div className="visual-add-options">{templates.map(t=><button type="button" key={t.type} onClick={e=>{addSection(t);(e.currentTarget.closest('details') as HTMLDetailsElement).open=false;}}>+ {sectionNames[t.type]||pretty(t.type)}</button>)}</div>
          </details>
          <button className={'visual-section-entry'+(selected==='footer'?' active':'')} onClick={()=>inspect('footer')}>▤ <span>Footer</span></button>
        </>:<>
          <p className="visual-rail-caption">PROJECT PAGES <span>{draft.projects.length}</span></p>
          {draft.projects.map(p=><button key={p.slug} className={'visual-section-entry'+(selected==='project:'+p.slug?' active':'')} onClick={()=>select('project:'+p.slug,'projects')}>▦ <span>{p.client}</span></button>)}
          <button className="visual-add-project" onClick={addProject}>+ Add case study</button>
        </>}
        <p className="visual-rail-caption">SITE SETTINGS</p>
        <div className="visual-rail-settings">
          {(['sections','theme','header','footer','projects','metadata','media'] as const).map(key=><button key={key}
            className={selected===key?'active':''} onClick={()=>{setPage(key==='projects'?'projects':'home');inspect(key);}}>
            {key==='sections'?'Templates':key==='media'?'Media library':key==='projects'?'Case studies':pretty(key)}
          </button>)}
        </div>
      </aside>
      <div role="separator" aria-label="Resize sections panel" aria-orientation="vertical"
        aria-valuemin={150} aria-valuemax={330} aria-valuenow={railWidth} tabIndex={0}
        className="visual-panel-resizer visual-resizer-left" onPointerDown={e=>startSplitter(e,'rail')}
        onPointerMove={moveSplitter} onPointerUp={finishSplitter} onPointerCancel={finishSplitter}
        onKeyDown={e=>resizeWithKey(e,'rail')} title="Drag to resize sections panel, or use arrow keys">
        <span/>
      </div>
      <div className="visual-cms-stage">
        <div className="visual-stage-bar">
          <button type="button" className="visual-mobile-rail" onClick={()=>setRailOpen(!railOpen)}>☰ Sections</button>
          <button type="button" className="visual-stage-panel-toggle visual-desktop-rail"
            aria-pressed={showRail} onClick={()=>setShowRail(value=>!value)}>
            {showRail?'◀ Sections':'☰ Sections'}
          </button>
          <div className="visual-stage-label"><strong>ryanfitter.co.uk</strong><span>{page==='home'?'Home':'Case study'} · {designWidth}px wide</span></div>
          <div className="visual-stage-actions">
           <div className="visual-viewports" role="group" aria-label="Preview device width">
             {(['desktop','laptop','tablet','phone'] as const).map(v=><button type="button"
               key={v} aria-pressed={viewport===v} title={pretty(v)+' — '+previewPresets[v]+'px'}
               onClick={()=>setViewport(v)}>{pretty(v)}</button>)}
           </div>
           <button type="button" className="visual-stage-panel-toggle visual-desktop-inspector"
             aria-pressed={showInspector} onClick={()=>setShowInspector(value=>!value)}>
             {showInspector?'Inspector ▶':'◧ Inspector'}
           </button>
           <button type="button" className="visual-focus-button" onClick={()=>setFocus(!focus)}>{focus?'Exit focus':'Preview only'}</button>
           <button type="button" className="visual-mobile-inspector" onClick={()=>setInspectorOpen(!inspectorOpen)}>Edit</button>
          </div>
        </div>
        <div className="visual-cms-canvas" ref={stageRef}>
          {page==='home'&&selected==='sections'&&<div className="visual-template-chooser">
            <strong>Start building your website</strong>
            <p>Load a starter and it will appear immediately in the live preview below. It does not publish your site.</p>
            <div><button type="button" onClick={()=>useTemplate(starterSite)}><b>Professional portfolio</b><small>Hero, case studies, expertise, about, contact</small></button>
              <button type="button" onClick={()=>useTemplate(blankSite)}><b>Blank slate</b><small>One simple introduction</small></button></div>
          </div>}
          <div className={'visual-page-frame '+previewLayout} style={frameStyle}
            onClickCapture={e=>{const target=e.target as HTMLElement;
              if(target.closest('a,button'))e.preventDefault();
              if(target.closest('.portfolio-header'))select('header',page);
              else if(target.closest('.portfolio-footer'))select('footer',page);
            }}>
            <PortfolioChrome site={draft}>
              {page==='home'?<main id="main">
                {draft.sections.filter(s=>s.enabled).map(s=><div className={'visual-preview-section'+(selected===s.id?' is-selected':'')} key={s.id}
                   role="button" tabIndex={0} aria-label={'Edit '+(s.heading||s.type)}
                   onKeyDown={e=>onCanvasKey(e,s.id)} onClick={()=>select(s.id,'home')}>
                  <span className="visual-section-label">{sectionNames[s.type]||pretty(s.type)}</span>
                  <PortfolioSection section={s} site={draft}/>
                </div>)}
                {draft.sections.filter(s=>s.enabled).length===0&&<div className="visual-empty-page">This draft has no visible sections. Add one from the left sidebar.</div>}
              </main>:projectForPreview?<div onClick={()=>select('project:'+projectForPreview.slug,'projects')} role="presentation">
                <ProjectDetail project={projectForPreview} projects={draft.projects}/>
              </div>:<div className="visual-empty-page">No case studies yet. Add one from the left rail.</div>}
            </PortfolioChrome>
            <div className="visual-frame-resize-handle" role="separator" tabIndex={0}
              aria-label="Resize preview width" aria-orientation="vertical"
              aria-valuemin={320} aria-valuemax={1920} aria-valuenow={designWidth}
              title="Drag to resize the preview, or use arrow keys"
              onPointerDown={e=>startFrameResize(e,designWidth,previewZoom)}
              onPointerMove={moveFrameResize} onPointerUp={finishFrameResize} onPointerCancel={finishFrameResize}
              onKeyDown={e=>{
                if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
                  e.preventDefault();setPreviewWidth(designWidth+(e.key==='ArrowRight'?20:-20));
                }
              }}><span>⋮</span></div>
          </div>
        </div>
        <div className="visual-stage-footer">
          <div className="visual-preview-size">
            <label htmlFor="preview-width">Preview width</label>
            <input id="preview-width" type="range" min="320" max="1920" step="10"
              value={designWidth} aria-label="Preview width in pixels"
              onChange={e=>setPreviewWidth(Number(e.target.value))}/>
            <input type="number" aria-label="Preview width pixels" min="320" max="1920"
              value={designWidth} onChange={e=>setPreviewWidth(Number(e.target.value))}/>
            <span>px</span>
          </div>
          <div className="visual-preview-zoom">
            <button type="button" aria-pressed={fitToStage} onClick={()=>setFitToStage(value=>!value)}>
              {fitToStage?'Fit preview':'100% size'}
            </button>
            <span>{Math.round(previewZoom*100)}% zoom</span>
          </div>
        </div>
      </div>
      <div role="separator" aria-label="Resize editor inspector" aria-orientation="vertical"
        aria-valuemin={225} aria-valuemax={430} aria-valuenow={inspectorWidth} tabIndex={0}
        className="visual-panel-resizer visual-resizer-right" onPointerDown={e=>startSplitter(e,'inspector')}
        onPointerMove={moveSplitter} onPointerUp={finishSplitter} onPointerCancel={finishSplitter}
        onKeyDown={e=>resizeWithKey(e,'inspector')} title="Drag to resize inspector, or use arrow keys">
        <span/>
      </div>
      <aside className="visual-cms-inspector" aria-label="Selected section settings">
        <div className="visual-inspector-head"><div><small>INSPECTOR</small><strong>{selectedTitle}</strong></div><button type="button" className="visual-close-panel" onClick={()=>setInspectorOpen(false)}>Close</button></div>
        <div className="visual-inspector-body" key={selected}>
        {selected==='sections'?<>
          <h3>Choose a starting point</h3><p>Both templates update the preview instantly and remain private until you publish.</p>
          <div className="visual-template-buttons"><button onClick={()=>useTemplate(starterSite)}>Use professional portfolio</button>
            <button onClick={()=>useTemplate(blankSite)}>Use blank slate</button></div>
          <p className="visual-help">Click any block in the central preview to edit its text and styling. Reorder sections in the left rail. The preview uses the same components as the public site.</p>
        </>:selected==='media'?<>
          <h3>Media library</h3><p>Upload your own screenshots to the private library. Published pages can display selected images.</p>
          <button className="visual-upload-button" onClick={()=>openMedia()}>Open image library / upload</button>
          <p>{images.length} images in your library.</p>
        </>:selected==='metadata'?<>
          <Field name="Page title" value={draft.title} onChange={v=>edit({...draft,title:v as string})} onPickImage={pickImage}/>
          <Field name="Description" value={draft.description} onChange={v=>edit({...draft,description:v as string})} onPickImage={pickImage}/>
        </>:selected==='theme'||selected==='header'||selected==='footer'?<>
          {selected==='theme'&&<div className="visual-presets"><strong>Colour presets</strong>
            {[
              {name:'Forest',background:'#f7f8f3',text:'#172520',muted:'#52615a',accent:'#24634b',panel:'#fffef9'},
              {name:'Slate',background:'#f2f4f7',text:'#17253c',muted:'#596575',accent:'#2457a7',panel:'#ffffff'},
              {name:'Dark',background:'#151e1d',text:'#ecf2ef',muted:'#a9b7b0',accent:'#66cf9e',panel:'#22302c'}
            ].map(preset=><button type="button" key={preset.name} onClick={()=>edit({...draft,theme:{...draft.theme,...preset}})}>{preset.name}</button>)}
          </div>}
          <Field value={draft[selected as 'theme'|'header'|'footer'] as unknown as Value} onChange={v=>edit({...draft,[selected]:v})} name={pretty(selected)} onPickImage={pickImage}/>
        </>:selected==='projects'?<>
          <h3>Case studies</h3><p>Select a project on the left or click Add case study to create a new draft page.</p>
          <button onClick={addProject}>+ Add case study</button>
        </>:section?<>
          <div className="visual-inspector-section-actions">
            <button type="button" onClick={()=>updateSection({...section,enabled:!section.enabled})}>{section.enabled?'Hide section':'Show section'}</button>
            <button type="button" onClick={()=>duplicateSection(draft.sections.indexOf(section))}>Duplicate</button>
            <button type="button" onClick={()=>removeSection(draft.sections.indexOf(section))}>Delete</button>
          </div>
          <Field value={{...section,image:section.image||''} as unknown as Value} name={sectionNames[section.type]||section.type}
            sectionType={section.type} onPickImage={pickImage} onChange={v=>updateSection(v as unknown as Section)}/>
        </>:project&&selectedProject?<>
          <div className="visual-inspector-section-actions">
             <button type="button" onClick={()=>{if(window.confirm('Remove this case study from your draft?')){edit({...draft,projects:draft.projects.filter(p=>p.slug!==project.slug)});setSelected('projects');}}}>Delete case study</button>
          </div>
          <Field name="Case study" value={{...project,image:project.image||''} as unknown as Value}
            sectionType="project" onPickImage={pickImage} onChange={v=>updateProject(v as unknown as Project)}/>
        </>:<p>Select a section in the preview or the left panel to start editing.</p>}
        </div>
      </aside>
     </div>:<div className="visual-cms-loading">Loading your private draft…</div>}
     {mediaOpen&&<div className="visual-media-modal" role="dialog" aria-modal="true" aria-label="Media library"
       onMouseDown={e=>{if(e.target===e.currentTarget)closeMedia();}}>
       <div className="visual-media-panel"><header><div><h3>Media library</h3><p>Choose a screenshot or upload a new one · PNG, JPEG, WebP · 5 MB max.</p></div>
         <button type="button" onClick={closeMedia}>Close ×</button></header>
         <label className="visual-media-upload">Upload screenshot<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
            onChange={e=>{void uploadImage(e.target.files?.[0]);e.target.value='';}}/></label>
         {images.length?<div className="visual-media-grid">{images.map(img=><button type="button" key={img.filename} onClick={()=>selectImage(img.url)}>
           <img src={img.url} alt={'Uploaded screenshot '+img.filename} loading="lazy"/>
           <span>{img.filename}</span><small>{picker?'Choose image':'Copy image URL'}</small>
         </button>)}</div>:<p className="visual-help">No screenshots yet. Upload a real website or project screenshot to get started.</p>}
       </div>
     </div>}
  </section>;
}
