import {useEffect} from 'react';
import {PortfolioChrome} from '../components/PortfolioChrome';
import {PortfolioSection} from '../cms/Sections';
import {usePublishedSite} from '../cms/model';
export function HomePage(){
  const site=usePublishedSite();
  useEffect(()=>{document.title=site.title;for(const name of ['description','og:description'])document.querySelector(`meta[${name.startsWith('og:')?'property':'name'}="${name}"]`)?.setAttribute('content',site.description);document.querySelector('meta[property="og:title"]')?.setAttribute('content',site.title);},[site]);
  return <PortfolioChrome site={site}><main id="main">{site.sections.filter(s=>s.enabled).map(section=><PortfolioSection key={section.id} section={section} site={site}/>)}</main></PortfolioChrome>;
}
