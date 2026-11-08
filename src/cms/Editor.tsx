import {useEffect,useState} from 'react';
import type {SiteContent,Section} from './model';
import {blankSite,starterSite,clone} from './model';
import {PortfolioChrome} from '../components/PortfolioChrome';
import {PortfolioSection} from './Sections';
import './editor.css';
type Value=string|number|boolean|Value[]|{[key:string]:Value};
type Snapshot={draft:SiteContent;revision:number;publishedRevision:number};
const label=(s:string)=>s.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase());
const empty=(value:Value):Value=>typeof value==='string'?'':typeof value==='number'?value:typeof value==='boolean'?value:Array.isArray(value)?[]:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,empty(v)]));
const arraySeed=(name:string,value:Value[],sectionType:string):Value=>{
  if(value.length)return empty(value[value.length-1]);
  if(name==='links'||name==='buttons')return {label:'New link',href:'/'};
  if(name==='projects')return {...clone(starterSite.projects[0]),slug:'new-project-'+Date.now(),client:'New project'} as unknown as Value;
  if(name==='facts')return {value:'',label:''};
  if(name==='items')return sectionType==='stats'?{value:'',label:''}:{heading:'',body:''};
  return '';
};
function Fields({value,onChange,name='Settings',sectionType=''}:{value:Value;onChange:(v:Value)=>void;name?:string;sectionType?:string}){
  if(typeof value==='boolean')return <label className="cms-check"><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)}/>{label(name)}</label>;
  if(typeof value==='number')return <label>{label(name)}<input type="number" value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
  if(typeof value==='string'){
    const options=name==='font'?['sans','serif','mono']:name==='align'?['left','center','right']:null;
    if(options)return <label>{label(name)}<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></label>;
    if(name==='id')return <p className="cms-help">Anchor: #{value}</p>;
    if(name==='type')return <p className="cms-help">Component: {value}</p>;
    return <label>{label(name)}{['body','description','summary','challenge','result','note','text'].includes(name)||value.length>120?<textarea value={value} rows={3} onChange={e=>onChange(e.target.value)}/>:<input value={value} onChange={e=>onChange(e.target.value)}/>}</label>;
  }
  if(Array.isArray(value))return <fieldset><legend>{label(name)}</legend>{value.map((item,i)=><div className="cms-array-item" key={i}><Fields sectionType={sectionType} name={typeof item==='object'?String(i+1):label(name)+' '+(i+1)} value={item} onChange={v=>onChange(value.map((x,j)=>j===i?v:x))}/><div className="cms-row"><button type="button" disabled={i===0} onClick={()=>{const a=[...value];[a[i-1],a[i]]=[a[i],a[i-1]];onChange(a);}}>↑</button><button type="button" disabled={i===value.length-1} onClick={()=>{const a=[...value];[a[i],a[i+1]]=[a[i+1],a[i]];onChange(a);}}>↓</button><button type="button" onClick={()=>onChange(value.filter((_,j)=>j!==i))}>Remove item</button></div></div>)}<button type="button" onClick={()=>onChange([...value,arraySeed(name,value,sectionType)])}>+ Add item</button></fieldset>;
  return <fieldset><legend>{label(name)}</legend>{Object.entries(value).map(([key,v])=><Fields sectionType={sectionType} key={key} name={key} value={v} onChange={updated=>onChange({...value,[key]:updated})}/>)}</fieldset>;
}
export function CmsEditor({csrf}:{csrf:string}){
  const [draft,setDraft]=useState<SiteContent|null>(null),[revision,setRevision]=useState(0),[published,setPublished]=useState(0),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState(false),[selected,setSelected]=useState('sections');
  function receive(s:Snapshot){setDraft(s.draft);setRevision(s.revision);setPublished(s.publishedRevision);setDirty(false);}
  async function load(){setBusy(true);try{const r=await fetch('/admin/api/cms',{cache:'no-store'});if(!r.ok)throw Error('Unable to load CMS. Check your session and backend deployment.');receive(await r.json());setError('');}catch(e){setError(String(e));}finally{setBusy(false);}}
  useEffect(()=>{void load();},[]);
  useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return ()=>window.removeEventListener('beforeunload',guard);},[dirty]);
  function edit(next:SiteContent){setDraft(next);setDirty(true);setMessage('');}
  async function write(publish:boolean){
    if(!draft)return;
    setBusy(true);setError('');setMessage('');
    try{
      const request=async(path:string,body:unknown,method:string)=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to save. Sign in again if your session expired.');return data as Snapshot;};
      let saved=await request('/admin/api/cms',{document:draft,revision},'PUT');
      receive(saved);
      if(publish){saved=await request('/admin/api/cms/publish',{revision:saved.revision},'POST');receive(saved);}
      setMessage(publish?'Published. Your homepage and case studies are updated.':'Draft saved. Your public website has not changed.');
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  function replace(site:SiteContent){if(window.confirm('Replace the editor draft? The public website will not change until you publish.')){edit(clone(site));setSelected('sections');}}
  const active=draft?.sections.find(s=>s.id===selected);
  function updateSection(next:Section,index:number){if(draft)edit({...draft,sections:draft.sections.map((s,i)=>i===index?next:s)});}
  return <section className="cms-editor"><div className="cms-toolbar"><div><h2>Portfolio CMS</h2><p>Save a draft, preview it, then publish when ready.</p></div><div className="cms-row"><button disabled={!draft||busy} onClick={()=>setPreview(!preview)}>{preview?'Edit content':'Preview draft'}</button><button disabled={!draft||busy} onClick={()=>void write(false)}>Save draft</button><button className="cms-primary" disabled={!draft||busy} onClick={()=>void write(true)}>Save & publish</button></div></div>
    <p className="cms-help">{busy?'Working…':dirty?'Unsaved changes':`Saved revision ${revision} · Published revision ${published}`}</p>
    {error&&<div className="cms-error" role="alert">{error} <button onClick={()=>{if(!dirty||window.confirm('Discard unsaved edits and reload?'))void load();}}>Reload saved draft</button></div>}{message&&<p role="status">{message}</p>}
    {draft&&(preview?<div className="cms-preview"><p className="cms-help">Draft preview — not published. <button onClick={()=>setPreview(false)}>Back to editor</button></p><PortfolioChrome site={draft}><main id="main">{draft.sections.filter(s=>s.enabled).map(s=><PortfolioSection key={s.id} section={s} site={draft}/>)}</main></PortfolioChrome></div>:<div className="cms-layout"><aside className="cms-components"><h3>Page settings</h3>{['sections','theme','header','footer','projects','metadata'].map(key=><button key={key} aria-pressed={selected===key} onClick={()=>setSelected(key)}>{label(key)}</button>)}<h3>Components</h3>{draft.sections.map((s,i)=><div key={i} className="cms-component"><button aria-pressed={selected===s.id} onClick={()=>setSelected(s.id)}>{s.heading||s.type}{!s.enabled?' (hidden)':''}</button><div className="cms-row"><button aria-label="Move section up" disabled={!i} onClick={()=>{const a=[...draft.sections];[a[i-1],a[i]]=[a[i],a[i-1]];edit({...draft,sections:a});}}>↑</button><button aria-label="Move section down" disabled={i===draft.sections.length-1} onClick={()=>{const a=[...draft.sections];[a[i],a[i+1]]=[a[i+1],a[i]];edit({...draft,sections:a});}}>↓</button><button onClick={()=>{edit({...draft,sections:draft.sections.filter((_,j)=>j!==i)});setSelected('sections');}}>Remove</button></div></div>)}<h3>Add component</h3>{[...starterSite.sections,blankSite.sections[0]].map(s=><button key={s.type} onClick={()=>{const next=clone(s);next.id=s.type+'-'+Date.now();edit({...draft,sections:[...draft.sections,next]});setSelected(next.id);}}>+ {label(s.type)}</button>)}<hr/><button onClick={()=>replace(starterSite)}>Load original portfolio into draft</button><button onClick={()=>replace(blankSite)}>Reset draft to blank slate</button></aside><div className="cms-fields" key={selected}>
      {selected==='sections'?<><h3>Build your homepage</h3><p>Add a component on the left, then change its text and styling. Reorder it with the arrows or uncheck Enabled to hide it.</p><p>Colours use six-digit hex values, for example #24634b. Leave component colours empty to inherit the theme. Spacing and font sizes are in pixels.</p><p>The original portfolio is available as a starter. Loading it only changes your draft.</p></>:selected==='metadata'?<><Fields name="title" value={draft.title} onChange={v=>edit({...draft,title:v as string})}/><Fields name="description" value={draft.description} onChange={v=>edit({...draft,description:v as string})}/></>:active?<Fields sectionType={active.type} value={active as unknown as Value} name={active.type} onChange={v=>{const next=v as unknown as Section;updateSection(next,draft.sections.indexOf(active));if(next.id!==active.id)setSelected(next.id);}}/>:['theme','header','footer','projects'].includes(selected)?<Fields name={selected} value={draft[selected as 'theme'] as unknown as Value} onChange={v=>edit({...draft,[selected]:v})}/>:null}
    </div></div>)}
  </section>;
}
