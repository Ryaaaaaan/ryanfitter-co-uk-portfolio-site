"""Private ryanfitter.co.uk dashboard auth gateway.

This is a deployment foundation, not a CMS. All /admin routes are served by
this application (and MUST be routed here by the production reverse proxy).
Never store authorization credentials in the public Vite bundle.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
import time
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlencode, urlparse

import jwt
import requests
from flask import Flask, abort, jsonify, make_response, redirect, request, send_file, session
from werkzeug.exceptions import HTTPException

LOG = logging.getLogger("personal_dashboard")


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)

    required = [
        "COOKIE_SECRET", "COGNITO_ALLOWED_SUBS", "COGNITO_CLIENT_ID",
        "COGNITO_USER_POOL_ID", "COGNITO_DOMAIN", "SITE_ORIGIN", "AWS_REGION",
    ]
    missing = [key for key in required if not os.environ.get(key, "").strip()]
    if missing:
        raise RuntimeError("Missing dashboard configuration: " + ", ".join(missing))

    secret = os.environ["COOKIE_SECRET"]
    if len(secret) < 32 or secret.startswith("REPLACE_"):
        raise RuntimeError("COOKIE_SECRET must be a randomly generated 32+ character value")

    allowed_subs = tuple(x.strip() for x in os.environ["COGNITO_ALLOWED_SUBS"].split(",") if x.strip())
    if not allowed_subs or any(s.startswith("REPLACE_") for s in allowed_subs):
        raise RuntimeError("Explicit Cognito subject allowlist is required")

    origin = os.environ["SITE_ORIGIN"].rstrip("/")
    parsed_origin = urlparse(origin)
    cognito_domain = os.environ["COGNITO_DOMAIN"].rstrip("/")
    parsed_domain = urlparse(cognito_domain)
    if parsed_origin.scheme != "https" or not parsed_origin.hostname or parsed_origin.path:
        raise RuntimeError("SITE_ORIGIN must be a production HTTPS origin without a path")
    if parsed_domain.scheme != "https" or not parsed_domain.hostname or parsed_domain.path:
        raise RuntimeError("COGNITO_DOMAIN must be an HTTPS origin without a path")

    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    region = os.environ["AWS_REGION"]
    client_id = os.environ["COGNITO_CLIENT_ID"]
    callback_url = origin + "/admin/auth/callback"
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"
    jwks = jwt.PyJWKClient(issuer + "/.well-known/jwks.json")
    build_dir = Path(os.environ.get("DIST_DIR", "/opt/ryanfitter-portfolio/dist"))
    index_file = build_dir / "index.html"

    app.secret_key = secret
    app.config.update(
        SESSION_COOKIE_NAME="__Host-ryanfitter_admin",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_PATH="/",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        TRUSTED_HOSTS=[parsed_origin.hostname],
        MAX_CONTENT_LENGTH=1024 * 1024,
    )

    def signed_in() -> bool:
        sub = session.get("sub")
        return (
            isinstance(sub, str)
            and any(hmac.compare_digest(sub, approved) for approved in allowed_subs)
            and bool(session.get("authenticated"))
        )

    @app.after_request
    def security_headers(response):
        if request.path.startswith("/admin"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Robots-Tag"] = "noindex, nofollow"
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "no-referrer"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; base-uri 'self'; "
                "object-src 'none'; frame-ancestors 'none'; "
                "script-src 'self'; style-src 'self'; "
                "connect-src 'self'; img-src 'self' data:; form-action 'self'"
            )
        return response

    @app.get("/admin/login")
    def login():
        session.clear()
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode("ascii")).digest()
        ).rstrip(b"=").decode("ascii")
        session.permanent = True
        session["oauth_state"] = state
        session["oauth_nonce"] = nonce
        session["oauth_verifier"] = verifier
        session["oauth_started"] = int(time.time())
        params = urlencode({
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": callback_url,
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "code_challenge_method": "S256",
            "code_challenge": challenge,
        })
        return redirect(cognito_domain + "/oauth2/authorize?" + params, 302)

    @app.get("/admin/auth/callback")
    def callback():
        code = request.args.get("code", "")
        state = request.args.get("state", "")
        expected_state = session.pop("oauth_state", "")
        expected_nonce = session.pop("oauth_nonce", "")
        verifier = session.pop("oauth_verifier", "")
        started = session.pop("oauth_started", 0)
        if (not code or not state or not verifier or not expected_nonce
                or not expected_state or not hmac.compare_digest(state, expected_state)
                or not isinstance(started, int) or not (0 <= int(time.time()) - started <= 600)):
            session.clear()
            abort(400, description="Invalid or expired sign-in attempt")

        try:
            response = requests.post(
                cognito_domain + "/oauth2/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "code": code,
                    "redirect_uri": callback_url,
                    "code_verifier": verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10,
            )
            response.raise_for_status()
            id_token = response.json()["id_token"]
            signing_key = jwks.get_signing_key_from_jwt(id_token)
            claims = jwt.decode(
                id_token,
                signing_key.key,
                algorithms=["RS256"],
                audience=client_id,
                issuer=issuer,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        except (requests.RequestException, jwt.PyJWTError, KeyError, ValueError):
            LOG.warning("Cognito callback verification failed", exc_info=False)
            session.clear()
            abort(401, description="Unable to verify Cognito sign-in")

        token_nonce = str(claims.get("nonce", ""))
        if not hmac.compare_digest(token_nonce, expected_nonce):
            session.clear()
            abort(401, description="Invalid identity token nonce")
        sub = str(claims.get("sub", ""))
        if not sub or not any(hmac.compare_digest(sub, approved) for approved in allowed_subs):
            session.clear()
            abort(403, description="This account is not approved for the personal dashboard")

        # Only keep a signed, short-lived browser session. Never store Cognito
        # access, refresh or identity tokens in frontend code or browser storage.
        session.clear()
        session.permanent = True
        session["sub"] = sub
        session["authenticated"] = True
        session["email"] = str(claims.get("email", "")) if claims.get("email_verified") else ""
        session["csrf"] = secrets.token_urlsafe(32)
        return redirect("/admin", 303)

    @app.get("/admin/api/session")
    def session_api():
        if not signed_in():
            return jsonify({"authenticated": False}), 401
        return jsonify({
            "authenticated": True,
            "email": session.get("email") or "",
            "csrf": session["csrf"],
            "features": {"jobs": "planned", "tasks": "planned", "cms": "planned"},
        })

    @app.post("/admin/logout")
    def logout():
        if not signed_in():
            abort(401)
        csrf = request.form.get("csrf", "")
        if not csrf or not hmac.compare_digest(csrf, session.get("csrf", "")):
            abort(403, description="Invalid request token")
        origin_header = request.headers.get("Origin")
        if origin_header and origin_header != origin:
            abort(403, description="Invalid request origin")
        session.clear()
        return redirect("/", 303)

    @app.get("/admin")
    @app.get("/admin/")
    @app.get("/admin/<path:unused>")
    def dashboard(unused: str = ""):
        if not signed_in():
            return redirect("/admin/login", 302)
        if not index_file.is_file():
            abort(503, description="Frontend build has not been deployed")
        return send_file(index_file, mimetype="text/html")

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith("/admin/api/"):
            return jsonify({"error": error.name, "status": error.code}), error.code
        return error

    return app


# Gunicorn imports this. Fail closed on bad/missing production configuration.
app = create_app()
