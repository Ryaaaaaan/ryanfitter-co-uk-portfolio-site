import {HomePage} from "./pages/HomePage";
import {PokemonPage} from "./pages/PokemonPage";
import {PokemonToolPage} from "./pages/PokemonToolPage";
import {PokeMMOBreedingPage} from "./pages/PokeMMOBreedingPage";

const path=window.location.pathname.replace(/\/+$/,"")||"/";
if(path.startsWith("/pokemon")){
  const pokemonTheme=localStorage.getItem("pokemon-theme");
  if(pokemonTheme==="light"||pokemonTheme==="dark") document.documentElement.dataset.theme=pokemonTheme;
}

const pokemonTools:Record<string,[string,string]>={
  "/pokemon/breeding":["Mainline Breeding","Breeding tools for the main-series games."],
  "/pokemon/iv":["IV Calculator","Estimate a Pokémon's IVs from its stats."],
  "/pokemon/shiny":["Shiny Odds","Compare shiny odds and modifiers."]
};

export function App(){
  if(path==="/pokemon") return <PokemonPage/>;
  if(path==="/pokemon/pokemmo-breeding") return <PokeMMOBreedingPage/>;
  const tool=pokemonTools[path];
  if(tool) return <PokemonToolPage title={tool[0]} description={tool[1]}/>;
  return <HomePage/>;
}
