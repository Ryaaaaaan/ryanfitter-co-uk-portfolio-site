import {useEffect,useMemo,useState} from "react";
import {PageShell} from "../components/PageShell";

const stats=["HP","Attack","Defence","Sp. Attack","Sp. Defence","Speed"] as const;
type Stat=typeof stats[number];

type Recipe={tier:number;left:Stat[];right:Stat[];result:Stat[];leftBrace:Stat;rightBrace:Stat};
type StoredBreeder={id:string;name:string;ivs:string[];note:string;used:boolean};
function makeRecipes(target:Stat[]):Recipe[]{
  const recipes:Recipe[]=[];
  for(let size=2;size<=target.length;size++){
    for(let start=0;start<=target.length-size;start++){
      const result=target.slice(start,start+size);
      const left=result.slice(0,-1);
      const right=result.slice(1);
      recipes.push({tier:size,left,right,result,leftBrace:left[0],rightBrace:right[right.length-1]});
    }
  }
  return recipes;
}

export function PokeMMOBreedingPage(){
  const [targets,setTargets]=useState<Record<Stat,boolean>>({HP:true,Attack:true,Defence:true,"Sp. Attack":false,"Sp. Defence":true,Speed:true});
  const [genderCost,setGenderCost]=useState(5000);
  const [nature,setNature]=useState(false);
  const [settingsLoaded,setSettingsLoaded]=useState(false);
  const [showRecipe,setShowRecipe]=useState(true);
  const [ownedBreeders,setOwnedBreeders]=useState<StoredBreeder[]>([]);
  const [natureName,setNatureName]=useState("Adamant");
  const [everstoneCost,setEverstoneCost]=useState(5000);
  const [breederPrices,setBreederPrices]=useState<Record<Stat,number>>(()=>Object.fromEntries(stats.map(stat=>[stat,8000])) as Record<Stat,number>);
  const selected=useMemo(()=>stats.filter(stat=>targets[stat]),[targets]);
  const perfectCount=selected.length;
  const baseParents=perfectCount>0?2**(perfectCount-1):0;
  const breedCount=baseParents>0?baseParents-1:0;
  const braceCount=perfectCount>1?breedCount*2:0;
  const braceCost=braceCount*10000;
  const natureBreeds=nature&&perfectCount>0?perfectCount-1:0;
  const natureCost=natureBreeds*everstoneCost;
  const baseStatCounts=useMemo(()=>{
    const counts=Object.fromEntries(stats.map(stat=>[stat,0])) as Record<Stat,number>;
    if(!selected.length)return counts;
    for(let start=0;start<baseParents;start++){
      const stat=selected[Math.min(selected.length-1,Math.floor(Math.log2(start+1)))];
      counts[stat]++;
    }
    // The recursive overlap tree has binomial leaf multiplicities.
    selected.forEach((stat,index)=>{
      let n=perfectCount-1,k=index,value=1;
      for(let i=1;i<=k;i++)value=value*(n-k+i)/i;
      counts[stat]=Math.round(value);
    });
    return counts;
  },[selected,perfectCount,baseParents]);
  const ownedBaseCounts=useMemo(()=>{
    const counts=Object.fromEntries(stats.map(stat=>[stat,0])) as Record<Stat,number>;
    ownedBreeders.filter(b=>!b.used&&b.ivs.length===1&&stats.includes(b.ivs[0] as Stat)).forEach(b=>counts[b.ivs[0] as Stat]++);
    return counts;
  },[ownedBreeders]);
  const missingStatCounts=useMemo(()=>Object.fromEntries(stats.map(stat=>[stat,Math.max(0,baseStatCounts[stat]-ownedBaseCounts[stat])])) as Record<Stat,number>,[baseStatCounts,ownedBaseCounts]);
  const breederCost=selected.reduce((sum,stat)=>sum+(missingStatCounts[stat]*breederPrices[stat]),0);
  const genderTotal=perfectCount>1?breedCount*genderCost:0;
  const fixedTotal=braceCost+genderTotal+natureCost;
  const estimatedTotal=fixedTotal+breederCost;
  const recipes=useMemo(()=>makeRecipes(selected),[selected]);

  useEffect(()=>{
    try{const box=localStorage.getItem("pokemmo-breeder-box");if(box)setOwnedBreeders(JSON.parse(box))}catch{}
    const saved=localStorage.getItem("pokemmo-breeding-settings");
    if(!saved){setSettingsLoaded(true);return;}
    try{
      const data=JSON.parse(saved);
      if(data.genderCost!==undefined)setGenderCost(data.genderCost);
      if(data.everstoneCost!==undefined)setEverstoneCost(data.everstoneCost);
      if(data.natureName)setNatureName(data.natureName);
      if(data.breederPrices)setBreederPrices(current=>({...current,...data.breederPrices}));
    }catch{}
    finally{setSettingsLoaded(true)}
  },[]);
  useEffect(()=>{if(settingsLoaded)localStorage.setItem("pokemmo-breeding-settings",JSON.stringify({genderCost,everstoneCost,natureName,breederPrices}))},[settingsLoaded,genderCost,everstoneCost,natureName,breederPrices]);

  return <PageShell className="pokemon pokemon-tool-page breeding-page">
    <p className="eyebrow"><a href="/pokemon">← Pokémon tools</a></p>
    <h1>PokeMMO Breeding</h1>
    <p className="muted">Choose the 31 IVs you want on the finished Pokémon. The planner builds the breeding chain and estimates its cost.</p>

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
      {perfectCount>1&&<><button className="recipe-toggle" type="button" aria-expanded={showRecipe} onClick={()=>setShowRecipe(v=>!v)}>{showRecipe?"Hide":"Show"} {breedCount}-breed recipe</button>{showRecipe&&<div className="recipe-list">
        {Array.from({length:perfectCount-1},(_,i)=>i+2).map(tier=><div className="recipe-tier" key={tier}>
          <h3>{tier}×31 stage</h3>
          {recipes.filter(recipe=>recipe.tier===tier).map((recipe,index)=><div className="recipe-row" key={index}>
            <div><strong>{recipe.left.join(" + ")}</strong><small>Brace {recipe.leftBrace}</small></div>
            <span>×</span>
            <div><strong>{recipe.right.join(" + ")}</strong><small>Brace {recipe.rightBrace}</small></div>
            <span>→</span>
            <div className="recipe-result"><strong>{recipe.result.join(" + ")}</strong><small>{tier}×31 child</small></div>
          </div>)}
        </div>)}
      </div>}</>}
      <div className="cost-controls">
        <div className="breeder-prices"><span>1×31 breeder prices</span>{selected.map(stat=><label key={stat}>{stat}<input type="number" min="0" step="500" value={breederPrices[stat]} onChange={e=>setBreederPrices(v=>({...v,[stat]:Math.max(0,Number(e.target.value)||0)}))}/><small>Need {baseStatCounts[stat]} · own {Math.min(baseStatCounts[stat],ownedBaseCounts[stat])} · buy {missingStatCounts[stat]}</small></label>)}</div>
        <label>Gender selection assumption <select value={genderCost} onChange={e=>setGenderCost(Number(e.target.value))}><option value={0}>Exclude</option><option value={5000}>₽5,000</option><option value={9000}>₽9,000</option><option value={21000}>₽21,000</option></select></label></div><div className="plan-summary cost-summary"><div><span>{braceCount} braces</span><strong>₽{braceCost.toLocaleString()}</strong></div><div><span>Gender selections*</span><strong>₽{genderTotal.toLocaleString()}</strong></div><div><span>{natureBreeds} Everstones {nature?`· ${natureName}`:""}</span><strong>₽{natureCost.toLocaleString()}</strong></div><div><span>Fixed subtotal</span><strong>₽{fixedTotal.toLocaleString()}</strong></div></div>
      <div className="total-summary">
        <div><span>Base breeders to buy</span><strong>{selected.reduce((n,s)=>n+missingStatCounts[s],0)} / {baseParents} · ₽{breederCost.toLocaleString()}</strong></div>
        <div><span>Breeder split</span><strong>{selected.map(stat=>`${baseStatCounts[stat]}× ${stat}`).join(" · ")||"—"}</strong></div>
        <div className="grand-total"><span>Estimated total</span><strong>₽{estimatedTotal.toLocaleString()}</strong></div>
      </div><p className="calculator-note"><a href="/pokemon/pokemmo-breeding/box">Manage your Breeder Box →</a> Available single-31 breeders are automatically deducted from the shopping estimate.</p><div className="calculator-actions"><button type="button" onClick={()=>{setGenderCost(5000);setEverstoneCost(5000);setNature(false);setNatureName("Adamant");setBreederPrices(Object.fromEntries(stats.map(stat=>[stat,8000])) as Record<Stat,number>);localStorage.removeItem("pokemmo-breeding-settings")}}>Reset saved prices</button></div><p className="calculator-note">*Conservative estimate. Efficient chains may not need paid gender selection on every breed. Base breeder pricing can be set per IV because GTL prices vary by stat, species/egg group and gender. Your pricing assumptions are saved on this device. Poké Balls and egg moves are not included yet. Nature mode models the standard progressive nature chain and lets you set the current Everstone price.</p>
    </section>
  </PageShell>
}
