import {PageShell} from "../components/PageShell";

type Props={title:string;description:string};

export function PokemonToolPage({title,description}:Props){
  return <PageShell className="pokemon pokemon-tool-page">
    <p className="eyebrow"><a href="/pokemon">← Pokémon tools</a></p>
    <h1>{title}</h1>
    <p className="muted">{description}</p>
    <div className="tool-placeholder" aria-label="Calculator status">Calculator coming next.</div>
  </PageShell>
}
