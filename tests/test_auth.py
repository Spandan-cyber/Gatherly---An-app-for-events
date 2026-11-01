import unittest
import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app, init_db
from database import get_db

class TestAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        cls.client = app.test_client()
        init_db()

    def test_signup_validation_missing_fields(self):
        """Verify signup rejects incomplete user data."""
        res = self.client.post('/api/signup', json={
            'email': 'incomplete@test.com'
        })
        self.assertEqual(res.status_code, 400)

    def test_signup_validation_short_password(self):
        """Verify signup rejects passwords shorter than 8 characters."""
        res = self.client.post('/api/signup', json={
            'full_name': 'Test User',
            'email': 'shortpass@test.com',
            'password': '123'
        })
        self.assertEqual(res.status_code, 400)

    def test_login_invalid_credentials(self):
        """Verify login fails cleanly with non-existent user."""
        res = self.client.post('/api/login', json={
            'email': 'doesnotexist999@gatherly.test',
            'password': 'WrongPassword123!'
        })
        self.assertIn(res.status_code, (400, 401))
        data = res.get_json()
        self.assertFalse(data.get('success', False))

    def test_logout_endpoint(self):
        """Verify logout endpoint clears user session."""
        res = self.client.post('/api/logout')
        self.assertEqual(res.status_code, 200)

if __name__ == '__main__':
    unittest.main()
