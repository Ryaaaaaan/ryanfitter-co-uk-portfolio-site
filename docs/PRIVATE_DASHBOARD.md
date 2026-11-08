# Private dashboard foundation — deployment and access

Status: code prepared for review, **not deployed or provisioned in AWS**.

This foundation builds on the existing portfolio PR. It is intentionally
independent of TradingLab's trading process and LOPT's tenant application.

## Architecture

```
Public: https://ryanfitter.co.uk/                 -> existing Vite static site
Public: https://ryanfitter.co.uk/work/...          -> existing Vite static site
Private: https://ryanfitter.co.uk/admin            -> Nginx -> Flask/Gunicorn
Auth: same existing AWS Cognito USER POOL            -> separate app client
Private data: dedicated DynamoDB table (future use)
Private media: private encrypted S3 bucket (future use)
```

The protected HTML and every future `/admin/api/*` endpoint are served
through the backend. **An unlinked URL or client-side React check alone
does not make a dashboard private.**

Existing `/pokemon` tools stay untouched. TradingLab's own app client and
its existing Cognito user are not modified by the new CloudFormation stack.

## What has been implemented

- An unlinked `/admin` React dashboard shell with sections for applications,
  tasks, and the public portfolio CMS.
- OAuth 2.0 authorization-code sign-in with PKCE S256, state and nonce.
- Cognito issuer/audience/signature validation using AWS JWKS.
- Explicit Cognito `sub` allowlist, checked before signing in and on
  every dashboard/API request.
- Short-lived secure, HttpOnly, SameSite=Lax signed session cookie.
- CSRF-protected POST logout, no browser-stored Cognito tokens.
- API session check and no-cache/noindex headers for private routes.
- Isolated future DynamoDB table and private S3 bucket in AWS CDK.
- Nginx and systemd configuration examples, unit tests, CI checks.

There is no working CMS, task editing, job storage or upload endpoint yet.
DynamoDB/S3 are intentionally not accessed until access-scoped backend
permissions and content workflows have been implemented.

## 1. Identify the existing AWS account and TradingLab Cognito pool

Use the same AWS account and `eu-west-2` region as the existing
`TradingLabStack`. Verify the account and outputs before deploying anything:

```bash
aws sts get-caller-identity
aws cloudformation describe-stacks \
  --stack-name TradingLabStack --region eu-west-2 \
  --query "Stacks[0].Outputs[?starts_with(OutputKey, 'TradingLabCognito')].[OutputKey,OutputValue]" \
  --output table
```

Confirm you are viewing the actual production pool. Do not create a
second user pool. Never copy tokens or Cognito identities into GitHub.

The existing TradingLab CloudFormation stack also has an output named
`TradingLabAllowedIdentitySecretName` pointing to its allowlisted Cognito
subject in Secrets Manager. Use this **privately on the host** when populating
`COGNITO_ALLOWED_SUBS`. Do not paste that value into a public issue/PR.

## 2. Provision only the new app client and isolated data resources

From the `infrastructure/` directory, using an AWS-authorised environment:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
npm install -g aws-cdk
# Use the verified TradingLabCognitoUserPoolId output:
cdk deploy RyanFitterPersonalDashboard \
  --parameters ExistingCognitoUserPoolId=YOUR_EXISTING_POOL_ID
```

This creates a separate `RyanFitterPersonalDashboard` OAuth client with
callback `https://ryanfitter.co.uk/admin/auth/callback`; it does NOT create
or change Cognito users. It also creates a separate on-demand DynamoDB
table and non-public S3 bucket for later use. Both are retained if the
CloudFormation stack is deleted, to protect future user data.

Capture the `CognitoAppClientId` stack output for the backend env file.

## 3. Make the existing TradingLab account an approved dashboard user

Use the exact existing Cognito `sub` value (not the display name or email)
as the first entry in `COGNITO_ALLOWED_SUBS`. This identity is the same
one already approved by TradingLab.

If you want a second account with a personal email later, create/confirm
that account in the **same user pool** using the Cognito admin interface,
follow its verified-email/MFA onboarding, then append its unique `sub`
to the allowlist. Do not change the TradingLab identity, password or
email just to access this dashboard. No new users are created here.

Existing identity cannot yet be verified from this GitHub connection alone:
actual access must be tested against the deployed user pool.

## 4. Deploy the private service on the host serving the site

Before touching the host, identify how `ryanfitter.co.uk` is currently
served. It may not share the TradingLab EC2 instance; this repo has no
verified host/deployment configuration.

- Build the Vite site with `npm install && npm run build`.
- Place repository code and `dist/` under `/opt/ryanfitter-portfolio`.
- Create a dedicated least-privilege OS user, `ryanfitter-admin`.
- Set up a Python virtualenv under `/opt/ryanfitter-portfolio/.venv`,
  install `backend/requirements.txt`.
- Populate `/etc/ryanfitter-admin.env` with **real** values from
  `backend/.env.example`. Generate `COOKIE_SECRET` with
  `openssl rand -hex 32`. Give the env file permissions `0600`.
- Install `deploy/ryanfitter-admin.service` as a systemd unit.
- Add the two `/admin` Nginx location blocks from
  `deploy/nginx-admin-location.conf` to the existing **HTTPS** site,
  making sure those routes do not fall through to static `index.html`.
- Verify Nginx config and restart/reload only after testing. Keep the
  Flask server bound to `127.0.0.1:8787`, never publicly exposed.
- Configure the host's TLS certificate, deployment rollback and DNS
  separately. Do not replace existing TradingLab/LOPT services.

For resource-constrained hosts (especially TradingLab's t3.micro), review
memory/CPU budgets before deciding to run any extra service there. The
same AWS account does not mean it needs the same EC2 instance.

## 5. Smoke-test authentication

Using a separate signed-out browser session:

1. `GET /admin` must redirect to `/admin/login`; never return public
   portfolio HTML.
2. `GET /admin/api/session` must return HTTP 401 without a session.
3. Login through existing Cognito managed/hosted login with the TradingLab
   account; it should load the dashboard and report authenticated.
4. A different, non-allowlisted Cognito account must receive HTTP 403.
5. Sign out; the session endpoint must return HTTP 401 again.
6. `/admin` HTML and API responses must be `Cache-Control: no-store`,
   `X-Robots-Tag: noindex, nofollow`.
7. Verify `/pokemon` routes, public case studies and public pages
   remain functional.

This application currently performs local dashboard logout. It does NOT
globally sign out every other app client, so a Cognito managed-login
browser session may allow rapid reauthentication. This is separate from
TradingLab's own local session.

## Important limitations

- Neither AWS resources nor users are provisioned automatically by
  committing the PR. Provisioning requires AWS credentials and a careful
  check of the live account, pool and host.
- The auth gateway is a prerequisite for future CMS/task/job APIs, not a
  substitute for authorization and CSRF tests on every new write endpoint.
- Keep IAM permission grants for the future DynamoDB/S3 backend minimal
  and confined to this site; do not reuse TradingLab's broker or state
  credentials.
- Real screenshots should be reviewed for permission to publish and
  private customer/supplier information before CMS upload functionality.
