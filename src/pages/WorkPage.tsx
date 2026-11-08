import {useEffect} from "react";
import {PortfolioChrome} from "../components/PortfolioChrome";
import {projects} from "../portfolioData";

export function WorkPage({slug}:{slug:string}){
  const project=projects.find(item=>item.slug===slug);
  useEffect(()=>{
    document.title=project?project.client+" — Selected work | Ryan Fitter":"Not found | Ryan Fitter";
    const meta=document.querySelector('meta[name="description"]');
    if(meta) meta.setAttribute("content",project?.summary||"Selected e-commerce work by Ryan Fitter.");
    document.querySelector('link[rel="canonical"]')?.setAttribute("href",project?"https://ryanfitter.co.uk/work/"+project.slug:"https://ryanfitter.co.uk/");
    document.querySelector('meta[property="og:url"]')?.setAttribute("content",project?"https://ryanfitter.co.uk/work/"+project.slug:"https://ryanfitter.co.uk/");
    document.querySelector('meta[property="og:title"]')?.setAttribute("content",project?project.client+" — Selected work | Ryan Fitter":"Ryan Fitter | E-commerce & Digital Merchandising");
  },[project]);
  if(!project) return <PortfolioChrome><main id="main" className="portfolio-container portfolio-detail"><span className="portfolio-kicker">NOT FOUND</span><h1>That project isn't here.</h1><a className="portfolio-text-link" href="/#work">Return to selected work ↗</a></main></PortfolioChrome>;
  const index=projects.findIndex(item=>item.slug===project.slug);
  const next=projects[(index+1)%projects.length];
  return <PortfolioChrome>
    <main id="main">
      <article className="portfolio-container portfolio-detail">
        <a href="/#work" className="portfolio-back-link">← Back to selected work</a>
        <div className="portfolio-detail-header"><span className="portfolio-kicker">{project.number} / {project.descriptor}</span><span className="portfolio-detail-date">{project.date}</span></div>
        <h1>{project.title}</h1>
        <p className="portfolio-detail-lead">{project.summary}</p>
        <div className="portfolio-detail-facts">
          {project.facts.map(fact=><div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}
        </div>
        <div className="portfolio-detail-body">
          <div className="portfolio-detail-main">
            <section><span className="portfolio-kicker">THE CONTEXT</span><h2>The challenge</h2><p>{project.challenge}</p></section>
            <section><span className="portfolio-kicker">MY CONTRIBUTION</span><h2>What I worked on</h2><ul>{project.work.map(item=><li key={item}>{item}</li>)}</ul></section>
            <section><span className="portfolio-kicker">THE OUTCOME</span><h2>What happened</h2><p>{project.result}</p></section>
          </div>
          <aside className="portfolio-detail-aside" aria-label="Project details">
            <h2>Project details</h2>
            <dl><dt>Organisation</dt><dd>{project.client}</dd><dt>Period</dt><dd>{project.date}</dd><dt>Focus</dt><dd>{project.descriptor}</dd></dl>
            <h3>Tools & disciplines</h3>
            <div className="portfolio-skills">{project.tools.map(tool=><span key={tool}>{tool}</span>)}</div>
            <h3>Related websites</h3>
            <div className="portfolio-project-links">{project.links.map(link=><a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></a>)}</div>
            {project.note&&<p className="portfolio-site-note">{project.note}</p>}
          </aside>
        </div>
        <div className="portfolio-next-project"><a href={"/work/"+next.slug}><span>Next project</span><strong>{next.client}</strong><span aria-hidden="true">↗</span></a></div>
      </article>
    </main>
  </PortfolioChrome>;
}
