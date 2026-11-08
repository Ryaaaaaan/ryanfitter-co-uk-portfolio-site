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
script = Path('deploy/github-remote.sh').read_text()
commands = [f"bash -s -- {revision} <<'RYANFITTER_DEPLOY_SCRIPT'\n{script}\nRYANFITTER_DEPLOY_SCRIPT"]
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
            print(invocation.get('StandardOutputContent', ''))
            print(invocation.get('StandardErrorContent', ''))
            if status != 'Success': raise SystemExit('Deployment failed: ' + status)
            print('Website deployment completed.')
            break
    time.sleep(5)
else:
    raise SystemExit('Timed out waiting for AWS. Check the SSM command before retrying.')
