import {HomePage} from "./pages/HomePage";
import {PokemonPage} from "./pages/PokemonPage";
export function App(){const path=window.location.pathname.replace(/\/+$/,"")||"/";return path==="/pokemon"?<PokemonPage/>:<HomePage/>;}