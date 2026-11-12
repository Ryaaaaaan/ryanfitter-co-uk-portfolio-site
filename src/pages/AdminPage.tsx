import {useEffect, useState} from "react";
import "../styles/admin.css";
import {CmsEditor} from "../cms/Editor";
import {JobsPage} from "../jobs/JobsPage";
import {JobMatches} from "../jobs/JobMatches";
import {CvLibrary} from "../jobs/CvLibrary";
import {InterviewCalendar} from "../jobs/InterviewCalendar";
import {WorkBoard} from "../jobs/WorkBoard";
import {DeploymentIndicator} from "../deployment/DeploymentIndicator";

type Session = {
  authenticated: boolean;
  email: string;
  csrf: string;
  features: { jobs: string; tasks: string; cms: string };
};
type LoadState = "loading" | "ready" | "unauthorised" | "unavailable";

const modules = [
  {name:"Job matches",eyebrow:"DISCOVER",description:"Review roles and see why they match your CV and working preferences.",icon:"◈",detail:"Automated scan · Mon, Wed, Fri",url:"/admin/job-matches",stat:"matches"},
  {name:"Applications",eyebrow:"FOLLOW UP",description:"Save vacancies, track applications and keep important next steps together.",icon:"▤",detail:"Saved → Applied → Interview → Offer",url:"/admin/jobs",stat:"jobs"},
  {name:"Work board",eyebrow:"DAY-TO-DAY",description:"Personal projects, LoftyCards, LOPT and ongoing tasks in one place.",icon:"▦",detail:"To do → In progress → Done",url:"/admin/tasks",stat:"tasks"},
  {name:"Interview calendar",eyebrow:"YOUR SCHEDULE",description:"Record interviews, meeting links, notes and calendar exports.",icon:"◷",detail:"Monthly schedule and .ics export",url:"/admin/interviews",stat:""},
  {name:"My CVs",eyebrow:"DOCUMENTS",description:"Store your CV versions privately and download them from any device.",icon:"▣",detail:"Secure documents",url:"/admin/cvs",stat:""},
  {name:"Portfolio CMS",eyebrow:"WEBSITE",description:"Edit sections and case studies, preview drafts and publish intentionally.",icon:"✳",detail:"Draft → Preview → Publish",url:"/admin/cms",stat:""}
];


export function AdminPage(){
  const [status,setStatus]=useState<LoadState>("loading");
  const [identity,setIdentity]=useState<Session|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/admin/api/session",{credentials:"same-origin",cache:"no-store",signal:controller.signal})
      .then(async response=>{
        if(response.status===401){setStatus("unauthorised");return;}
        if(!response.ok) throw new Error("Dashboard session is unavailable");
        const data=await response.json() as Session;
        if(!data.authenticated){setStatus("unauthorised");return;}
        setIdentity(data);
        setStatus("ready");
      })
      .catch(error=>{if(!controller.signal.aborted){console.error("Session check failed",error);setStatus("unavailable");}});
    return ()=>controller.abort();
  },[]);

  const cms=window.location.pathname.replace(/\/+$/, "")==="/admin/cms";
  const tasks=window.location.pathname.replace(/\/+$/, "")==="/admin/tasks";
  const [counts,setCounts]=useState<{matches:number;applications:number;tasks:number}|null>(null);
  useEffect(()=>{
    if(window.location.pathname.replace(/\/+$/,'')!=='/admin'||status!=='ready')return;
    let alive=true;
    void Promise.allSettled([
      fetch('/admin/api/job-matches',{cache:'no-store'}).then(r=>r.ok?r.json():null),
      fetch('/admin/api/jobs',{cache:'no-store'}).then(r=>r.ok?r.json():null),
      fetch('/admin/api/tasks',{cache:'no-store'}).then(r=>r.ok?r.json():null)
    ]).then(results=>{
      if(!alive)return;
      const data=results.map(result=>result.status==='fulfilled'?result.value:null);
      setCounts({
        matches:Array.isArray(data[0]?.matches)?data[0].matches.filter((x:{state:string})=>x.state==='new').length:0,
        applications:Array.isArray(data[1]?.jobs)?data[1].jobs.length:0,
        tasks:Array.isArray(data[2]?.tasks)?data[2].tasks.filter((x:{status:string})=>x.status!=='done').length:0
      });
    });
    return()=>{alive=false;};
  },[status]);
  const jobs=window.location.pathname.replace(/\/+$/, "")==="/admin/jobs";
  const matches=window.location.pathname.replace(/\/+$/, "")==="/admin/job-matches";
  const cvs=window.location.pathname.replace(/\/+$/, "")==="/admin/cvs";
  const calendar=window.location.pathname.replace(/\/+$/, "")==="/admin/interviews";
  return <div className={"admin-app"+(cms?" admin-app-cms":"")}>
    {status==="ready"&&identity?<>
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">ryan<span>.</span>fitter <small>WORKSPACE</small></a>
        <div className="admin-sidebar-label">WORKSPACE</div>
        <nav aria-label="Dashboard navigation">
          <a href="/admin" className={!cms&&!jobs&&!matches&&!cvs&&!calendar&&!tasks?"admin-nav-active":""} aria-current={!cms&&!jobs&&!matches&&!cvs&&!calendar&&!tasks?"page":undefined}>Overview</a>
          <a href="/admin/job-matches" className={matches?"admin-nav-active":""} aria-current={matches?"page":undefined}>Job matches</a>
          <a href="/admin/jobs" className={jobs?"admin-nav-active":""} aria-current={jobs?"page":undefined}>Applications</a>
          <a href="/admin/interviews" className={calendar?"admin-nav-active":""} aria-current={calendar?"page":undefined}>Interview calendar</a>
          <a href="/admin/cvs" className={cvs?"admin-nav-active":""} aria-current={cvs?"page":undefined}>My CVs</a>
          <a href="/admin/tasks" className={tasks?"admin-nav-active":""} aria-current={tasks?"page":undefined}>Work board</a>
          <a href="/admin/cms" className={cms?"admin-nav-active":""} aria-current={cms?"page":undefined}>Portfolio CMS</a>
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/" className="admin-back">← Public portfolio</a>
          <div className="admin-account">
            <span>Signed in{identity.email?" as":""}</span>
            {identity.email&&<strong>{identity.email}</strong>}
          </div>
          <form method="post" action="/admin/logout">
            <input type="hidden" name="csrf" value={identity.csrf}/>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className={"admin-main"+(cms?" admin-main-cms":"")} id="main">
        <div className="admin-heading">
          <div><span className="admin-overline">PERSONAL WORKSPACE</span><h1>{cms?"Portfolio CMS":jobs?"Applications":matches?"Job matches":cvs?"My CV library":calendar?"Interview calendar":tasks?"Work board":"Overview"}</h1>
          <p>A quiet place for your applications, projects and website content.</p></div>
          <span className="admin-secure">● Protected by Cognito</span>
        </div>
        {cms?<CmsEditor csrf={identity.csrf}/>:jobs?<JobsPage csrf={identity.csrf}/>:matches?<JobMatches csrf={identity.csrf}/>:cvs?<CvLibrary csrf={identity.csrf}/>:calendar?<InterviewCalendar csrf={identity.csrf}/>:tasks?<WorkBoard csrf={identity.csrf}/>:<>
          <section className="admin-overview-banner">
            <div><span className="admin-overline">YOUR WORKSPACE</span>
              <h2>Everything in one place.</h2>
              <p>Check your job matches, follow up on applications, manage tasks and update the public portfolio.</p>
            </div>
            <a href="/admin/job-matches" className="admin-overview-main-action">Review job matches</a>
          </section>
          <div className="admin-overview-stats" aria-label="Workspace overview">
            <div><strong>{counts?.matches??'—'}</strong><span>Jobs to review</span></div>
            <div><strong>{counts?.applications??'—'}</strong><span>Applications saved</span></div>
            <div><strong>{counts?.tasks??'—'}</strong><span>Tasks still open</span></div>
          </div>
          <DeploymentIndicator/>
          <div className="admin-shortcuts" aria-label="Workspace shortcuts">
            {modules.map(module=><a href={module.url} className="admin-shortcut" key={module.name}>
              <span className="admin-shortcut-icon" aria-hidden="true">{module.icon}</span>
              <span className="admin-shortcut-content">
                <small>{module.eyebrow}</small><strong>{module.name}</strong><span>{module.description}</span>
              </span><span aria-hidden="true" className="admin-shortcut-arrow">↗</span>
            </a>)}
          </div>
                </>}
      </main>
    </>:<main className="admin-entry" id="main">
      <a href="/" className="admin-brand">ryan<span>.</span>fitter</a>
      <div className="admin-entry-card">
        <span className="admin-overline">PRIVATE WORKSPACE</span>
        <h1>{status==="loading"?"Checking access…":status==="unauthorised"?"Sign in to continue":"Dashboard unavailable"}</h1>
        <p>{status==="loading"?"Verifying your private dashboard session.":status==="unauthorised"?"This area is restricted to approved accounts. Sign in with Cognito to continue.":"The session service is not responding. The dashboard remains locked until authentication is available."}</p>
        {status==="unauthorised"&&<a href="/admin/login" className="admin-sign-in">Sign in with Cognito ↗</a>}
        {status==="unavailable"&&<a href="/" className="admin-sign-in">Return to public site ↗</a>}
      </div>
    </main>}
  </div>;
}
