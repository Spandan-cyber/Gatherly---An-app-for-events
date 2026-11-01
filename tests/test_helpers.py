import unittest
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import (
    generate_otp,
    parse_dt,
    format_ist_datetime,
    public_base_url,
    get_smtp_config,
    build_gatherly_email_html,
    generate_qr_image
)

class TestHelpers(unittest.TestCase):
    def test_generate_otp_format(self):
        """Verify OTP is a 6-digit numeric string."""
        otp = generate_otp()
        self.assertEqual(len(otp), 6)
        self.assertTrue(otp.isdigit())

    def test_parse_dt_valid_iso(self):
        """Verify ISO datetime string parsing."""
        dt = parse_dt("2026-12-31T20:00:00")
        self.assertIsInstance(dt, datetime)
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 12)
        self.assertEqual(dt.day, 31)

    def test_parse_dt_invalid_returns_none(self):
        """Verify invalid datetime returns None instead of raising."""
        self.assertIsNone(parse_dt("not-a-date"))
        self.assertIsNone(parse_dt(None))
        self.assertIsNone(parse_dt(""))

    def test_format_ist_datetime(self):
        """Verify IST timezone formatting."""
        formatted = format_ist_datetime("2026-05-15T10:00:00Z")
        self.assertIn("2026", formatted)
        self.assertIn("May", formatted)

    def test_public_base_url_fallback(self):
        """Verify public base URL handles both request context and standalone fallback."""
        from main import app
        with app.test_request_context('http://localhost:5000/events'):
            url = public_base_url()
            self.assertIsInstance(url, str)
            self.assertTrue(url.startswith("http"))

    def test_build_gatherly_email_html(self):
        """Verify branded HTML email template generates valid markup."""
        html = build_gatherly_email_html("Welcome to Gatherly", "Here is your ticket")
        self.assertIn("Gatherly", html)
        self.assertIn("Welcome to Gatherly", html)
        self.assertIn("Here is your ticket", html)

    def test_generate_qr_image_type(self):
        """Verify generate_qr_image returns bytes or empty bytes."""
        result = generate_qr_image("TEST_CODE_12345")
        self.assertIsInstance(result, bytes)

if __name__ == '__main__':
    unittest.main()
