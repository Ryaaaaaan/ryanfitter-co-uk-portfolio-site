import {useEffect,useMemo,useState} from "react";
import {PageShell} from "../components/PageShell";

type StoredBreeder={id:string;name:string;ivs:string[];note:string;used:boolean};
const ivs=["HP","Attack","Defence","Sp. Attack","Sp. Defence","Speed"];

export function PokeMMOBreedingTrackerPage(){
  const [breeders,setBreeders]=useState<StoredBreeder[]>([]);
  const [name,setName]=useState("");
  const [note,setNote]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{try{const saved=localStorage.getItem("pokemmo-breeder-box");if(saved)setBreeders(JSON.parse(saved))}catch{}finally{setLoaded(true)}},[]);
  useEffect(()=>{if(loaded)localStorage.setItem("pokemmo-breeder-box",JSON.stringify(breeders))},[loaded,breeders]);
  const available=useMemo(()=>breeders.filter(b=>!b.used).length,[breeders]);
  const single31=useMemo(()=>breeders.filter(b=>!b.used&&b.ivs.length===1).length,[breeders]);

  function addBreeder(){
    if(!selected.length)return;
    setBreeders(v=>[{id:crypto.randomUUID(),name:name.trim()||"Breeder",ivs:[...selected],note:note.trim(),used:false},...v]);
    setName("");setNote("");setSelected([]);
  }

  return <PageShell className="pokemon pokemon-tool-page breeder-tracker">
    <p className="eyebrow"><a href="/pokemon/pokemmo-breeding">← PokeMMO Breeding</a></p>
    <h1>Breeder Box</h1>
    <p className="muted">Keep a lightweight local inventory of breeders you already own. Nothing leaves this browser. Available 1×31 entries automatically reduce the calculator shopping estimate.</p>
    <section className="calculator-section">
      <h2>Add breeder</h2>
      <div className="tracker-fields"><label>Name / species<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Rhyhorn"/></label><label>Note<input value={note} onChange={e=>setNote(e.target.value)} placeholder="egg group, gender, etc."/></label></div>
      <div className="iv-grid">{ivs.map(iv=><label className="iv-target" key={iv}><input type="checkbox" checked={selected.includes(iv)} onChange={()=>setSelected(v=>v.includes(iv)?v.filter(x=>x!==iv):[...v,iv])}/><span>{iv}</span><strong>{selected.includes(iv)?"31":"—"}</strong></label>)}</div>
      <button className="tracker-add" type="button" disabled={!selected.length} onClick={addBreeder}>Add to box</button>
    </section>
    <section className="calculator-section">
      <h2>Stored breeders</h2>
      <p className="muted">{available} available · {single31} usable as base 1×31 breeders · {breeders.length-available} used</p>
      {!breeders.length?<div className="tool-placeholder">No breeders stored yet.</div>:<div className="breeder-box">{breeders.map(b=><article className={b.used?"stored-breeder is-used":"stored-breeder"} key={b.id}><div><strong>{b.name}</strong><span>{b.ivs.map(iv=>`31 ${iv}`).join(" · ")}</span>{b.note&&<small>{b.note}</small>}</div><div className="stored-actions"><button type="button" onClick={()=>setBreeders(v=>v.map(x=>x.id===b.id?{...x,used:!x.used}:x))}>{b.used?"Restore":"Mark used"}</button><button type="button" onClick={()=>setBreeders(v=>v.filter(x=>x.id!==b.id))}>Remove</button></div></article>)}</div>}
    </section>
  </PageShell>
}
