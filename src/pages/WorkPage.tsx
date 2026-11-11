import {useEffect} from "react";
import {PortfolioChrome} from "../components/PortfolioChrome";
import {ProjectDetail} from "../components/ProjectDetail";
import {usePublishedSite} from "../cms/model";

export function WorkPage({slug}:{slug:string}){
  const site=usePublishedSite();
  const projects=site.projects;
  const project=projects.find(item=>item.slug===slug);
  useEffect(()=>{
    document.title=project?project.client+" — Selected work | Ryan Fitter":"Not found | Ryan Fitter";
    const meta=document.querySelector('meta[name="description"]');
    if(meta) meta.setAttribute("content",project?.summary||"Selected e-commerce work by Ryan Fitter.");
    document.querySelector('link[rel="canonical"]')?.setAttribute("href",project?"https://ryanfitter.co.uk/work/"+project.slug:"https://ryanfitter.co.uk/");
    document.querySelector('meta[property="og:url"]')?.setAttribute("content",project?"https://ryanfitter.co.uk/work/"+project.slug:"https://ryanfitter.co.uk/");
    document.querySelector('meta[property="og:title"]')?.setAttribute("content",project?project.client+" — Selected work | Ryan Fitter":"Ryan Fitter | E-commerce & Digital Merchandising");
  },[project]);
  if(!project) return <PortfolioChrome site={site}><main id="main" className="portfolio-container portfolio-detail"><span className="portfolio-kicker">NOT FOUND</span><h1>That project isn't here.</h1><a className="portfolio-text-link" href="/#work">Return to selected work ↗</a></main></PortfolioChrome>;
  return <PortfolioChrome site={site}><ProjectDetail project={project} projects={projects}/></PortfolioChrome>;
}
