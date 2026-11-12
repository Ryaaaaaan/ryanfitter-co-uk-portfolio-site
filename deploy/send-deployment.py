"""GitHub runner: send fixed host deployment with a validated immutable revision."""
import json
import os
import re
import subprocess
import time
from pathlib import Path

revision = os.environ['DEPLOY_SHA']
if not re.fullmatch('[a-f0-9]{40}', revision):
    raise SystemExit('Invalid deployment revision')
instance = os.environ['INSTANCE_ID']
region = os.environ['AWS_REGION']
run_id = os.environ['GITHUB_RUN_ID']
run_attempt = os.environ['GITHUB_RUN_ATTEMPT']
if not re.fullmatch('[0-9]+', run_id) or not re.fullmatch('[0-9]+', run_attempt):
    raise SystemExit('Invalid GitHub run identity')
script = Path('deploy/github-remote.sh').read_text()
commands = [f"bash -s -- {revision} {run_id} {run_attempt} <<'RYANFITTER_DEPLOY_SCRIPT'\n{script}\nRYANFITTER_DEPLOY_SCRIPT"]
parameters = json.dumps({'commands': commands, 'executionTimeout': ['1200']})
command_id = subprocess.check_output([
    'aws', 'ssm', 'send-command', '--region', region, '--instance-ids', instance,
    '--document-name', 'AWS-RunShellScript', '--parameters', parameters,
    '--comment', 'Personal portfolio deployment ' + revision[:12],
    '--query', 'Command.CommandId', '--output', 'text',
], text=True).strip()
print('Website deployment command:', command_id, flush=True)
deadline = time.monotonic() + 1250
while time.monotonic() < deadline:
    result = subprocess.run([
        'aws', 'ssm', 'get-command-invocation', '--region', region,
        '--command-id', command_id, '--instance-id', instance, '--output', 'json',
    ], capture_output=True, text=True)
    if result.returncode:
        if 'InvocationDoesNotExist' not in result.stderr:
            raise SystemExit(result.stderr)
    else:
        invocation = json.loads(result.stdout)
        status = invocation['Status']
        if status not in ('Pending', 'InProgress', 'Delayed', 'Cancelling'):
            stdout = invocation.get('StandardOutputContent', '')
            print(stdout)
            print(invocation.get('StandardErrorContent', ''))
            if status != 'Success': raise SystemExit('Deployment failed: ' + status)
            skipped = 'DEPLOY_SKIPPED_SUPERSEDED:' in stdout
            if output_path := os.environ.get('GITHUB_OUTPUT'):
                with open(output_path, 'a', encoding='utf-8') as output:
                    output.write('superseded=' + ('true' if skipped else 'false') + '\n')
            if skipped:
                print('Deployment skipped: newer main revision exists. No verification for old run.')
            else:
                # The externally fetched marker and HTML are authoritative.
                # SSM's stdout is length-limited and may omit the final echo.
                print('SSM finished; exact external revision verification still required.')
            break
    time.sleep(5)
else:
    raise SystemExit('Timed out waiting for AWS. Check the SSM command before retrying.')
