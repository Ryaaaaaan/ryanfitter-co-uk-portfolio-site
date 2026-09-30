import {PageShell} from "../components/PageShell";

const tools=[
  ["PokeMMO Breeding","/pokemon/pokemmo-breeding"],
  ["Mainline Breeding","/pokemon/breeding"],
  ["IV Calculator","/pokemon/iv"],
  ["Shiny Odds","/pokemon/shiny"]
];

export function PokemonPage(){
  return <PageShell className="pokemon">
    <header>
      <p className="eyebrow">ryanfitter.co.uk</p>
      <h1>Pokémon tools</h1>
      <p className="muted">Private utility workspace.</p>
    </header>
    <div className="tool-accordions">
      {tools.map(([title,href])=>
        <details className="tool-accordion" key={href}>
          <summary>{title}</summary>
          <div className="tool-accordion-body">
            <a href={href}>Open calculator</a>
          </div>
        </details>
      )}
    </div>
  </PageShell>
}
