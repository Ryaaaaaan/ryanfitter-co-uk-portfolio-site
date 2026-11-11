import '../styles/cms-blocks.css';
import type {CSSProperties} from 'react';
import type {ButtonStyle,Link,Section,SiteContent} from './model';
import {safeHref} from './model';
export function Buttons({links=[],style:options}:{links?:Link[];style?:ButtonStyle}){
  const align=options?.alignment==='left'?'flex-start':options?.alignment==='center'?'center':options?.alignment==='right'?'flex-end':undefined;
  const css={
    justifyContent:align,
    '--cms-btn-radius':options?.radius!==undefined?options.radius+'px':undefined,
    '--cms-btn-pad-x':options?.paddingX!==undefined?options.paddingX+'px':undefined,
    '--cms-btn-pad-y':options?.paddingY!==undefined?options.paddingY+'px':undefined,
    '--cms-btn-gap':options?.gap!==undefined?options.gap+'px':undefined,
    '--cms-btn-primary-bg':options?.primaryBackground||undefined,
    '--cms-btn-primary-text':options?.primaryText||undefined,
    '--cms-btn-secondary-bg':options?.secondaryBackground||undefined,
    '--cms-btn-secondary-text':options?.secondaryText||undefined,
    '--cms-btn-border-color':options?.borderColor||undefined,
  } as CSSProperties;
  return <div className="portfolio-actions" style={css}>{links.map((link,i)=>{
    const variant=link.variant||(i===0?'primary':'outline');
    const buttonCSS={
      backgroundColor:variant==='primary'?options?.primaryBackground||undefined:
        variant==='outline'?options?.secondaryBackground||undefined:undefined,
      borderColor:options?.borderColor||undefined,
      '--cms-btn-primary-text':options?.primaryText||undefined,
      '--cms-btn-secondary-text':options?.secondaryText||undefined,
    } as CSSProperties;
    return <a key={i} href={safeHref(link.href)}
      style={buttonCSS} className={'portfolio-button portfolio-button-'+variant}>
      {link.label} ↗
    </a>;
  })}</div>;
}
function Heading({section:s}:{section:Section}){return <div className="portfolio-section-heading"><div>{s.eyebrow&&<span className="portfolio-kicker">{s.eyebrow}</span>}<h2>{s.heading}</h2></div>{s.body&&<p>{s.body}</p>}</div>;}
export function PortfolioSection({section:s,site,onEditProject,selectedProjectSlug}:{
 section:Section;site:SiteContent;onEditProject?:(slug:string)=>void;selectedProjectSlug?:string
}){
  const typography=s.style;
  const layout=s.layout||{};
  const visibleProjects=site.projects.filter(project=>project.cardVisible!==false);
  const itemCount=s.type==='projects'?visibleProjects.length:(s.items?.length||0);
  const columns=Math.max(1,Math.min(12,layout.columns||itemCount||1));
  const split=layout.split??50;
  const aboutSingle=s.type==='about'&&(layout.columns===1||
    (layout.columns===0&&!s.heading?.trim()&&!s.eyebrow?.trim()));
  const customGrid=Boolean(layout.columns);
  const style={
    background:typography.background||undefined,color:typography.text||undefined,
    '--pf-ink':typography.text||undefined,'--pf-accent':typography.accent||undefined,
    '--pf-muted':typography.mutedColor||undefined,
    '--cms-heading-color':typography.headingColor||undefined,
    '--cms-body-color':typography.bodyColor||typography.text||undefined,
    '--cms-eyebrow-color':typography.eyebrowColor||undefined,
    '--cms-emphasis-color':typography.emphasisColor||undefined,
    paddingTop:typography.padding,paddingBottom:typography.padding,
    fontSize:typography.fontSize,textAlign:typography.align,
    '--cms-grid-columns':columns,'--cms-tablet-columns':Math.min(2,columns),
    '--cms-layout-gap':typeof layout.gap==='number'&&layout.gap>=0?layout.gap+'px':undefined,
    '--cms-split':typeof layout.split==='number'?split+'fr '+(100-split)+'fr':undefined,
    '--cms-layout-align':layout.verticalAlign||undefined,
    '--cms-copy-width':layout.copyMaxWidth?layout.copyMaxWidth+'px':undefined,
    '--cms-body-line-height':typography.lineHeight||undefined,
    '--cms-letter-spacing':typeof typography.letterSpacing==='number'?typography.letterSpacing+'px':undefined,
    '--cms-paragraph-spacing':typeof typography.paragraphSpacing==='number'&&typography.paragraphSpacing>=0?typography.paragraphSpacing+'px':undefined,
    '--cms-body-weight':typography.bodyWeight||undefined,
    '--cms-heading-size':typography.headingSize?typography.headingSize+'px':undefined,
    '--cms-heading-line-height':typography.headingLineHeight||undefined,
    '--cms-heading-letter-spacing':typeof typography.headingLetterSpacing==='number'?typography.headingLetterSpacing+'px':undefined,
    '--cms-heading-weight':typography.headingWeight||undefined,
    '--cms-stat-value-size':typography.statValueSize?typography.statValueSize+'px':undefined,
    '--cms-stat-label-size':typography.statLabelSize?typography.statLabelSize+'px':undefined,
  } as CSSProperties;
  const classes=[
    'cms-section','cms-section-'+s.type,
    s.type==='projects'&&layout.view==='list'?'cms-projects-list':'',
    typography.headingColor?'cms-override-heading-color':'',
    (typography.bodyColor||typography.text)?'cms-override-body-color':'',
    (typography.eyebrowColor||typography.accent)?'cms-override-eyebrow-color':'',
    typography.emphasisColor?'cms-override-emphasis-color':'',
    aboutSingle?'cms-layout-single':'',
    customGrid?'cms-layout-custom-columns':'',
    typography.lineHeight?'cms-custom-body-line':'',
    typeof typography.letterSpacing==='number'&&typography.letterSpacing!==0?'cms-custom-letter-spacing':'',
    typeof typography.paragraphSpacing==='number'&&typography.paragraphSpacing>=0?'cms-custom-paragraph-spacing':'',
    typography.bodyWeight?'cms-custom-body-weight':'',
    typography.headingSize?'cms-custom-heading-size':'',
    typography.headingLineHeight?'cms-custom-heading-line':'',
    typeof typography.headingLetterSpacing==='number'&&typography.headingLetterSpacing!==0?'cms-custom-heading-spacing':'',
    typography.headingWeight?'cms-custom-heading-weight':'',
    typography.statValueSize?'cms-custom-stat-value':'',
    typography.statLabelSize?'cms-custom-stat-label':'',
  ].filter(Boolean).join(' ');
  let content;
  switch(s.type){
    case 'hero':content=<div className="portfolio-container portfolio-hero"><div className="portfolio-hero-topline"><span className="portfolio-overline">{s.eyebrow}</span><span className="portfolio-hero-index">{s.index}</span></div><h1>{s.heading}{s.emphasis&&<><br/><em>{s.emphasis}</em></>}</h1><div className="portfolio-hero-bottom"><div className="portfolio-hero-intro"><p>{s.body}</p><span>{s.caption}</span></div><Buttons links={s.buttons} style={s.buttonStyle}/></div></div>;break;
    case 'image':content=<figure className="portfolio-container cms-screenshot-figure"><h2>{s.heading}</h2><p>{s.body}</p>{s.image?<img src={s.image} alt={s.heading||"Screenshot of website work"} loading="lazy"/>:<div className="cms-screenshot-placeholder">Upload a genuine screenshot in the CMS media library to fill this section.</div>}<figcaption>{s.caption}</figcaption></figure>;break;
    case 'image_text':content=<div className={'portfolio-container cms-image-text'+(s.imageSide==='left'?' cms-image-left':'')}>
      <div className="cms-image-text-copy"><h2>{s.heading}</h2><p>{s.body}</p><Buttons links={s.buttons} style={s.buttonStyle}/></div>
      <figure>{s.image?<img src={s.image} alt={s.caption||s.heading||'Portfolio screenshot'} loading="lazy"/>:<div className="cms-media-placeholder">Choose a real screenshot from your media library.</div>}{s.caption&&<figcaption>{s.caption}</figcaption>}</figure>
    </div>;break;
    case 'gallery':content=<div className="portfolio-container cms-gallery"><Heading section={s}/><div className="cms-gallery-grid">{(s.items||[]).map((item,i)=><figure key={i}>{item.image?<img src={item.image} alt={item.caption||'Portfolio screenshot'} loading="lazy"/>:<div className="cms-media-placeholder">Select screenshot {i+1}</div>}{item.caption&&<figcaption>{item.caption}</figcaption>}</figure>)}</div></div>;break;
    case 'testimonial':content=<div className="portfolio-container cms-testimonial"><span className="portfolio-kicker">TESTIMONIAL</span><blockquote>{s.body}</blockquote><strong>{s.author||s.heading}</strong><span>{s.role}</span></div>;break;
    case 'cta':content=<div className="portfolio-container cms-cta"><div><h2>{s.heading}</h2><p>{s.body}</p></div><Buttons links={s.buttons} style={s.buttonStyle}/></div>;break;
    case 'divider':content=<div className="portfolio-container cms-divider"><hr/></div>;break;
    case 'stats':content=<div className="portfolio-container portfolio-proof-grid">{s.items?.map((item,i)=><div key={i}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;break;
    case 'projects':content=<div className="portfolio-container">
      <Heading section={s}/>
      <div className="portfolio-projects">
        {visibleProjects.map(project=><article
          className={'portfolio-project'+(selectedProjectSlug===project.slug?' visual-selected-project':'')}
          key={project.slug} data-cms-project-slug={project.slug}
          onClick={onEditProject?event=>{event.stopPropagation();onEditProject(project.slug);}:undefined}>
          {onEditProject&&<button type="button" className="visual-project-edit-action"
            onClick={event=>{event.stopPropagation();onEditProject(project.slug);}}
            aria-label={'Edit '+project.client+' portfolio card'}>Edit card ✎</button>}
          <div className="portfolio-project-top">
            <span>{project.number} / {project.descriptor}</span><span>{project.date}</span>
          </div>
          {project.image&&<img className="cms-project-image" src={project.image}
            alt={project.client+' website screenshot'} loading="lazy"/>}
          <a className="portfolio-project-title" href={'/work/'+project.slug}>
            <h3>{project.client}</h3><span>↗</span>
          </a>
          <p>{project.cardSummary??project.title}</p>
          <div className="portfolio-project-end">
            <span>{project.cardMetricValue??project.facts[0]?.value}
              <small>{project.cardMetricLabel??project.facts[0]?.label}</small>
            </span>
            <a href={'/work/'+project.slug}>{project.cardLinkLabel||s.linkLabel||'Case study'} ↗</a>
          </div>
        </article>)}
        {visibleProjects.length===0&&<p className="cms-projects-empty">
          No portfolio cards are visible. Add a case study or show a hidden card in the CMS.
        </p>}
      </div>
      <p className="portfolio-work-caveat">{s.note}</p>
    </div>;break;
    case 'expertise':content=<div className="portfolio-container"><Heading section={s}/><div className="portfolio-expertise-grid">{s.items?.map((item,i)=><div key={i}><span className="portfolio-expertise-num">{String(i+1).padStart(2,'0')}</span><h3>{item.heading}</h3><p>{item.body}</p></div>)}</div><div className="portfolio-skills">{s.skills?.map((skill,i)=><span key={i}>{skill}</span>)}</div></div>;break;
    case 'about':content=<div className="portfolio-container portfolio-about"><div><span className="portfolio-kicker">{s.eyebrow}</span><h2>{s.heading}</h2></div><div className="portfolio-about-copy">{s.paragraphs?.map((p,i)=><p key={i}>{p}</p>)}<Buttons links={s.buttons} style={s.buttonStyle}/></div></div>;break;
    case 'contact':content=<div className="portfolio-container portfolio-contact-inner"><span className="portfolio-kicker">{s.eyebrow}</span><h2>{s.heading}{s.emphasis&&<><br/><em>{s.emphasis}</em></>}</h2><div className="portfolio-contact-bottom"><p>{s.body}</p><Buttons links={s.buttons} style={s.buttonStyle}/></div>{s.email&&<a className="portfolio-contact-email" href={'mailto:'+s.email}>{s.email}</a>}</div>;break;
    default:content=<div className="portfolio-container cms-text"><h1>{s.heading}</h1><p>{s.body}</p><Buttons links={s.buttons} style={s.buttonStyle}/></div>;
  }
  return <section id={s.anchor||s.id} className={classes} style={style}>{content}{s.image&&!['image','image_text'].includes(s.type)&&<div className="portfolio-container"><img className="cms-section-image" src={s.image} alt={s.heading||"Portfolio screenshot"} loading="lazy"/></div>}</section>;
}
