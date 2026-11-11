import {useEffect, useState} from "react";
import "../styles/admin.css";
import {CmsEditor} from "../cms/Editor";
import {JobsPage} from "../jobs/JobsPage";

type Session = {
  authenticated: boolean;
  email: string;
  csrf: string;
  features: { jobs: string; tasks: string; cms: string };
};
type LoadState = "loading" | "ready" | "unauthorised" | "unavailable";

const modules = [
  {
    name: "Applications",
    eyebrow: "JOB TRACKER",
    description: "Keep vacancies, application notes, interview dates and follow-ups in one place.",
    icon: "◈",
    detail: "Saved → Applied → Interview → Offer"
  },
  {
    name: "Work board",
    eyebrow: "PERSONAL PROJECTS",
    description: "A straightforward board for everyday tasks, projects and deadlines.",
    icon: "▦",
    detail: "To do → In progress → Done"
  },
  {
    name: "Portfolio CMS",
    eyebrow: "WEBSITE CONTENT",
    description: "Edit case studies, upload real screenshots and publish updates to the public site.",
    icon: "✳",
    detail: "Drafts → Review → Published"
  }
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
  const jobs=window.location.pathname.replace(/\/+$/, "")==="/admin/jobs";
  return <div className="admin-app">
    {status==="ready"&&identity?<>
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">ryan<span>.</span>fitter <small>WORKSPACE</small></a>
        <div className="admin-sidebar-label">WORKSPACE</div>
        <nav aria-label="Dashboard navigation">
          <a href="/admin" className={!cms&&!jobs?"admin-nav-active":""} aria-current={!cms&&!jobs?"page":undefined}>Overview</a>
          <a href="/admin/jobs" className={jobs?"admin-nav-active":""} aria-current={jobs?"page":undefined}>Applications</a>
          <span className="admin-nav-inactive">Work board <small>SOON</small></span>
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
      <main className="admin-main" id="main">
        <div className="admin-heading">
          <div><span className="admin-overline">PERSONAL WORKSPACE</span><h1>{cms?"Portfolio CMS":jobs?"Applications":"Overview"}</h1>
          <p>A quiet place for your applications, projects and website content.</p></div>
          <span className="admin-secure">● Protected by Cognito</span>
        </div>
        {cms?<CmsEditor csrf={identity.csrf}/>:jobs?<JobsPage csrf={identity.csrf}/>:<>
        <div className="admin-notice"><strong>Foundation installed.</strong> Your private dashboard is ready. Your portfolio CMS and application tracker are available now. The work board is planned.</div>
        <div className="admin-module-grid">
          {modules.map(module=><section className="admin-module" key={module.name}>
            <div className="admin-module-top"><span className="admin-module-symbol" aria-hidden="true">{module.icon}</span><span className="admin-coming">{module.name==="Work board"?"PLANNED":"READY"}</span></div>
            <span className="admin-overline">{module.eyebrow}</span>
            <h2>{module.name}</h2>
            <p>{module.description}</p>
            <div className="admin-module-bottom">{module.detail}</div>
          </section>)}
        </div>
        <section className="admin-next">
          <div><span className="admin-overline">NEXT MILESTONE</span><h2>Build your website.</h2></div>
          <p>Edit text and styling, add components, save drafts and publish from the Portfolio CMS.</p>
        </section>
        <div className="cms-row"><a href="/admin/cms" className="admin-sign-in">Open Portfolio CMS →</a><a href="/admin/jobs" className="admin-sign-in">Open applications →</a></div>
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
