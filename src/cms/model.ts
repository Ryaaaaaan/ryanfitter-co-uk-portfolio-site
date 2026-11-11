import defaults from './defaults.json';
import starter from './starter.json';
import screenshot from './image.json';
import otherBlocks from './blocks.json';
import type {Project} from '../portfolioData';
import {useEffect,useState} from 'react';
export type Link={label:string;href:string};
export type Section={id:string;type:string;enabled:boolean;image?:string;imageSide?:string;author?:string;role?:string;style:{background:string;text:string;accent:string;padding:number;fontSize:number;align:string};heading?:string;body?:string;eyebrow?:string;index?:string;emphasis?:string;caption?:string;email?:string;note?:string;linkLabel?:string;buttons?:Link[];paragraphs?:string[];skills?:string[];items?:{value?:string;label?:string;heading?:string;body?:string;image?:string;caption?:string}[]};
export type SiteContent={version:number;title:string;description:string;theme:{background:string;text:string;muted:string;accent:string;panel:string;font:string;contentWidth:number};header:{enabled:boolean;brand:string;links:Link[]};footer:{enabled:boolean;text:string;links:Link[]};projects:Project[];sections:Section[]};
export const blankSite=defaults as SiteContent;
export const starterSite=starter as SiteContent;
export const screenshotSection=screenshot as Section;
export const extraSections=otherBlocks as Section[];
export const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
export function usePublishedSite(){
  const [site,setSite]=useState<SiteContent>(blankSite);
  useEffect(()=>{const controller=new AbortController();fetch('/content/site.json',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw Error('Content unavailable');return r.json();}).then(data=>{if(data.version===1&&Array.isArray(data.sections))setSite(data);}).catch(()=>{});return ()=>controller.abort();},[]);
  return site;
}
export function safeHref(href:string){return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href)?href:'#';}
