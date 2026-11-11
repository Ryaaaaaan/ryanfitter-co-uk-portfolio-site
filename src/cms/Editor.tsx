import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,KeyboardEvent as ReactKeyboardEvent,PointerEvent as ReactPointerEvent} from 'react';
import type {ButtonStyle,Link,SiteContent,Section} from './model';
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
 if(name==='links')return {label:'New link',href:'#contact'};
 if(name==='buttons')return {label:'New button',href:'#contact',variant:'outline'};
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
/** Sort inputs like the reader sees them: small eyebrow, large heading, copy,
 * then supporting elements. The original object keys remain unchanged on save. */
const contentFieldPriority=['eyebrow','index','descriptor','date','heading','client','emphasis','title',
  'body','paragraphs','summary','value','label','caption','items','image','imageSide',
  'skills','buttons','links','email','author','role','note','linkLabel','style',
  'enabled','id','type','slug'];
const orderedContentFields=(fields:Record<string,Value>,sectionType:string):[string,Value][]=>{
  const entries=Object.entries(fields);
  if(!sectionType)return entries;
  const rank=(key:string)=>{const idx=contentFieldPriority.indexOf(key);return idx<0?14:idx;};
  return entries.sort((a,b)=>rank(a[0])-rank(b[0]));
};
const blockColourPresets=[
 {name:'Inherit',background:'',text:'',accent:'',mutedColor:'',panelColor:'',borderColor:''},
 {name:'Paper',background:'#f7f8f3',text:'#172520',accent:'#24634b',mutedColor:'#52615a',panelColor:'#fffef9',borderColor:'#d9dfd5'},
 {name:'Forest',background:'#17372a',text:'#f2f8f2',accent:'#a9dcba',mutedColor:'#c2d9c7',panelColor:'#244735',borderColor:'#547461'},
 {name:'Slate',background:'#eff3f5',text:'#243449',accent:'#355c8a',mutedColor:'#586c7c',panelColor:'#ffffff',borderColor:'#c5d1da'},
 {name:'Dark',background:'#151e1d',text:'#ecf2ef',accent:'#66cf9e',mutedColor:'#b0c9bd',panelColor:'#22302c',borderColor:'#41554d'},
 {name:'Warm',background:'#fcf3e8',text:'#35271f',accent:'#a65c36',mutedColor:'#776257',panelColor:'#fffaf4',borderColor:'#e2ccb7'}
] as const;
function Field({
 value,onChange,name='Settings',sectionType='',onPickImage,anchorOptions=[]
}:{value:Value;onChange:(v:Value)=>void;name?:string;sectionType?:string;onPickImage:PickImage;
  anchorOptions?:{label:string;id:string}[]}){
 if(typeof value==='boolean')return <label className="visual-check"><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)}/><span>{pretty(name)}</span></label>;
 if(typeof value==='number'){
   const sliders:Record<string,[number,number,number,string]>={
     padding:[0,240,1,'px'],fontSize:[12,48,1,'px'],contentWidth:[320,1600,10,'px'],
     lineHeight:[0,3,.05,'×'],letterSpacing:[-8,12,.25,'px'],
     paragraphSpacing:[-1,90,1,'px'],bodyWeight:[0,900,100,''],
     headingSize:[0,160,1,'px'],headingLineHeight:[0,3,.05,'×'],
     headingLetterSpacing:[-12,12,.25,'px'],headingWeight:[0,900,100,''],
     statValueSize:[0,110,1,'px'],statLabelSize:[0,50,1,'px'],
     columns:[0,12,1,''],gap:[-1,160,1,'px'],
     split:[20,80,1,'%'],copyMaxWidth:[0,1200,10,'px']
   };
   const slider=sliders[name];
   if(slider){
     const [min,max,step,unit]=slider;
     const inherited=(name==='gap'||name==='paragraphSpacing')?value<0:
       ['lineHeight','headingLineHeight','headingSize','bodyWeight','headingWeight',
        'statValueSize','statLabelSize','columns','copyMaxWidth'].includes(name)&&value===0;
     return <div className="visual-field"><label htmlFor={'cms-setting-'+name}>{pretty(name)}</label>
       <div className="visual-number-line">
         <input id={'cms-setting-'+name} aria-label={pretty(name)} type="range" min={min} max={max}
           step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/>
         <input type="number" aria-label={pretty(name)+' exact value'} min={min} max={max} step={step}
           value={value} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(clamp(n,min,max));}}/>
         <output>{inherited?'Auto':value+unit}</output>
       </div>
       {(name==='gap'||name==='paragraphSpacing')&&<small>−1 = inherit design spacing; 0 = no spacing.</small>}
       {name==='columns'&&<small>0 = automatically divide available width between the items.</small>}
       {name==='headingSize'&&<small>0 = inherit the current heading scale.</small>}
     </div>;
   }
   return <label className="visual-field">{pretty(name)}
     <input type="number" value={value} onChange={e=>onChange(Number(e.target.value)||0)}/></label>;
 }
 if(typeof value==='string'){
   if(name==='id'||name==='type')return <p className="visual-readonly">{pretty(name)}: <code>{value}</code></p>;
   const options=name==='font'?['sans','serif','mono']:
     name==='align'?['left','center','right']:
     name==='imageSide'?['left','right']:
     name==='verticalAlign'?['start','center','end']:
     name==='alignment'?['left','center','right']:
     name==='variant'?['primary','outline','text']:null;
   if(options)return <label className="visual-field">{pretty(name)}<select value={value} onChange={e=>onChange(e.target.value)}>
     {options.map(o=><option key={o} value={o}>{pretty(o)}</option>)}
   </select></label>;
   if(name==='href')return <div className="visual-field visual-link-field">
     <label>Link destination</label>
     <select aria-label="Choose section to scroll to"
       value={anchorOptions.some(a=>(sectionType?'#':'/#')+a.id===value)?value:'custom'}
       onChange={e=>{if(e.target.value!=='custom')onChange(e.target.value);}}>
       <option value="custom">External URL, email or custom path</option>
       {anchorOptions.map(a=><option key={a.id} value={(sectionType?'#':'/#')+a.id}>
         Scroll to {a.label} ({(sectionType?'#':'/#')+a.id})
       </option>)}
     </select>
     <input aria-label="Link URL" value={value} onChange={e=>onChange(e.target.value)}
       placeholder="#contact or https://example.com"/>
     <small>Links starting with # scroll to that section when the site is published.</small>
   </div>;
   if(name==='image')return <div className="visual-field visual-image-field"><strong>Image</strong>
     {value?<img src={value} alt="Selected portfolio media" loading="lazy"/>:<div className="visual-image-empty">No image selected</div>}
     <div className="visual-button-row"><button type="button" onClick={()=>onPickImage(url=>onChange(url))}>{value?'Change image':'Choose image'}</button>
       {value&&<button type="button" onClick={()=>onChange('')}>Remove</button>}</div>
   </div>;
   const isColor=['background','text','muted','accent','panel','headingColor','bodyColor',
     'eyebrowColor','emphasisColor','mutedColor','panelColor','borderColor','primaryBackground','primaryText',
     'secondaryBackground','secondaryText','borderColor'].includes(name)
     &&(value===''||/^#[0-9a-fA-F]{6}$/.test(value));
   if(isColor)return <label className="visual-field">{pretty(name)}
     <div className="visual-colour-row"><input type="color" aria-label={pretty(name)+' colour'} value={/^#[0-9a-fA-F]{6}$/.test(value)?value:'#ffffff'} onChange={e=>onChange(e.target.value)}/>
       <input aria-label={pretty(name)+' hex value'} value={value} placeholder="Inherit" onChange={e=>onChange(e.target.value)}/></div>
     {value===''&&<small>Inherits the site theme</small>}
   </label>;
   const isHeading=['heading','emphasis','client','title'].includes(name);
   const multiline=isHeading||['body','description','summary','challenge','result','note','text','caption'].includes(name)||value.length>125;
   const displayLabel=name==='eyebrow'?'Headline (small)':
     name==='heading'?'Heading (large)':pretty(name);
   return <label className="visual-field">{displayLabel}
    {multiline?<textarea rows={isHeading?3:4} aria-label={pretty(name)} value={value} onChange={e=>onChange(e.target.value)}/>:
    <input value={value} onChange={e=>onChange(e.target.value)}/>}
    {isHeading&&<small>Press Enter to control where the heading breaks onto a new line.</small>}
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
       <Field value={item} name={typeof item==='object'?'Details':pretty(name)+' '+(i+1)} onChange={v=>onChange(value.map((x,j)=>j===i?v:x))} sectionType={sectionType} onPickImage={onPickImage} anchorOptions={anchorOptions}/>
     </div>)}
     <button type="button" className="visual-add-mini" onClick={()=>onChange([...value,newArrayItem(name,value,sectionType)])}>+ Add {name==='items'?'item':name==='links'?'link':'entry'}</button>
   </fieldset>;
 }
 const fields=(name==='Details'&&sectionType&&'href' in value)
   ?{...value,variant:value.variant||'primary'}:value;
 return <fieldset className="visual-fieldset"><legend>{pretty(name)}</legend>
  {orderedContentFields(fields,sectionType).map(([k,v])=><Field key={k} value={v} name={k} sectionType={sectionType} onPickImage={onPickImage} anchorOptions={anchorOptions} onChange={newValue=>onChange({...value,[k]:newValue})}/>)}
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
 function receive(s:Snapshot,initialLoad=false){
   setDraft(s.draft);setRevision(s.revision);setPublished(s.publishedRevision);setDirty(false);
   if(initialLoad){
     // A fresh visit should open the content, not the Templates chooser.
     // Save/publish responses never change the user's current selection.
     setPage('home');
     setSelected(s.draft.sections.find(section=>section.enabled)?.id
       ||s.draft.sections[0]?.id||'sections');
   }
 }
 async function load(){
   setBusy(true);
   try{
     const response=await fetch('/admin/api/cms',{cache:'no-store',credentials:'same-origin'});
     if(!response.ok)throw Error('Unable to load CMS. Check your private login.');
     receive(await response.json() as Snapshot,true);setError('');
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
 function changeAnchor(section:Section,newAnchor:string){
   if(!draft)return;
   const anchor=newAnchor.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-+/,'').slice(0,80);
   if(!anchor||!/^([a-z][a-z0-9-]*)$/.test(anchor)||['main','top'].includes(anchor)){
     setError('Anchor must begin with a letter and contain only lowercase letters, numbers or hyphens.');
     return;
   }
   if(draft.sections.some(s=>s.id!==section.id&&(s.anchor||s.id)===anchor)){
     setError('Another section already uses #'+anchor+'. Choose a unique anchor.');
     return;
   }
   const previous=section.anchor||section.id;
   const retarget=(link:Link):Link=>
     link.href==='#'+previous?{...link,href:'#'+anchor}:
     link.href==='/#'+previous?{...link,href:'/#'+anchor}:link;
   const sections=draft.sections.map(s=>({
     ...s,
     ...(s.id===section.id?{anchor}:{}),
     ...(s.buttons?{buttons:s.buttons.map(retarget)}:{})
   }));
   edit({...draft,sections,
     header:{...draft.header,links:draft.header.links.map(retarget)},
     footer:{...draft.footer,links:draft.footer.links.map(retarget)}
   });
   setMessage('Section address is #'+anchor+'. Existing matching links were updated.');
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
 function addProject(openIn:Page='projects'){
   if(!draft||!starterSite.projects[0])return;
   const project=clone(starterSite.projects[0]);
   project.slug='project-'+Date.now();project.number=String(draft.projects.length+1).padStart(2,'0');
   project.client='New project';project.title='My new case study';
   project.image='';project.note='';
   project.cardSummary='Write a short introduction to this project.';
   project.cardMetricValue='';project.cardMetricLabel='';
   project.cardVisible=true;
   edit({...draft,projects:[...draft.projects,project]});select('project:'+project.slug,openIn);
 }
 function moveProject(from:number,to:number){
   if(!draft||from<0||to<0||from>=draft.projects.length||to>=draft.projects.length||from===to)return;
   const projects=[...draft.projects];const [item]=projects.splice(from,1);projects.splice(to,0,item);
   edit({...draft,projects});
 }
 const anchorOptions=(draft?.sections||[]).filter(s=>s.enabled).map(s=>({
   id:s.anchor||s.id,label:s.heading||s.eyebrow||sectionNames[s.type]||s.type
 }));
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
          <button className="visual-add-project" onClick={()=>addProject()}>+ Add case study</button>
        </>}
        <p className="visual-rail-caption">PAGE TEMPLATES</p>
        <details className="visual-sidebar-templates">
          <summary>▦ <span>Switch page template</span></summary>
          <div className="visual-sidebar-template-options">
            <p>Replace your current draft with a starter. Your public site won't change until you publish.</p>
            <button type="button" onClick={()=>useTemplate(starterSite)}>
              <strong>Professional portfolio</strong>
              <small>Hero, case studies, expertise and contact</small>
            </button>
            <button type="button" onClick={()=>useTemplate(blankSite)}>
              <strong>Blank slate</strong>
              <small>A simple introduction</small>
            </button>
          </div>
        </details>
        <p className="visual-rail-caption">SITE SETTINGS</p>
        <div className="visual-rail-settings">
          {(['theme','header','footer','projects','metadata','media'] as const).map(key=><button key={key}
            className={selected===key?'active':''} onClick={()=>{setPage(key==='projects'?'projects':'home');inspect(key);}}>
            {key==='media'?'Media library':key==='projects'?'Case studies':pretty(key)}
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
                  <PortfolioSection section={s} site={draft}
                    onEditProject={s.type==='projects'?slug=>select('project:'+slug,'home'):undefined}
                    selectedProjectSlug={s.type==='projects'&&page==='home'?project?.slug:undefined}/>
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
          <h3>No section selected</h3>
          <p className="visual-help">Select a section in the sidebar or click the preview to edit it. To change your starter, use Page templates in the left sidebar.</p>
        </>:selected==='media'?<>
          <h3>Media library</h3><p>Upload your own screenshots to the private library. Published pages can display selected images.</p>
          <button className="visual-upload-button" onClick={()=>openMedia()}>Open image library / upload</button>
          <p>{images.length} images in your library.</p>
        </>:selected==='metadata'?<>
          <Field name="Page title" value={draft.title} onChange={v=>edit({...draft,title:v as string})} onPickImage={pickImage} anchorOptions={anchorOptions}/>
          <Field name="Description" value={draft.description} onChange={v=>edit({...draft,description:v as string})} onPickImage={pickImage} anchorOptions={anchorOptions}/>
        </>:selected==='theme'||selected==='header'||selected==='footer'?<>
          {selected==='theme'&&<div className="visual-presets"><strong>Colour presets</strong>
            {[
              {name:'Forest',background:'#f7f8f3',text:'#172520',muted:'#52615a',accent:'#24634b',panel:'#fffef9'},
              {name:'Slate',background:'#f2f4f7',text:'#17253c',muted:'#596575',accent:'#2457a7',panel:'#ffffff'},
              {name:'Dark',background:'#151e1d',text:'#ecf2ef',muted:'#a9b7b0',accent:'#66cf9e',panel:'#22302c'}
            ].map(preset=><button type="button" key={preset.name} onClick={()=>edit({...draft,theme:{...draft.theme,...preset}})}>{preset.name}</button>)}
          </div>}
          <Field value={draft[selected as 'theme'|'header'|'footer'] as unknown as Value} onChange={v=>edit({...draft,[selected]:v})} name={pretty(selected)} onPickImage={pickImage} anchorOptions={anchorOptions}/>
        </>:selected==='projects'?<>
          <h3>Case studies</h3><p>Select a project on the left or click Add case study to create a new draft page.</p>
          <button onClick={()=>addProject()}>+ Add case study</button>
        </>:section?<>
          {section.type==='projects'&&<div className="visual-portfolio-card-manager">
            <strong>Portfolio card display</strong>
            <p>Choose how the cards appear on your homepage. This also controls the published layout.</p>
            <div className="visual-card-layout-toggle" role="group" aria-label="Portfolio card layout">
              {(['grid','list'] as const).map(view=><button key={view} type="button"
                aria-pressed={(section.layout?.view||'grid')===view}
                onClick={()=>updateSection({...section,layout:{...section.layout,view}})}>
                {view==='grid'?'▦ Grid':'☰ List'}
              </button>)}
            </div>
            <p className="visual-portfolio-card-count">
              {draft.projects.filter(p=>p.cardVisible!==false).length} visible cards
            </p>
            <div className="visual-portfolio-card-list">
              {draft.projects.map((p,index)=><div key={p.slug} className="visual-portfolio-card-row">
                <button type="button" className="visual-card-select"
                  onClick={()=>select('project:'+p.slug,'home')}>{p.client}
                  {p.cardVisible===false&&<small>Hidden</small>}
                </button>
                <button type="button" title={'Move '+p.client+' up'} disabled={index===0}
                  onClick={()=>moveProject(index,index-1)}>↑</button>
                <button type="button" title={'Move '+p.client+' down'} disabled={index===draft.projects.length-1}
                  onClick={()=>moveProject(index,index+1)}>↓</button>
              </div>)}
            </div>
            <button type="button" className="visual-add-mini"
              onClick={()=>addProject('home')}>+ Add portfolio card</button>
            <small>Select a card here or click one in the live preview to edit its content.</small>
          </div>}
          <div className="visual-inspector-section-actions">
            <button type="button" onClick={()=>updateSection({...section,enabled:!section.enabled})}>{section.enabled?'Hide section':'Show section'}</button>
            <button type="button" onClick={()=>duplicateSection(draft.sections.indexOf(section))}>Duplicate</button>
            <button type="button" onClick={()=>removeSection(draft.sections.indexOf(section))}>Delete</button>
          </div>
          <div className="visual-anchor-controls">
            <label htmlFor="cms-section-anchor">Section anchor for links</label>
            <div className="visual-anchor-input"><span>#</span>
              <input id="cms-section-anchor" value={section.anchor||section.id}
                aria-label="Section anchor" onChange={e=>changeAnchor(section,e.target.value)}/>
            </div>
            <small>Use #{section.anchor||section.id} in buttons and navigation. Existing links update when this changes.</small>
          </div>
          <Field value={{...Object.fromEntries(Object.entries(section).filter(([key])=>!['layout','anchor','buttonStyle'].includes(key))),
             image:section.image||'',
             style:{
               background:section.style.background,text:section.style.text,accent:section.style.accent,
               padding:section.style.padding,fontSize:section.style.fontSize,align:section.style.align
             }} as Value}
             name={sectionNames[section.type]||section.type} sectionType={section.type}
             onPickImage={pickImage} anchorOptions={anchorOptions} onChange={v=>{const next=v as unknown as Section;
               updateSection({...section,...next,style:{...section.style,...next.style}});
             }}/>
          <fieldset className="visual-block-theme-presets">
            <legend>Block theme</legend>
            <p>Apply a colour palette just to this section. Fine-tune colours below.</p>
            <div className="visual-block-preset-grid" role="group" aria-label="Block colour presets">
              {blockColourPresets.map(preset=>{
                const active=Object.entries(preset).every(([key,value])=>
                  key==='name'||(section.style as unknown as Record<string,string>)[key]===value
                  ||((section.style as unknown as Record<string,string>)[key]===undefined&&value===''));
                return <button key={preset.name} type="button"
                  aria-label={'Block theme '+preset.name} aria-pressed={active}
                  onClick={()=>{
                    const clearText={headingColor:'',bodyColor:'',eyebrowColor:'',emphasisColor:''};
                    const {name,...colours}=preset;
                    updateSection({...section,style:{...section.style,...clearText,...colours}});
                  }}>
                  <span className="visual-block-preset-swatch"
                    style={{background:preset.background||draft.theme.background,
                      color:preset.text||draft.theme.text,
                      borderColor:preset.borderColor||draft.theme.muted}}>
                    <i style={{background:preset.accent||draft.theme.accent}}/>
                    Aa
                  </span>
                  <span>{preset.name}</span>
                </button>;
              })}
            </div>
          </fieldset>
          <p className="visual-inspector-help">These optional overrides apply to the selected block only. Leave colours empty to inherit the theme.</p>
          <Field name="Individual text colours" sectionType={section.type} onPickImage={pickImage} anchorOptions={anchorOptions}
            value={{
              headingColor:section.style.headingColor||'',
              bodyColor:section.style.bodyColor||'',
              eyebrowColor:section.style.eyebrowColor||'',
              emphasisColor:section.style.emphasisColor||'',
              mutedColor:section.style.mutedColor||'',
              panelColor:section.style.panelColor||'',
              borderColor:section.style.borderColor||''
            } as Value}
            onChange={v=>updateSection({...section,style:{...section.style,...(v as object)}})}/>
          {!!section.buttons?.length&&<Field name="Button styles" sectionType={section.type} onPickImage={pickImage} anchorOptions={anchorOptions}
            value={{
              alignment:section.buttonStyle?.alignment||'right',
              radius:section.buttonStyle?.radius??5,
              paddingX:section.buttonStyle?.paddingX??19,
              paddingY:section.buttonStyle?.paddingY??15,
              gap:section.buttonStyle?.gap??26,
              primaryBackground:section.buttonStyle?.primaryBackground||'',
              primaryText:section.buttonStyle?.primaryText||'',
              secondaryBackground:section.buttonStyle?.secondaryBackground||'',
              secondaryText:section.buttonStyle?.secondaryText||'',
              borderColor:section.buttonStyle?.borderColor||''
            } as Value}
            onChange={v=>updateSection({...section,buttonStyle:{...section.buttonStyle,...(v as ButtonStyle)}})}/>}
          <p className="visual-inspector-help">Typography controls update the live preview and published site. Zero inherits the original design unless indicated.</p>
           <Field name="Typography & text spacing" sectionType={section.type} onPickImage={pickImage} anchorOptions={anchorOptions}
             value={{
               lineHeight:section.style.lineHeight??0,
               letterSpacing:section.style.letterSpacing??0,
               paragraphSpacing:section.style.paragraphSpacing??-1,
               bodyWeight:section.style.bodyWeight??0,
               headingSize:section.style.headingSize??0,
               headingLineHeight:section.style.headingLineHeight??0,
               headingLetterSpacing:section.style.headingLetterSpacing??0,
               headingWeight:section.style.headingWeight??0,
               ...(section.type==='stats'?{
                 statValueSize:section.style.statValueSize??0,
                 statLabelSize:section.style.statLabelSize??0
               }:{})
             } as Value}
             onChange={v=>updateSection({...section,style:{...section.style,...(v as object)}})}/>
           <Field name="Layout & spacing" sectionType={section.type} onPickImage={pickImage} anchorOptions={anchorOptions}
             value={{
               ...(['stats','projects','expertise','about','gallery'].includes(section.type)
                 ?{columns:section.layout?.columns??0}:{}),
               gap:section.layout?.gap??-1,
               ...(['about','image_text','projects','expertise'].includes(section.type)
                 ?{split:section.layout?.split??50}:{}),
               ...(['about','image_text','cta','projects','expertise'].includes(section.type)
                 ?{verticalAlign:section.layout?.verticalAlign??'start'}:{}),
               ...(section.type==='about'?{copyMaxWidth:section.layout?.copyMaxWidth??0}:{})
             } as Value}
             onChange={v=>updateSection({...section,layout:{...section.layout,...(v as object)}})}/>
         </>:project&&selectedProject&&page==='home'?<>
          <div className="visual-card-editor">
            <p className="visual-help">Editing this homepage card. Name, category and dates are shared with its case-study page; the card description, metric and button label can be different.</p>
            <button type="button" className="visual-back-button" onClick={()=>
              select(draft.sections.find(s=>s.type==='projects')?.id||'sections','home')}>
              ← Portfolio layout & card order
            </button>
            <label className="visual-check"><input type="checkbox" checked={project.cardVisible!==false}
              onChange={e=>updateProject({...project,cardVisible:e.target.checked})}/>
              Show this card on the homepage</label>
            <label className="visual-field">Headline / category (small)
              <input aria-label="Card category" value={project.descriptor}
                onChange={e=>updateProject({...project,descriptor:e.target.value})}/></label>
            <label className="visual-field">Dates
              <input aria-label="Card dates" value={project.date}
                onChange={e=>updateProject({...project,date:e.target.value})}/></label>
            <label className="visual-field">Project heading (large)
              <textarea aria-label="Card project name" rows={2} value={project.client}
                onChange={e=>updateProject({...project,client:e.target.value})}/>
              <small>Press Enter for a new heading line.</small></label>
            <label className="visual-field">Card description
              <textarea aria-label="Card description" rows={3}
                value={project.cardSummary??project.title}
                onChange={e=>updateProject({...project,cardSummary:e.target.value})}/></label>
            <label className="visual-field">Highlight / result
              <input aria-label="Card result value" value={project.cardMetricValue??project.facts[0]?.value??''}
                onChange={e=>updateProject({...project,cardMetricValue:e.target.value})}/></label>
            <label className="visual-field">Result caption
              <input aria-label="Card result caption" value={project.cardMetricLabel??project.facts[0]?.label??''}
                onChange={e=>updateProject({...project,cardMetricLabel:e.target.value})}/></label>
            <label className="visual-field">Card link text
              <input aria-label="Card link label" value={project.cardLinkLabel??draft.sections.find(s=>s.type==='projects')?.linkLabel??'Case study'}
                onChange={e=>updateProject({...project,cardLinkLabel:e.target.value})}/></label>
            <Field name="image" value={project.image||''} onPickImage={pickImage}
              onChange={v=>updateProject({...project,image:v as string})}/>
            <div className="visual-card-editor-actions">
              <button type="button" onClick={()=>{
                const original={...project};
                delete original.cardSummary;delete original.cardMetricValue;
                delete original.cardMetricLabel;delete original.cardLinkLabel;
                updateProject(original);
              }}>Reset card text to case study</button>
              <button type="button" onClick={()=>select('project:'+project.slug,'projects')}>
                Edit full case-study page ↗
              </button>
            </div>
          </div>
        </>:project&&selectedProject?<>
          <div className="visual-inspector-section-actions">
             <button type="button" onClick={()=>{if(window.confirm('Remove this case study from your draft?')){edit({...draft,projects:draft.projects.filter(p=>p.slug!==project.slug)});setSelected('projects');}}}>Delete case study</button>
          </div>
          <Field name="Case study" value={{...project,image:project.image||''} as unknown as Value}
            sectionType="project" onPickImage={pickImage} anchorOptions={anchorOptions} onChange={v=>updateProject(v as unknown as Project)}/>
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
