import {useEffect, useState} from "react";

type DeploymentRecord = {
  schema_version: number;
  revision: string;
  deployed_at: string;
  run_id: string;
  run_attempt: number;
};
type Result = {state: "loading" | "ready" | "unavailable"; record?: DeploymentRecord};

const BUILD_SHA = (import.meta.env.VITE_BUILD_SHA || "").trim();
const fullSha = (value: string) => /^[a-f0-9]{40}$/.test(value);

function isDeploymentRecord(value: unknown): value is DeploymentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DeploymentRecord>;
  return record.schema_version === 1 &&
    typeof record.revision === "string" && fullSha(record.revision) &&
    typeof record.deployed_at === "string" && !Number.isNaN(Date.parse(record.deployed_at)) &&
    typeof record.run_id === "string" && /^[0-9]+$/.test(record.run_id) &&
    Number.isInteger(record.run_attempt) && Number(record.run_attempt) > 0;
}

/** Version agreement is not the same as GitHub Actions success or application uptime. */
export function DeploymentIndicator() {
  const [result, setResult] = useState<Result>({state: "loading"});
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult({state: "loading"});
    fetch("/deployment-status.json?check=" + Date.now(), {
      cache: "no-store", credentials: "same-origin", signal: controller.signal,
      headers: {"Cache-Control": "no-cache"},
    }).then(async response => {
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Production marker is unavailable");
      }
      const data: unknown = await response.json();
      if (!isDeploymentRecord(data)) throw new Error("Invalid deployment marker");
      setResult({state: "ready", record: data});
    }).catch(() => {
      if (!controller.signal.aborted) setResult({state: "unavailable"});
    });
    return () => controller.abort();
  }, [refresh]);

  const record = result.record;
  const built = fullSha(BUILD_SHA);
  const matches = result.state === "ready" && record && built && record.revision === BUILD_SHA;
  const mismatch = result.state === "ready" && record && built && record.revision !== BUILD_SHA;
  const state = result.state === "loading" ? "Checking…" :
    result.state !== "ready" ? "Not reported" :
    !built ? "Build not stamped" : matches ? "Versions match" : "Version mismatch";
  const date = record ? new Date(record.deployed_at).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London", timeZoneName: "short",
  }) : "Not available";
  const runUrl = record && /^[0-9]+$/.test(record.run_id)
    ? "https://github.com/Ryaaaaaan/ryanfitter-co-uk-portfolio-site/actions/runs/" + record.run_id
    : "https://github.com/Ryaaaaaan/ryanfitter-co-uk-portfolio-site/actions/workflows/deploy-aws.yml";

  return <section className="admin-deployment" id="deployment" aria-label="Production deployment">
    <div className="admin-deployment-heading">
      <div><span className="admin-overline">PRODUCTION WEBSITE</span>
        <h2>Deployment verification</h2></div>
      <span className={"admin-deployment-state" + (mismatch ? " admin-deployment-mismatch" : matches ? " admin-deployment-match" : "")} role="status">
        {state}
      </span>
    </div>
    <div className="admin-deployment-versions">
      <div><span>Deployed on the server</span><strong title={record?.revision || ""}>{record ? record.revision.slice(0, 12) : "Unknown"}</strong></div>
      <div><span>Build loaded in this browser</span><strong title={built ? BUILD_SHA : ""}>{built ? BUILD_SHA.slice(0, 12) : "Unknown"}</strong></div>
      <div><span>Server install timestamp</span><strong>{date}</strong></div>
    </div>
    <p className="admin-deployment-note">
      {mismatch ? "The loaded website build and server deployment marker differ. Refresh the page; if they still differ, inspect the Actions run." :
        matches ? "The live HTML build and server deployment marker agree. Check GitHub Actions for the final deployment job result." :
        "The production revision cannot yet be verified. New deployments publish this marker after installation and local health checks."}
    </p>
    <div className="admin-deployment-actions">
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={result.state === "loading"}>Recheck deployment</button>
      <a href={runUrl} target="_blank" rel="noopener noreferrer">View GitHub Actions{record ? " run" : ""} ↗</a>
    </div>
  </section>;
}
