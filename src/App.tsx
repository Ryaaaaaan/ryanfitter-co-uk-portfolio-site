import {HomePage} from "./pages/HomePage";
import {PokemonPage} from "./pages/PokemonPage";

const pokemonTheme=localStorage.getItem("pokemon-theme");
if(pokemonTheme==="light"||pokemonTheme==="dark") document.documentElement.dataset.theme=pokemonTheme;

export function App(){
  const path=window.location.pathname.replace(/\/+$/,"")||"/";
  if(path==="/pokemon") return <PokemonPage/>;
  return <HomePage/>;
}
