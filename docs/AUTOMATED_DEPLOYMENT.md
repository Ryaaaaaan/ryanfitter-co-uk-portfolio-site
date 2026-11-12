# Personal website automated deployment

After the dedicated IAM role is activated, a successful main-branch foundation
check triggers `Deploy personal website to AWS`. Manual runs are also available
in GitHub Actions. No AWS keys, S3 bucket or additional server are required.

The role trusts only this repository's main branch through the existing GitHub
OIDC provider. The exact subject includes the verified immutable owner ID 24569809
and repository ID 1398769934 as emitted by GitHub; name-only subjects do not match
this repository. It grants `ssm:SendCommand` for AWS-RunShellScript on only
`i-0266a151d81b9a47a`, plus `ssm:GetCommandInvocation` in eu-west-2 to collect
results (that read operation does not support resource-level scoping).

This authorizes main-branch workflows to execute commands as root on the website
host. Treat writes to main and workflow files as production deployment access.
The role grants no command execution on Trading Lab or LOPT and no Cognito,
Secrets Manager, IAM or database API permissions. Website root access inherently
includes the website's own configuration, so this is an access grant that must be
activated by the AWS account operator. Do not reuse the Trading Lab deploy role.

## One-time activation

Review `infrastructure/deployment/github-role.json`. In AWS CloudShell (not an
SSM server terminal), verify account 746364933861 and the existing OIDC provider:

```bash
aws sts get-caller-identity
aws iam get-open-id-connect-provider --open-id-connect-provider-arn arn:aws:iam::746364933861:oidc-provider/token.actions.githubusercontent.com
```

The audience list must include sts.amazonaws.com. If it is absent, stop and review
provider setup; do not modify the existing provider or Trading Lab stack blindly.
Create the role through CloudFormation using the reviewed template:

```bash
aws cloudformation deploy --region eu-west-2 --stack-name RyanFitterPortfolioDeployment --template-file infrastructure/deployment/github-role.json --capabilities CAPABILITY_NAMED_IAM
```

Then run/re-run the deployment workflow in GitHub Actions. The GitHub connection
can also re-run a failed run after this AWS setup is complete. No server commands
are needed for subsequent deployments. This is workflow-based AWS access; it does
not give the chat a general AWS shell or infrastructure administrator privileges.

## Behavior and limits

The workflow verifies build and backend tests, obtains short-lived credentials,
and sends the pinned commit to the website host over SSM. The host builds as an
unprivileged OS account, then installs with the backup/rollback script. A host lock
and workflow concurrency avoid overlapping deployments. Superseded commits are
skipped. It verifies public routes and anonymous authorization responses; real
Cognito login/logout still need a user session for end-to-end browser checks.

No TLS, DNS, security group, Trading Lab or LOPT infrastructure changes are made.
The CMS database and cookie secret survive deployments. Existing backups remain
local and need retention/off-instance backup planning for long-term use.

If AWS denies the initial setup, the account operator needs the CloudFormation
stack create/update/change-set permissions and IAM role/inline-policy management
for RyanFitterPortfolioGitHubDeploy, plus read access to the existing OIDC provider.
Do not grant these provisioning permissions to the GitHub deployment role itself.

## Production revision verification

The existing GitHub Actions → OIDC → SSM pipeline now records an **exact deployment
identity**; it does not grant any additional AWS permissions. The deploy
script passes the full immutable commit SHA, GitHub run ID and run attempt to
the EC2 host. The host builds Vite with `VITE_BUILD_SHA`, installs and performs
local auth/route checks using the existing rollback-capable installer, then
atomically writes a minimal `/deployment-status.json` containing:

- `schema_version` (1), `revision` (40-character Git commit), `deployed_at`
  (UTC ISO-8601), `run_id`, and `run_attempt`.

The public metadata contains no account identifier, user details, credentials
or internal host paths. Nginx explicitly serves it as no-store JSON and
returns 404 when missing rather than silently serving the SPA HTML. The public
homepage's `site-build-revision` meta tag is stamped by Vite from the same
commit SHA. The workflow only reports deployment verified if a fresh HTTPS
request confirms *both* the marker and homepage HTML match its exact commit,
run ID and attempt. An unchanged stale marker cannot make a rerun appear
successful. Existing anonymous Cognito-route and Pokémon/Trading Lab smoke
checks remain in place.

An older deployment that is superseded by a new `main` commit exits without
installing and is marked as **superseded** in GitHub Actions; it does not
incorrectly claim a successful revision verification.

The authenticated `/admin` overview displays the server's reported revision,
the build loaded by the browser and the install timestamp. **Versions match**
means those two identities agree, not that all external services are healthy or
that GitHub Actions passed every subsequent step. The linked Actions run is
the source for final job status. If status is missing, check the latest Actions
run; older/manual installs will show **Not reported** until this deployment
pipeline has published a marker. Browser tabs using older cached JavaScript may
show **Version mismatch** until refreshed.

To validate without AWS access, run:
```bash
python -m unittest discover -s deploy -p 'test_*.py' -v
```
The workflow itself invokes `python deploy/verify_deployment.py` after SSM
completes. The validator exits nonzero on stale/missing markers, wrong run
identity, incorrect HTML build SHA, malformed timestamps or HTTP errors.
