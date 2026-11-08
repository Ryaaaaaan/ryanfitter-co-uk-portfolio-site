import type {CSSProperties} from 'react';
import type {Link,Section,SiteContent} from './model';
import {safeHref} from './model';
export function Buttons({links=[]}:{links?:Link[]}){return <div className="portfolio-actions">{links.map((link,i)=><a key={i} href={safeHref(link.href)} className={'portfolio-button '+(i===0?'portfolio-button-primary':'portfolio-button-outline')}>{link.label} ↗</a>)}</div>;}
function Heading({section:s}:{section:Section}){return <div className="portfolio-section-heading"><div>{s.eyebrow&&<span className="portfolio-kicker">{s.eyebrow}</span>}<h2>{s.heading}</h2></div>{s.body&&<p>{s.body}</p>}</div>;}
export function PortfolioSection({section:s,site}:{section:Section;site:SiteContent}){
  const style={background:s.style.background||undefined,color:s.style.text||undefined,'--pf-ink':s.style.text||undefined,'--pf-accent':s.style.accent||undefined,paddingTop:s.style.padding,paddingBottom:s.style.padding,fontSize:s.style.fontSize,textAlign:s.style.align} as CSSProperties;
  let content;
  switch(s.type){
    case 'hero':content=<div className="portfolio-container portfolio-hero"><div className="portfolio-hero-topline"><span className="portfolio-overline">{s.eyebrow}</span><span className="portfolio-hero-index">{s.index}</span></div><h1>{s.heading}{s.emphasis&&<><br/><em>{s.emphasis}</em></>}</h1><div className="portfolio-hero-bottom"><div className="portfolio-hero-intro"><p>{s.body}</p><span>{s.caption}</span></div><Buttons links={s.buttons}/></div></div>;break;
    case 'stats':content=<div className="portfolio-container portfolio-proof-grid">{s.items?.map((item,i)=><div key={i}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;break;
    case 'projects':content=<div className="portfolio-container"><Heading section={s}/><div className="portfolio-projects">{site.projects.map(project=><article className="portfolio-project" key={project.slug}><div className="portfolio-project-top"><span>{project.number} / {project.descriptor}</span><span>{project.date}</span></div><a className="portfolio-project-title" href={'/work/'+project.slug}><h3>{project.client}</h3><span>↗</span></a><p>{project.title}</p><div className="portfolio-project-end"><span>{project.facts[0]?.value}<small>{project.facts[0]?.label}</small></span><a href={'/work/'+project.slug}>{s.linkLabel} ↗</a></div></article>)}</div><p className="portfolio-work-caveat">{s.note}</p></div>;break;
    case 'expertise':content=<div className="portfolio-container"><Heading section={s}/><div className="portfolio-expertise-grid">{s.items?.map((item,i)=><div key={i}><span className="portfolio-expertise-num">{String(i+1).padStart(2,'0')}</span><h3>{item.heading}</h3><p>{item.body}</p></div>)}</div><div className="portfolio-skills">{s.skills?.map((skill,i)=><span key={i}>{skill}</span>)}</div></div>;break;
    case 'about':content=<div className="portfolio-container portfolio-about"><div><span className="portfolio-kicker">{s.eyebrow}</span><h2>{s.heading}</h2></div><div className="portfolio-about-copy">{s.paragraphs?.map((p,i)=><p key={i}>{p}</p>)}<Buttons links={s.buttons}/></div></div>;break;
    case 'contact':content=<div className="portfolio-container portfolio-contact-inner"><span className="portfolio-kicker">{s.eyebrow}</span><h2>{s.heading}{s.emphasis&&<><br/><em>{s.emphasis}</em></>}</h2><div className="portfolio-contact-bottom"><p>{s.body}</p><Buttons links={s.buttons}/></div>{s.email&&<a className="portfolio-contact-email" href={'mailto:'+s.email}>{s.email}</a>}</div>;break;
    default:content=<div className="portfolio-container cms-text"><h1>{s.heading}</h1><p>{s.body}</p><Buttons links={s.buttons}/></div>;
  }
  return <section id={s.id} className={'cms-section cms-section-'+s.type} style={style}>{content}</section>;
}
