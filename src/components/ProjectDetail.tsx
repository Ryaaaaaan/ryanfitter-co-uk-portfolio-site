import type {Project} from '../portfolioData';

/** Shared markup for the live public case study AND the CMS draft stage. */
export function ProjectDetail({project,projects}:{project:Project;projects:Project[]}){
 const index=projects.findIndex(item=>item.slug===project.slug);
 const next=projects[(index+1)%projects.length]||project;
 return <main id="main"><article className="portfolio-container portfolio-detail">
    <a href="/#work" className="portfolio-back-link">← Back to selected work</a>
    <div className="portfolio-detail-header"><span className="portfolio-kicker">{project.number} / {project.descriptor}</span><span className="portfolio-detail-date">{project.date}</span></div>
    <h1>{project.title}</h1>
    <p className="portfolio-detail-lead">{project.summary}</p>
    {project.image&&<img className="cms-project-detail-image" src={project.image} alt={project.client+" website screenshot"} loading="lazy"/>}
    <div className="portfolio-detail-facts">{project.facts.map((fact,i)=><div key={i}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}</div>
    <div className="portfolio-detail-body">
      <div className="portfolio-detail-main">
        <section><span className="portfolio-kicker">THE CONTEXT</span><h2>The challenge</h2><p>{project.challenge}</p></section>
        <section><span className="portfolio-kicker">MY CONTRIBUTION</span><h2>What I worked on</h2><ul>{project.work.map((item,i)=><li key={i}>{item}</li>)}</ul></section>
        <section><span className="portfolio-kicker">THE OUTCOME</span><h2>What happened</h2><p>{project.result}</p></section>
      </div>
      <aside className="portfolio-detail-aside" aria-label="Project details">
        <h2>Project details</h2>
        <dl><dt>Organisation</dt><dd>{project.client}</dd><dt>Period</dt><dd>{project.date}</dd><dt>Focus</dt><dd>{project.descriptor}</dd></dl>
        <h3>Tools & disciplines</h3><div className="portfolio-skills">{project.tools.map(tool=><span key={tool}>{tool}</span>)}</div>
        <h3>Related websites</h3><div className="portfolio-project-links">{project.links.map((link,i)=><a key={i} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <span>↗</span></a>)}</div>
        {project.note&&<p className="portfolio-site-note">{project.note}</p>}
      </aside>
    </div>
    <div className="portfolio-next-project"><a href={"/work/"+next.slug}><span>Next project</span><strong>{next.client}</strong><span aria-hidden="true">↗</span></a></div>
 </article></main>;
}
