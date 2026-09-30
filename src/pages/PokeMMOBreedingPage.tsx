import {useMemo,useState} from "react";
import {PageShell} from "../components/PageShell";

const stats=["HP","Attack","Defence","Sp. Attack","Sp. Defence","Speed"] as const;
type Stat=typeof stats[number];

export function PokeMMOBreedingPage(){
  const [targets,setTargets]=useState<Record<Stat,boolean>>({HP:true,Attack:true,Defence:true,"Sp. Attack":false,"Sp. Defence":true,Speed:true});
  const [genderCost,setGenderCost]=useState(5000);
  const selected=useMemo(()=>stats.filter(stat=>targets[stat]),[targets]);
  const perfectCount=selected.length;
  const baseParents=perfectCount>0?2**(perfectCount-1):0;
  const breedCount=baseParents>0?baseParents-1:0;
  const braceCount=breedCount*2;
  const braceCost=braceCount*10000;

  return <PageShell className="pokemon pokemon-tool-page breeding-page">
    <p className="eyebrow"><a href="/pokemon">← Pokémon tools</a></p>
    <h1>PokeMMO Breeding</h1>
    <p className="muted">Choose the 31 IVs you want on the finished Pokémon. This first planner pass lays out the size of the breeding chain.</p>

    <section className="calculator-section">
      <h2>Target IVs</h2>
      <div className="iv-grid">
        {stats.map(stat=><label className="iv-target" key={stat}>
          <input type="checkbox" checked={targets[stat]} onChange={()=>setTargets(current=>({...current,[stat]:!current[stat]}))}/>
          <span>{stat}</span><strong>{targets[stat]?"31":"—"}</strong>
        </label>)}
      </div>
    </section>

    <section className="calculator-section">
      <h2>Breeding plan</h2>
      {perfectCount===0?<p className="muted">Select at least one target IV.</p>:
      <div className="plan-summary">
        <div><span>Target</span><strong>{perfectCount}×31</strong></div>
        <div><span>Base 1×31 parents</span><strong>{baseParents}</strong></div>
        <div><span>Breeds in chain</span><strong>{breedCount}</strong></div>
      </div>}
      <div className="cost-controls"><label>Gender selection assumption <select value={genderCost} onChange={e=>setGenderCost(Number(e.target.value))}><option value={0}>Exclude</option><option value={5000}>₽5,000</option><option value={9000}>₽9,000</option><option value={21000}>₽21,000</option></select></label></div><div className="plan-summary cost-summary"><div><span>{braceCount} braces</span><strong>₽{braceCost.toLocaleString()}</strong></div><div><span>Gender selections*</span><strong>₽{(breedCount*genderCost).toLocaleString()}</strong></div><div><span>Planning subtotal</span><strong>₽{(braceCost+breedCount*genderCost).toLocaleString()}</strong></div></div><p className="calculator-note">*Conservative estimate. Efficient chains may not need paid gender selection on every breed. Breeder prices, Poké Balls, nature/Everstones and egg moves are not included yet.</p>
    </section>
  </PageShell>
}
