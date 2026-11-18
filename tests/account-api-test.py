"""Exercise account API over HTTP using SQLite and a local test mail sink.

Run with PHP 8.2+, pdo_sqlite and mbstring: python3 tests/account-api-test.py
Set PHP_BINARY to use a different PHP executable.
"""
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import unittest


API = Path(__file__).resolve().parents[1] / "dist" / "api" / "auth.php"
ORIGIN = "https://olympiads.pro"


class ApiClient:
    def __init__(self, port):
        self.port = port
        self.cookie = ""
        self.csrf = ""

    def action(self, action, data=None, headers=None, query=""):
        request_headers = {}
        if self.cookie:
            request_headers["Cookie"] = self.cookie
        if data is not None:
            request_headers["Content-Type"] = "application/json"
            request_headers["X-CSRF-Token"] = self.csrf
            request_headers["Origin"] = ORIGIN
        request_headers.update(headers or {})
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        try:
            body = json.dumps(data) if data is not None else None
            method = "POST" if body is not None else "GET"
            connection.request(method, f"/api/auth.php?action={action}{query}", body, request_headers)
            response = connection.getresponse()
            cookie = response.getheader("Set-Cookie")
            if cookie:
                self.cookie = cookie.split(";", 1)[0]
            payload = json.load(response)
            self.csrf = payload.get("csrf", self.csrf)
            return response.status, payload, cookie
        finally:
            connection.close()


class TestAccountApi(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="kenguru-account-test-")
        self.addCleanup(temporary.cleanup)
        self.home = Path(temporary.name)
        root = self.home / "www" / "olympiads.pro"
        (root / "api").mkdir(parents=True)
        shutil.copyfile(API, root / "api" / "auth.php")
        (self.home / "olympiads-config.php").write_text(
            "<?php return ['mail_from' => 'noreply@olympiads.pro'];\n"
        )
        self.inbox = self.home / "mail"
        mailer = self.home / "sendmail"
        mailer.write_text('#!/bin/sh\ncat >> "$KENGURU_TEST_MAIL"\n')
        mailer.chmod(0o700)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            self.port = listener.getsockname()[1]
        command = [os.environ.get("PHP_BINARY", "php"), "-d", f"sendmail_path={mailer}",
                   "-S", f"127.0.0.1:{self.port}", "-t", str(root)]
        environment = {**os.environ, "HTTPS": "on", "KENGURU_TEST_MAIL": str(self.inbox)}
        self.server = subprocess.Popen(command, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        self.addCleanup(self.stop_server)
        self.client = ApiClient(self.port)
        for _ in range(50):
            try:
                self.assertEqual(self.client.action("session")[0], 200)
                break
            except ConnectionRefusedError:
                if self.server.poll() is not None:
                    self.fail(self.server.stderr.read().decode())
                time.sleep(0.02)
        else:
            self.fail("PHP test server never started")

    def stop_server(self):
        self.server.terminate()
        self.server.communicate(timeout=10)

    def test_https_is_required(self):
        environment = {**os.environ, "REQUEST_METHOD": "GET", "HTTP_X_FORWARDED_PROTO": "https"}
        environment.pop("HTTPS", None)
        result = subprocess.run([os.environ.get("PHP_BINARY", "php"), str(API)],
                                env=environment, check=True, capture_output=True, timeout=5)
        self.assertIn("защищённое соединение", json.loads(result.stdout)["error"])

    def test_login_recovery_and_session_security(self):
        _, initial, _ = self.client.action("session")
        self.assertIsNone(initial["user"])
        old_cookie = self.client.cookie
        account = {"username": "Математик", "email": "user@example.test", "password": "long-first-password"}
        self.assertEqual(self.client.action("register", account, {"X-CSRF-Token": "wrong"})[0], 403)
        self.assertEqual(self.client.action("register", account, {"Origin": "https://other.example"})[0], 403)
        status, signed_in, cookie = self.client.action("register", account)
        self.assertEqual(status, 201)
        self.assertEqual(signed_in["user"]["username"], account["username"])
        self.assertNotEqual(self.client.cookie, old_cookie)
        self.assertNotEqual(signed_in["csrf"], initial["csrf"])
        self.assertTrue(cookie.startswith("__Host-kenguru_account="))
        for attribute in ("secure", "httponly", "samesite=lax", "path=/"):
            self.assertIn(attribute, cookie.lower())
        self.assertNotIn("domain=", cookie.lower())
        duplicate = {**account, "username": "математик", "email": "other@example.test"}
        self.assertEqual(self.client.action("register", duplicate)[0], 409)
        second = ApiClient(self.port)
        second.action("session")
        self.assertEqual(second.action("login", {"login": "none", "password": account["password"]})[0], 401)
        self.assertEqual(second.action("login", {"login": "МАТЕМАТИК", "password": account["password"]})[0], 200)
        _, unknown_email, _ = second.action("request-reset", {"email": "none@example.test"})
        self.assertFalse(self.inbox.exists())
        _, known_email, _ = second.action("request-reset", {"email": account["email"]})
        self.assertEqual(known_email, unknown_email)
        mail = self.inbox.read_text()
        token = re.search(r"https://olympiads\.pro/#reset=([a-f0-9]{64})", mail).group(1)
        database = self.home / ".olympiads-auth" / "accounts.sqlite"
        self.assertNotIn(token.encode(), database.read_bytes())
        recovery = ApiClient(self.port)
        recovery.action("session")
        reset = {"token": token, "password": "long-new-password"}
        self.assertEqual(recovery.action("reset", {**reset, "password": "short"})[0], 422)
        self.assertEqual(recovery.action("reset", reset)[0], 200)
        self.assertEqual(recovery.action("reset", reset)[0], 422)
        self.assertIsNone(self.client.action("session")[1]["user"])
        self.assertIsNone(second.action("session")[1]["user"])
        self.assertEqual(second.action("login", {"login": account["email"], "password": account["password"]})[0], 401)
        self.assertEqual(second.action("login", {"login": account["email"].upper(), "password": reset["password"]})[0], 200)
        self.assertIsNone(second.action("logout", {})[1]["user"])
        self.assertIsNone(second.action("session")[1]["user"])

    def test_expired_token_and_reset_rate_limit(self):
        email = "user@example.test"
        self.assertEqual(self.client.action("register", {
            "username": "test", "email": email, "password": "long-first-password"
        })[0], 201)
        for _ in range(3):
            self.assertEqual(self.client.action("request-reset", {"email": email})[0], 200)
        mail = self.inbox.read_text()
        self.assertEqual(mail.count("https://olympiads.pro/#reset="), 3)
        self.assertEqual(self.client.action("request-reset", {"email": email})[0], 200)
        self.assertEqual(self.inbox.read_text(), mail)
        tokens = re.findall(r"#reset=([a-f0-9]{64})", mail)
        self.assertEqual(self.client.action("reset", {"token": tokens[0], "password": "long-new-password"})[0], 422)
        database = self.home / ".olympiads-auth" / "accounts.sqlite"
        with sqlite3.connect(database) as db:
            db.execute("UPDATE accounts SET reset_expires = 1")
        self.assertEqual(self.client.action("reset", {"token": tokens[-1], "password": "long-new-password"})[0], 422)

    def test_registration_and_login_rate_limits(self):
        for _ in range(12):
            self.assertEqual(self.client.action("register", {})[0], 422)
        self.assertEqual(self.client.action("register", {})[0], 429)
        login = {"login": "nonexistent", "password": "a-long-test-password"}
        for _ in range(12):
            self.assertEqual(self.client.action("login", login)[0], 401)
        self.assertEqual(self.client.action("login", login)[0], 429)

    def test_progress_authorization_validation_and_revision(self):
        lesson = "2025-3-4/8"
        rating = f"rating:{lesson}"
        paper = f"paper:{lesson}:grid"
        completed = json.dumps({"step": 2, "selected": 1, "seen": True, "reviewOpened": True})
        draft = json.dumps([{"type": "line", "color": "#69acfd", "points": [[2, 3], [12, 42]], "cells": []}])
        values = {lesson: completed, "current": json.dumps(lesson), rating: "reviewed", paper: draft}
        status, _, _ = self.client.action("progress")
        self.assertEqual(status, 401)
        _, signed_in, _ = self.client.action("register", {
            "username": "reader", "email": "reader@example.test", "password": "a-long-test-password"
        })
        account = signed_in["user"]["id"]
        self.assertEqual(self.client.action("progress", query=f"&accountId={account}")[1], {
            "revision": 0, "progress": {}
        })
        update = {"revision": 0, "progress": values, "accountId": account}
        self.assertEqual(self.client.action("progress", update)[1], {"revision": 1, "progress": values})
        second = ApiClient(self.port)
        second.action("session")
        self.assertEqual(second.action("login", {"login": "reader", "password": "a-long-test-password"})[0], 200)
        self.assertEqual(second.action("progress")[1]["progress"], values)
        self.assertEqual(second.action("progress", query=f"&accountId={account + 1}")[0], 409)
        self.assertEqual(second.action("progress", {**update, "accountId": account + 1})[0], 409)
        status, conflict, _ = second.action("progress", update)
        self.assertEqual(status, 409)
        self.assertEqual(conflict["revision"], 1)
        self.assertEqual(conflict["progress"], values)
        reset_lesson = json.dumps({"step": 0, "selected": None, "seen": False, "reviewOpened": False})
        status, merged, _ = second.action("progress", {
            "revision": 1, "progress": {lesson: reset_lesson, rating: "solved"}
        })
        self.assertEqual(status, 200)
        self.assertEqual(merged["revision"], 2)
        self.assertEqual(merged["progress"][rating], "reviewed")
        self.assertTrue(json.loads(merged["progress"][lesson])["seen"])
        self.assertTrue(json.loads(merged["progress"][lesson])["reviewOpened"])
        self.assertEqual(merged["progress"][paper], draft)
        rejected = {
            paper: json.dumps([{"type": "line", "color": '"><svg>', "points": [[1, 2]]}])
        }
        self.assertEqual(second.action("progress", {"revision": 2, "progress": rejected})[0], 422)
        self.assertEqual(second.action("progress", {"revision": 2, "progress": {"__proto__": "{}"}})[0], 422)
        self.assertEqual(second.action("progress")[1], merged)
        guest = ApiClient(self.port)
        guest.action("session")
        guest.action("register", {"username": "other", "email": "other@example.test", "password": "separate-password"})
        self.assertEqual(guest.action("progress")[1], {"revision": 0, "progress": {}})


if __name__ == "__main__":
    unittest.main()
