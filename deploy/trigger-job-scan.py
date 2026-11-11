"""GitHub Actions: invoke the existing restricted SSM role on the website EC2.

No long-lived AWS credentials. Scanner runs as ryanfitter-admin, never root.
"""
import json
import os
import subprocess
import time

instance = os.environ["INSTANCE_ID"]
region = os.environ["AWS_REGION"]
commands = ["""set -eu
cd /opt/ryanfitter-portfolio
# Optional job API keys are held in a root-readable file, never GitHub.
# The SSM agent is root, then the scanner is dropped to the service user.
if [ -f /etc/ryanfitter-job-feeds.env ]; then
  set -a
  . /etc/ryanfitter-job-feeds.env
  set +a
fi
runuser -u ryanfitter-admin -- /opt/ryanfitter-portfolio/.venv/bin/python -m backend.run_job_scan
"""]
parameters = json.dumps({"commands": commands, "executionTimeout": ["420"]})
command_id = subprocess.check_output([
    "aws", "ssm", "send-command", "--region", region, "--instance-ids", instance,
    "--document-name", "AWS-RunShellScript", "--parameters", parameters,
    "--comment", "Ryan Fitter private UK remote job matches scan",
    "--query", "Command.CommandId", "--output", "text"
], text=True).strip()
print("Sent job scan to website host:", command_id, flush=True)
deadline = time.monotonic() + 450
while time.monotonic() < deadline:
    result = subprocess.run([
        "aws", "ssm", "get-command-invocation", "--region", region,
        "--command-id", command_id, "--instance-id", instance, "--output", "json",
    ], capture_output=True, text=True)
    if result.returncode:
        if "InvocationDoesNotExist" not in result.stderr:
            raise SystemExit(result.stderr)
    else:
        invocation = json.loads(result.stdout)
        status = invocation["Status"]
        if status not in ("Pending", "InProgress", "Delayed", "Cancelling"):
            print(invocation.get("StandardOutputContent", ""), flush=True)
            print(invocation.get("StandardErrorContent", ""), flush=True)
            if status != "Success":
                raise SystemExit("Job scan failed: " + status)
            print("Private job matches scan completed.")
            break
    time.sleep(5)
else:
    raise SystemExit("Timed out waiting for job scan; inspect SSM command.")
