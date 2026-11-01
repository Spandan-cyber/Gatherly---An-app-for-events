import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app, init_db

class TestGateAndSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()
        init_db()

    def test_security_headers_present(self):
        """Verify essential HTTP security headers are set on all responses."""
        res = self.client.get('/')
        self.assertEqual(res.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(res.headers.get('X-Frame-Options'), 'DENY')
        self.assertIn('strict-origin', res.headers.get('Referrer-Policy', ''))

    def test_gate_page_accessible(self):
        """Verify gate scanner route returns 200."""
        res = self.client.get('/gate')
        self.assertEqual(res.status_code, 200)

    def test_super_admin_forbidden_for_anonymous(self):
        """Verify anonymous user cannot access super-admin dashboard."""
        res = self.client.get('/super-admin')
        self.assertIn(res.status_code, (401, 403, 302))

    def test_super_admin_api_forbidden_for_anonymous(self):
        """Verify anonymous user cannot access super-admin API endpoints."""
        res = self.client.get('/api/super-admin/accounts')
        self.assertIn(res.status_code, (401, 403, 302))

    def test_host_dashboard_requires_auth(self):
        """Verify host dashboard redirects unauthenticated visitors to login."""
        res = self.client.get('/host/dashboard')
        self.assertIn(res.status_code, (401, 302))

    def test_account_page_requires_auth(self):
        """Verify account settings page redirects unauthenticated visitors."""
        res = self.client.get('/account')
        self.assertIn(res.status_code, (401, 302))

    def test_account_activity_unauthorized(self):
        """Verify activity feed requires authentication."""
        res = self.client.get('/api/account/activity')
        self.assertIn(res.status_code, (401, 302))

    def test_otp_verification_invalid_code(self):
        """Verify OTP verification rejects invalid code."""
        res = self.client.post('/api/verify-otp', json={
            'email': 'nobody@gatherly.test',
            'otp': '000000',
            'purpose': 'signup_verification'
        })
        self.assertIn(res.status_code, (400, 401, 404))

    def test_password_reset_request_empty_email(self):
        """Verify password reset request fails on empty or unknown email."""
        res = self.client.post('/api/request-password-reset', json={
            'email': ''
        })
        self.assertEqual(res.status_code, 404)

if __name__ == '__main__':
    unittest.main()
