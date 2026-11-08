import type {CSSProperties,ReactNode} from 'react';
import type {SiteContent} from '../cms/model';
import {blankSite,safeHref} from '../cms/model';
import '../styles/portfolio.css';
export function PortfolioChrome({children,site=blankSite}:{children:ReactNode;site?:SiteContent}){
  const t=site.theme;
  const style={'--pf-bg':t.background,'--pf-ink':t.text,'--pf-muted':t.muted,'--pf-panel':t.panel,'--pf-accent':t.accent,'--cms-width':t.contentWidth+'px',fontFamily:t.font==='serif'?'Georgia,serif':t.font==='mono'?'ui-monospace,monospace':'Inter,ui-sans-serif,system-ui,sans-serif'} as CSSProperties;
  return <div className="portfolio cms-site" style={style}><a className="portfolio-skip" href="#main">Skip to content</a>{site.header.enabled&&<header className="portfolio-header"><div className="portfolio-container portfolio-header-inner"><a href="/" className="portfolio-wordmark">{site.header.brand}</a><nav className="portfolio-nav" aria-label="Main navigation">{site.header.links.map((link,i)=><a key={i} href={safeHref(link.href)}>{link.label}</a>)}</nav></div></header>}{children}{site.footer.enabled&&<footer className="portfolio-footer"><div className="portfolio-container portfolio-footer-inner"><span>{site.footer.text}</span>{site.footer.links.map((link,i)=><a key={i} href={safeHref(link.href)}>{link.label}</a>)}</div></footer>}</div>;
}
