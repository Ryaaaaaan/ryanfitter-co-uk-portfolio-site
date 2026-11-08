import {useEffect, useState} from "react";
import "../styles/admin.css";

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

  return <div className="admin-app">
    {status==="ready"&&identity?<>
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">ryan<span>.</span>fitter <small>WORKSPACE</small></a>
        <div className="admin-sidebar-label">WORKSPACE</div>
        <nav aria-label="Dashboard navigation">
          <a href="/admin" className="admin-nav-active" aria-current="page">Overview</a>
          <span className="admin-nav-inactive">Applications <small>SOON</small></span>
          <span className="admin-nav-inactive">Work board <small>SOON</small></span>
          <span className="admin-nav-inactive">Portfolio CMS <small>SOON</small></span>
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
          <div><span className="admin-overline">PERSONAL WORKSPACE</span><h1>Overview</h1>
          <p>A quiet place for your applications, projects and website content.</p></div>
          <span className="admin-secure">● Protected by Cognito</span>
        </div>
        <div className="admin-notice"><strong>Foundation installed.</strong> Your sign-in and private dashboard shell are ready for deployment. Data storage and editing tools are not enabled yet.</div>
        <div className="admin-module-grid">
          {modules.map(module=><section className="admin-module" key={module.name}>
            <div className="admin-module-top"><span className="admin-module-symbol" aria-hidden="true">{module.icon}</span><span className="admin-coming">PLANNED</span></div>
            <span className="admin-overline">{module.eyebrow}</span>
            <h2>{module.name}</h2>
            <p>{module.description}</p>
            <div className="admin-module-bottom">{module.detail}</div>
          </section>)}
        </div>
        <section className="admin-next">
          <div><span className="admin-overline">NEXT MILESTONE</span><h2>Choose what to build first.</h2></div>
          <p>The dashboard is intentionally lightweight. We can add the CMS, task board and application tracker one module at a time, without affecting the public portfolio.</p>
        </section>
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
