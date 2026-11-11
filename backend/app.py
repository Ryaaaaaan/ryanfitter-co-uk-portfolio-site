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
from threading import Thread
from backend.cms import ContentStore
from backend.jobs import JobStore
from backend.work_board import TaskStore
from backend.job_matches import MatchStore, scan as scan_matches
from backend.cv_vault import CvVault
from backend.interviews import InterviewStore, to_ical
from backend.uploads import ImageLibrary, published_image_urls
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

    store = ContentStore(os.environ.get("CMS_DATABASE", "/var/lib/ryanfitter-admin/cms.sqlite3"))
    jobs = JobStore(os.environ.get("JOB_DATABASE", "/var/lib/ryanfitter-admin/jobs.sqlite3"))
    tasks = TaskStore(os.environ.get("JOB_DATABASE", "/var/lib/ryanfitter-admin/jobs.sqlite3"))
    matches = MatchStore(os.environ.get("JOB_DATABASE", "/var/lib/ryanfitter-admin/jobs.sqlite3"))
    media = ImageLibrary(os.environ.get("CMS_MEDIA_DIR", "/var/lib/ryanfitter-admin/media"))
    cv = CvVault(os.environ.get("CV_DIRECTORY", "/var/lib/ryanfitter-admin/cvs"),
                 os.environ.get("JOB_DATABASE", "/var/lib/ryanfitter-admin/jobs.sqlite3"))
    interviews = InterviewStore(os.environ.get("JOB_DATABASE", "/var/lib/ryanfitter-admin/jobs.sqlite3"))

    app.secret_key = secret
    app.config.update(
        SESSION_COOKIE_NAME="__Host-ryanfitter_admin",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_PATH="/",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        TRUSTED_HOSTS=[parsed_origin.hostname],
        MAX_CONTENT_LENGTH=6 * 1024 * 1024,
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
                "connect-src 'self'; img-src 'self' data:; form-action 'self'; "
                "style-src-attr 'unsafe-inline'"
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
            "features": {"jobs": "ready", "tasks": "ready", "cms": "ready"},
        })

    @app.get("/content/site.json")
    def published_content():
        response = jsonify(store.read()["published"])
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


    @app.route("/admin/api/media", methods=["GET", "POST"])
    def cms_media():
        if not signed_in():
            abort(401)
        if request.method == "GET":
            return jsonify({"images": media.list_images()})
        if not can_write():
            abort(403, description="Invalid request token or origin")
        try:
            uploaded = media.upload(request.files.get("file"))
            return jsonify(uploaded), 201
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    @app.get("/content/media/<filename>")
    def public_media(filename):
        image_path = media.path_for(filename)
        if image_path is None:
            abort(404)
        url = "/content/media/" + filename
        if not signed_in() and url not in published_image_urls(store.read()["published"]):
            abort(404)
        mime = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}[filename.rsplit(".", 1)[1]]
        response = send_file(image_path, mimetype=mime, conditional=False)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


    @app.route("/admin/api/cvs", methods=["GET", "POST"])
    def cvs_api():
        if not signed_in():
            abort(401)
        if request.method == "GET":
            return jsonify({"documents": cv.list()})
        if not can_write():
            abort(403)
        try:
            return jsonify({"documents": cv.upload(request.files.get("file"), request.form.get("label", ""))}), 201
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    @app.get("/admin/api/cvs/<cv_id>/download")
    def download_cv(cv_id):
        if not signed_in():
            abort(401)
        item = cv.lookup(cv_id)
        if not item:
            abort(404)
        metadata, path = item
        response = send_file(path, mimetype=metadata["mime"], as_attachment=True,
                             download_name=metadata["filename"], max_age=0)
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.post("/admin/api/cvs/<cv_id>/primary")
    def mark_cv_primary(cv_id):
        if not signed_in():
            abort(401)
        if not can_write():
            abort(403)
        try:
            cv.set_primary(cv_id)
        except LookupError:
            abort(404)
        return jsonify({"documents": cv.list()})

    @app.delete("/admin/api/cvs/<cv_id>")
    def delete_cv(cv_id):
        if not signed_in():
            abort(401)
        if not can_write():
            abort(403)
        try:
            cv.delete(cv_id)
        except LookupError:
            abort(404)
        return jsonify({"documents": cv.list()})

    @app.route("/admin/api/interviews", methods=["GET", "POST"])
    def interviews_api():
        if not signed_in():
            abort(401)
        if request.method == "GET":
            return jsonify({"events": interviews.list()})
        if not can_write():
            abort(403)
        try:
            return jsonify({"event": interviews.add(request.get_json(silent=True))}), 201
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    @app.route("/admin/api/interviews/<int:event_id>", methods=["PUT", "DELETE"])
    def interview_api(event_id):
        if not signed_in():
            abort(401)
        if not can_write():
            abort(403)
        try:
            if request.method == "DELETE":
                interviews.delete(event_id)
                return "", 204
            return jsonify({"event": interviews.update(event_id, request.get_json(silent=True))})
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except LookupError:
            abort(404)

    @app.get("/admin/api/interviews/calendar.ics")
    def interview_calendar():
        if not signed_in():
            abort(401)
        from flask import Response
        response = Response(to_ical(interviews.list()), mimetype="text/calendar")
        response.headers["Content-Disposition"] = 'attachment; filename="ryanfitter-interviews.ics"'
        response.headers["Cache-Control"] = "no-store, private"
        return response

    @app.get("/admin/api/job-matches")
    def list_job_matches():
        if not signed_in():
            abort(401)
        return jsonify(matches.list())

    @app.post("/admin/api/job-scans")
    def start_job_scan():
        if not signed_in():
            abort(401)
        if not can_write():
            abort(403)
        try:
            run_id = matches.begin()
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 409

        def worker():
            try:
                scan_matches(matches, run_id=run_id)
            except Exception:
                LOG.exception("Private job scan crashed")
                # The database lock is released; a stale run is failed on next scan.
        Thread(target=worker, daemon=True, name="ryanfitter-job-scan").start()
        return jsonify({"status": "running", "run_id": run_id}), 202

    @app.post("/admin/api/job-matches/<match_key>/action")
    def act_on_match(match_key):
        if not signed_in():
            abort(401)
        if not can_write():
            abort(403)
        if len(match_key) != 32 or any(c not in "0123456789abcdef" for c in match_key):
            abort(404)
        payload = request.get_json(silent=True)
        action = payload.get("action") if isinstance(payload, dict) else None
        if action not in ("save", "dismiss", "restore"):
            return jsonify({"error": "Unknown match action"}), 400
        match = matches.get(match_key)
        if match is None:
            abort(404)
        try:
            if action == "save":
                job = {
                    "company": match["company"], "title": match["title"],
                    "url": match["apply_url"], "location": match["location"],
                    "salary": match["salary"], "source": match["source"],
                    "status": "saved", "workplace": "unknown",
                    "notes": (match["reason"] + "\\n\\n" + match["warning"] + "\\nHours: " + match["hours"])[:10000],
                }
                try:
                    created = jobs.create(job)
                except RuntimeError as error:
                    if "already in the tracker" not in str(error):
                        raise
                    created = None
                matches.state(match_key, "saved")
                return jsonify({"success": True, "job": created})
            matches.state(match_key, "dismissed" if action == "dismiss" else "new")
            return jsonify({"success": True})
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    @app.route("/admin/api/tasks", methods=["GET", "POST"])
    def tasks_collection():
        if not signed_in():
            abort(401)
        if request.method == "GET":
            return jsonify({"tasks": tasks.all()})
        if not can_write():
            abort(403, description="Invalid request token or origin")
        try:
            return jsonify({"task": tasks.create(request.get_json())}), 201
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    @app.route("/admin/api/tasks/<int:task_id>", methods=["PUT", "DELETE"])
    def task_detail(task_id):
        if not signed_in():
            abort(401)
        if not can_write():
            abort(403, description="Invalid request token or origin")
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or type(data.get("revision")) is not int:
            return jsonify({"error": "Revision required"}), 400
        try:
            if request.method == "DELETE":
                tasks.delete(task_id, data["revision"])
                return "", 204
            return jsonify({"task": tasks.update(task_id, data.get("task"), data["revision"])})
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 409

    @app.route("/admin/api/jobs", methods=["GET", "POST"])
    def jobs_collection():
        if not signed_in():
            abort(401)
        if request.method == "GET":
            return jsonify({"jobs": jobs.all()})
        if not can_write():
            abort(403, description="Invalid request token or origin")
        try:
            job = jobs.create(request.get_json())
            return jsonify({"job": job}), 201
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 409

    @app.route("/admin/api/jobs/<int:job_id>", methods=["PUT", "DELETE"])
    def job_detail(job_id):
        if not signed_in():
            abort(401)
        if not can_write():
            abort(403, description="Invalid request token or origin")
        payload = request.get_json()
        if not isinstance(payload, dict) or type(payload.get("revision")) is not int:
            return jsonify({"error": "Revision required"}), 400
        try:
            if request.method == "DELETE":
                jobs.delete(job_id, payload["revision"])
                return "", 204
            result = jobs.update(job_id, payload.get("job"), payload["revision"])
            return jsonify({"job": result})
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 409

    def can_write():
        csrf = request.headers.get("X-CSRF-Token", "")
        return (bool(csrf) and hmac.compare_digest(csrf, session.get("csrf", ""))
                and request.headers.get("Origin") == origin)

    @app.route("/admin/api/cms", methods=["GET", "PUT"])
    @app.post("/admin/api/cms/publish")
    def cms_content():
        if not signed_in():
            abort(401)
        if request.method == "GET":
            return jsonify(store.read())
        csrf = request.headers.get("X-CSRF-Token", "")
        if (not csrf or not hmac.compare_digest(csrf, session.get("csrf", ""))
                or request.headers.get("Origin") != origin):
            abort(403, description="Invalid request token or origin")
        payload = request.get_json()
        if not isinstance(payload, dict) or type(payload.get("revision")) is not int:
            abort(400, description="A content revision is required")
        try:
            if request.path.endswith("/publish"):
                return jsonify(store.publish(payload["revision"]))
            return jsonify(store.save(payload.get("document"), payload["revision"]))
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 409

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
    @app.get("/admin/cms")
    @app.get("/admin/tasks")
    @app.get("/admin/jobs")
    @app.get("/admin/job-matches")
    @app.get("/admin/cvs")
    @app.get("/admin/interviews")
    def dashboard():
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
