# Personal website automated deployment

After the dedicated IAM role is activated, a successful main-branch foundation
check triggers `Deploy personal website to AWS`. Manual runs are also available
in GitHub Actions. No AWS keys, S3 bucket or additional server are required.

The role trusts only this repository's main branch through the existing GitHub
OIDC provider. It grants `ssm:SendCommand` for AWS-RunShellScript on only
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
