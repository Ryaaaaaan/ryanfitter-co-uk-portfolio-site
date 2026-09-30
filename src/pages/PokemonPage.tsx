import {PageShell} from "../components/PageShell";

const tools=[
  {title:"PokeMMO Breeding",description:"Plan breeding chains, IV inheritance and costs.",href:"/pokemon/pokemmo-breeding"},
  {title:"Mainline Breeding",description:"Breeding tools for the main-series games.",href:"/pokemon/breeding"},
  {title:"IV Calculator",description:"Estimate a Pokémon's IVs from its stats.",href:"/pokemon/iv"},
  {title:"Shiny Odds",description:"Compare shiny odds and modifiers.",href:"/pokemon/shiny"}
];

export function PokemonPage(){
  return <PageShell className="pokemon">
    <header className="pokemon-header">
      <div>
        <p className="eyebrow">ryanfitter.co.uk</p>
        <h1>Pokémon tools</h1>
        <p className="muted">Small calculators and trackers. Pick one below.</p>
      </div>
      <button className="theme-toggle" type="button" onClick={()=>{
        const root=document.documentElement;
        const next=root.dataset.theme==="dark"?"light":"dark";
        root.dataset.theme=next;
        localStorage.setItem("pokemon-theme",next);
      }}>Light / Dark</button>
    </header>
    <div className="tool-accordions">
      {tools.map(tool=>
        <details className="tool-accordion" key={tool.href}>
          <summary><span>{tool.title}</span><span className="accordion-plus" aria-hidden="true">+</span></summary>
          <div className="tool-accordion-body">
            <p>{tool.description}</p>
            <a href={tool.href}>Open calculator</a>
          </div>
        </details>
      )}
    </div>
  </PageShell>
}
