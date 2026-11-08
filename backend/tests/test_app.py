"""Run with python -m unittest discover -s backend/tests -v."""
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

os.environ.update({
    "COOKIE_SECRET": "for-tests-only-" + ("z" * 48),
    "COGNITO_ALLOWED_SUBS": "approved-existing-tradinglab-sub",
    "COGNITO_CLIENT_ID": "test-personal-client",
    "COGNITO_USER_POOL_ID": "eu-west-2_TestPool",
    "COGNITO_DOMAIN": "https://auth-example.auth.eu-west-2.amazoncognito.com",
    "SITE_ORIGIN": "https://ryanfitter.co.uk",
    "AWS_REGION": "eu-west-2",
})

from backend.app import create_app  # noqa: E402


class DashboardAuthTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        Path(self.temp.name, "index.html").write_text("<html>private shell</html>", encoding="utf-8")
        self.env = patch.dict(os.environ, {"DIST_DIR": self.temp.name})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.app = create_app()
        self.app.testing = True
        # Production accepts only ryanfitter.co.uk. Unit tests use localhost.
        self.app.config["TRUSTED_HOSTS"] = ["localhost", "ryanfitter.co.uk"]
        self.client = self.app.test_client()

    def test_anonymous_admin_redirect_and_api_deny(self):
        response = self.client.get("/admin")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/admin/login")
        self.assertEqual(response.headers["X-Robots-Tag"], "noindex, nofollow")
        api = self.client.get("/admin/api/session")
        self.assertEqual(api.status_code, 401)
        self.assertFalse(api.json["authenticated"])

    def test_login_uses_code_pkce_state_and_nonce(self):
        response = self.client.get("/admin/login")
        self.assertEqual(response.status_code, 302)
        parsed = urlparse(response.headers["Location"])
        self.assertEqual(parsed.path, "/oauth2/authorize")
        query = parse_qs(parsed.query)
        self.assertEqual(query["response_type"], ["code"])
        self.assertEqual(query["code_challenge_method"], ["S256"])
        self.assertEqual(query["redirect_uri"], ["https://ryanfitter.co.uk/admin/auth/callback"])
        self.assertTrue(query.get("state"))
        self.assertTrue(query.get("nonce"))
        self.assertTrue(query.get("code_challenge"))
        self.assertIn("Secure", response.headers["Set-Cookie"])
        self.assertIn("HttpOnly", response.headers["Set-Cookie"])

    def mock_callback(self, sub="approved-existing-tradinglab-sub"):
        login = self.client.get("/admin/login")
        self.assertEqual(login.status_code, 302)
        with self.client.session_transaction() as cookie:
            state = cookie["oauth_state"]
            nonce = cookie["oauth_nonce"]

        payload = {
            "sub": sub,
            "nonce": nonce,
            "email": "existing@example.invalid",
            "email_verified": True,
        }
        fake_response = SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"id_token": "signed-id-token"},
        )
        with (
            patch("backend.app.requests.post", return_value=fake_response),
            patch("backend.app.jwt.PyJWKClient.get_signing_key_from_jwt", return_value=SimpleNamespace(key="key")),
            patch("backend.app.jwt.decode", return_value=payload),
        ):
            return self.client.get("/admin/auth/callback?code=test-code&state=" + state)

    def test_approved_identity_can_access_dashboard(self):
        callback = self.mock_callback()
        self.assertEqual(callback.status_code, 303)
        self.assertEqual(callback.headers["Location"], "/admin")
        page = self.client.get("/admin")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"private shell", page.data)
        api = self.client.get("/admin/api/session")
        self.assertTrue(api.json["authenticated"])
        self.assertNotIn("id_token", api.json)

    def test_denied_identity_cannot_access_dashboard(self):
        callback = self.mock_callback("someone-else")
        self.assertEqual(callback.status_code, 403)
        self.assertEqual(self.client.get("/admin/api/session").status_code, 401)

    def test_callback_rejects_invalid_state(self):
        self.client.get("/admin/login")
        response = self.client.get("/admin/auth/callback?code=test-code&state=wrong")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get("/admin/api/session").status_code, 401)

    def test_logout_requires_csrf_and_clears_session(self):
        self.assertEqual(self.mock_callback().status_code, 303)
        wrong = self.client.post("/admin/logout", data={"csrf": "wrong"})
        self.assertEqual(wrong.status_code, 403)
        csrf = self.client.get("/admin/api/session").json["csrf"]
        done = self.client.post("/admin/logout", data={"csrf": csrf}, headers={"Origin": "https://ryanfitter.co.uk"})
        self.assertEqual(done.status_code, 303)
        self.assertEqual(self.client.get("/admin/api/session").status_code, 401)

    def test_missing_allowlist_fails_closed(self):
        with patch.dict(os.environ, {"COGNITO_ALLOWED_SUBS": ""}):
            with self.assertRaises(RuntimeError):
                create_app()


if __name__ == "__main__":
    unittest.main()
