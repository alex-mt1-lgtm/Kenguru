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
        shutil.copyfile(API.with_name("rating-catalog.json"), root / "api" / "rating-catalog.json")
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
        self.client = ApiClient(self.client.port)
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

    def verification_tokens(self):
        return re.findall(r"#confirm-email=([a-f0-9]{64})", self.inbox.read_text())

    def verify_current_email(self):
        return self.client.action("verify-email", {"token": self.verification_tokens()[-1]})

    def task_records(self, account_id):
        database = self.home / ".olympiads-auth" / "accounts.sqlite"
        with sqlite3.connect(database) as db:
            records, = db.execute(
                "SELECT records_json FROM account_task_records WHERE account_id = ?", (account_id,)
            ).fetchone()
        return json.loads(records)

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
        self.assertFalse(signed_in["user"]["emailConfirmed"])
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
        self.assertTrue(self.verify_current_email()[1]["user"]["emailConfirmed"])
        before = self.inbox.read_text()
        _, unknown_email, _ = second.action("request-reset", {"email": "none@example.test"})
        self.assertEqual(self.inbox.read_text(), before)
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
        self.assertEqual(self.verify_current_email()[0], 200)
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

    def test_correct_unconfirmed_email_and_manage_account_data(self):
        password = "long-first-password"
        address = "correct@example.test"
        _, registration, _ = self.client.action("register", {
            "username": "reader", "email": "typo@example.test", "password": password
        })
        account_id = registration["user"]["id"]
        old_token = self.verification_tokens()[0]
        self.assertEqual(self.client.action("request-reset", {"email": "typo@example.test"})[0], 200)
        self.assertNotIn("#reset=", self.inbox.read_text())

        updated = {"username": "renamed", "email": address, "password": password, "accountId": account_id}
        self.assertEqual(self.client.action("edit-account", {**updated, "password": "incorrect-password"})[0], 422)
        status, profile, _ = self.client.action("edit-account", updated)
        self.assertEqual(status, 200)
        self.assertEqual(profile["user"]["username"], "renamed")
        self.assertEqual(profile["user"]["pendingEmail"], address)
        self.assertFalse(profile["user"]["emailConfirmed"])
        self.assertEqual(self.client.action("verify-email", {"token": old_token})[0], 422)
        self.assertEqual(self.client.action("send-verification", {"accountId": account_id})[0], 200)
        guest = ApiClient(self.port)
        guest.action("session")
        token = self.verification_tokens()[-1]
        status, response, _ = guest.action("verify-email", {"token": token})
        self.assertEqual(status, 200)
        self.assertIsNone(response["user"])
        self.assertEqual(guest.action("verify-email", {"token": token})[0], 422)
        status, session, _ = self.client.action("session")
        self.assertEqual(status, 200)
        self.assertEqual(session["user"]["email"], address)
        self.assertTrue(session["user"]["emailConfirmed"])
        self.assertIsNone(session["user"]["pendingEmail"])

        self.assertEqual(self.client.action("delete-account", {"password": password, "confirm": False})[0], 422)
        self.assertEqual(self.client.action("delete-account", {"password": password, "confirm": True})[0], 200)
        self.assertIsNone(self.client.action("session")[1]["user"])
        self.assertEqual(guest.action("login", {"login": address, "password": password})[0], 401)
        with sqlite3.connect(self.home / ".olympiads-auth" / "accounts.sqlite") as db:
            for table in ("accounts", "account_mail", "account_scores", "account_task_records"):
                self.assertEqual(db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0], 0)

    def test_existing_unconfirmed_account_can_keep_using_recovery(self):
        address = "before-upgrade@example.test"
        self.client.action("register", {
            "username": "migrated", "email": address, "password": "long-existing-password"
        })
        with sqlite3.connect(self.home / ".olympiads-auth" / "accounts.sqlite") as db:
            db.execute("DELETE FROM account_mail")
        self.assertFalse(self.client.action("session")[1]["user"]["emailConfirmed"])
        self.assertEqual(self.client.action("request-reset", {"email": address})[0], 200)
        self.assertIn("#reset=", self.inbox.read_text())

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

    def test_leaderboard_reprices_inactive_accounts_when_the_catalogue_changes(self):
        catalog_file = self.home / "www" / "olympiads.pro" / "api" / "rating-catalog.json"
        current_catalog = catalog_file.read_text()
        old_catalog = json.loads(current_catalog)
        english = "2025-british-bulldog-3-4/1"
        history = "2026-golden-fleece-3-4/1"
        wrong = "2026-golden-fleece-3-4/2"
        math = "2024-3-4/1"
        for lesson in (english, history, wrong):
            self.assertEqual(old_catalog[lesson][1], 3)
            old_catalog[lesson][1] = 1
        catalog_file.write_text(json.dumps(old_catalog))

        observer = ApiClient(self.port)
        for name, client, answers in [
            ("old_solver", self.client, [(english, True), (history, True), (wrong, False)]),
            ("observer", observer, [(math, True)]),
        ]:
            client.action("session")
            self.assertEqual(client.action("register", {
                "username": name, "email": name + "@example.test", "password": "long-test-password"
            })[0], 201)
            progress = {}
            for lesson, correct in answers:
                selected = old_catalog[lesson][0]
                if not correct:
                    selected = (selected + 1) % 4
                progress[lesson] = json.dumps({"step": 1, "selected": selected, "seen": False, "reviewOpened": True})
                progress["rating:" + lesson] = "solved"
            self.assertEqual(client.action("progress", {"revision": 0, "progress": progress})[0], 200)

        def standings():
            status, board, _ = observer.action("leaderboard")
            self.assertEqual(status, 200)
            return [(r["username"], r["points"], r["solved"]) for r in board["entries"]]

        self.assertEqual(standings(), [("observer", 3, 1), ("old_solver", 2, 2)])
        before = self.client.action("progress")[1]
        catalog_file.write_text(current_catalog)
        for _ in range(2):
            self.assertEqual(standings(), [("old_solver", 6, 2), ("observer", 3, 1)])
        self.assertEqual(self.client.action("progress")[1], before)

    def test_leaderboard_counts_verified_first_answers_and_keeps_names_only(self):
        self.assertEqual(self.client.action("leaderboard")[0], 401)

        def register(name, client):
            client.action("session")
            self.assertEqual(client.action("register", {
                "username": name, "email": name + "@example.test", "password": "a-long-test-password"
            })[0], 201)

        def answer(selected, step=1):
            return json.dumps({"selected": selected, "step": step, "seen": False, "reviewOpened": True})

        second, third = ApiClient(self.port), ApiClient(self.port)
        register("reader_one", self.client)
        register("reader_two", second)
        register("reader_three", third)
        first = "2024-3-4/1"
        other = "2024-3-4/2"
        unknown = "2099-3-4/1"

        status, saved, _ = self.client.action("progress", {"revision": 0, "progress": {
            first: answer(None, 0), "rating:" + first: "solved",
            other: answer(0), "rating:" + other: "solved",
            unknown: answer(4), "rating:" + unknown: "solved"
        }, "ratingAnswers": {first: 4}})
        self.assertEqual(status, 200)
        self.assertEqual(saved["progress"]["rating:" + first], "solved")
        self.assertEqual(saved["progress"]["rating:" + other], "reviewed")
        self.assertEqual(saved["progress"]["rating:" + unknown], "reviewed")
        self.assertEqual(second.action("progress", {"revision": 0, "progress": {
            other: answer(2), "rating:" + other: "solved"
        }})[0], 200)

        status, board, _ = self.client.action("leaderboard")
        self.assertEqual(status, 200)
        self.assertEqual((board["page"], board["totalPages"], board["total"]), (1, 1, 3))
        rows = board["entries"]
        self.assertEqual([(row["rank"], row["points"], row["solved"]) for row in rows],
                         [(1, 3, 1), (1, 3, 1), (3, 0, 0)])
        self.assertEqual(board["current"]["username"], "reader_one")
        self.assertEqual(set(rows[0]), {"rank", "username", "points", "solved", "isCurrent"})
        self.assertEqual(third.action("leaderboard")[1]["current"]["rank"], 3)
        self.assertEqual(third.action("leaderboard", query="&page=-2")[0], 422)
        self.assertEqual(third.action("leaderboard", query="&page=3")[1]["page"], 1)

        database = self.home / ".olympiads-auth" / "accounts.sqlite"
        with sqlite3.connect(database) as db:
            db.execute("DROP TABLE account_scores")
            db.execute("PRAGMA user_version = 1")
        self.assertEqual(self.client.action("leaderboard")[1], board)

    def test_numeric_rating_accepts_six_digit_integers_once(self):
        catalog_file = self.home / "www" / "olympiads.pro" / "api" / "rating-catalog.json"
        catalog = json.loads(catalog_file.read_text())
        large = "2024-kit-10-11/21"
        zero = "2099-kit-6-7/19"
        upper_bound = "2099-kit-6-7/20"
        wrong = "2099-kit-6-7/21"
        after_review = "2099-kit-8-9/19"
        choice = "2099-chip-eurasia-3-4-moscow-v2/1"
        self.assertEqual(catalog[large], [171700, 4, "number"])
        catalog.update({
            zero: [0, 3, "number"], upper_bound: [999999, 5, "number"],
            wrong: [132, 4, "number"], after_review: [6, 4, "number"],
            choice: [4, 3],
        })
        catalog_file.write_text(json.dumps(catalog))

        status, signed_in, _ = self.client.action("register", {
            "username": "numeric_reader", "email": "numeric@example.test", "password": "numeric-reader-password"
        })
        self.assertEqual(status, 201)
        account_id = signed_in["user"]["id"]

        def state(selected, step=1):
            return json.dumps({"selected": selected, "step": step, "seen": False, "reviewOpened": True})

        for invalid in (-1, 1000000, 1.5, "0", True):
            with self.subTest(invalid=invalid):
                for progress, claims in (
                    ({zero: state(invalid)}, {}),
                    ({zero: state(0), "rating:" + zero: "solved"}, {zero: invalid}),
                ):
                    self.assertEqual(self.client.action("progress", {
                        "revision": 0, "progress": progress, "ratingAnswers": claims
                    })[0], 422)
        self.assertEqual(self.client.action("progress", {
            "revision": 0, "progress": {choice: state(4), "rating:" + choice: "solved"},
            "ratingAnswers": {choice: 5},
        })[0], 422)
        self.assertEqual(self.client.action("progress")[1], {"revision": 0, "progress": {}})
        self.assertEqual(self.client.action("progress", {
            "revision": 0, "progress": {after_review: state(None)}
        })[0], 200)
        progress = {
            large: state(None, step=0), zero: state(0), upper_bound: state(999999),
            wrong: state(131), after_review: state(6), choice: state(4),
        }
        progress.update({"rating:" + lesson: "solved" for lesson in tuple(progress)})
        submission = {"revision": 1, "progress": progress, "ratingAnswers": {large: 171700, zero: 0}}
        status, saved, _ = self.client.action("progress", submission)
        self.assertEqual(status, 200)
        self.assertEqual(saved["revision"], 2)
        for lesson in (large, zero, upper_bound, choice):
            self.assertEqual(saved["progress"]["rating:" + lesson], "solved")
        self.assertEqual(saved["progress"]["rating:" + wrong], "reviewed")
        self.assertEqual(saved["progress"]["rating:" + after_review], "reviewed")
        self.assertEqual(self.client.action("progress", submission)[0], 409)
        self.assertEqual(self.client.action("progress", {**submission, "revision": 2})[1], saved)
        self.assertEqual(self.client.action("progress", {
            "revision": 2, "progress": {wrong: state(132), "rating:" + wrong: "solved"},
            "ratingAnswers": {wrong: 132},
        })[1]["progress"]["rating:" + wrong], "reviewed")
        records = self.task_records(account_id)
        self.assertEqual({k: records[k]["firstAnswer"] for k in (large, zero, upper_bound, wrong, choice)}, {
            large: 171700, zero: 0, upper_bound: 999999, wrong: 131, choice: 4,
        })
        self.assertNotIn("firstAnswer", records[after_review])
        standing = self.client.action("leaderboard")[1]["current"]
        self.assertEqual((standing["points"], standing["solved"]), (15, 4))

    def test_russian_authorized_alternative_receives_full_points(self):
        lesson = "2003-medvezhonok-8-9/18"
        for selected, result in ((1, "solved"), (2, "solved"), (0, "reviewed")):
            client = ApiClient(self.client.port)
            status, signed_in, _ = client.action("register", {
                "username": f"language_{selected}", "email": f"language_{selected}@example.test",
                "password": "language-reader-password",
            })
            self.assertEqual(status, 201)
            progress = {lesson: json.dumps({"selected": selected, "step": 1, "seen": False, "reviewOpened": True}),
                        "rating:" + lesson: "solved"}
            status, saved, _ = client.action("progress", {
                "revision": 0, "progress": progress, "ratingAnswers": {lesson: selected},
            })
            self.assertEqual(status, 200)
            self.assertEqual(saved["progress"]["rating:" + lesson], result)
            self.assertEqual(self.task_records(signed_in["user"]["id"])[lesson]["firstAnswer"], selected)

    def test_historical_matching_has_five_independent_scores_in_each_edition(self):
        catalog_file = self.home / "www" / "olympiads.pro" / "api" / "rating-catalog.json"
        catalog = json.loads(catalog_file.read_text())
        answers = [0, 2, 1, 3, 4]
        editions = ("2004-golden-fleece-3-7", "2004-golden-fleece-8-11")
        for edition in editions:
            self.assertEqual([catalog[f"{edition}/{n}"] for n in range(1, 6)], [[a, 3] for a in answers])
        status, signed_in, _ = self.client.action("register", {
            "username": "match_reader", "email": "matching@example.test", "password": "matching-reader-password"
        })
        self.assertEqual(status, 201)
        progress, claims = {}, {}
        missed = f"{editions[0]}/2"
        for edition in editions:
            for n, answer in enumerate(answers, 1):
                lesson = f"{edition}/{n}"
                selected = 1 if lesson == missed else answer
                progress[lesson] = json.dumps({
                    "selected": selected, "step": 1, "seen": False, "reviewOpened": True
                })
                progress["rating:" + lesson] = "solved"
                claims[lesson] = selected
        status, saved, _ = self.client.action("progress", {
            "revision": 0, "progress": progress, "ratingAnswers": claims
        })
        self.assertEqual(status, 200)
        records = self.task_records(signed_in["user"]["id"])
        for lesson, selected in claims.items():
            rating = "reviewed" if lesson == missed else "solved"
            self.assertEqual(saved["progress"]["rating:" + lesson], rating)
            self.assertEqual((records[lesson]["rating"], records[lesson]["firstAnswer"]), (rating, selected))
        rating = "rating:" + missed
        status, retry, _ = self.client.action("progress", {
            "revision": 1, "progress": {
                missed: json.dumps({"selected": 2, "step": 2, "seen": True, "reviewOpened": True}),
                rating: "solved",
            }, "ratingAnswers": {missed: 2},
        })
        self.assertEqual(status, 200)
        self.assertEqual(retry["progress"][rating], "reviewed")
        standing = self.client.action("leaderboard")[1]["current"]
        self.assertEqual((standing["points"], standing["solved"]), (27, 9))


if __name__ == "__main__":
    unittest.main()
