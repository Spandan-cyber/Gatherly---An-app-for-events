import unittest
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app, init_db, normalize_date_str, normalize_time_str, normalize_ai_event_create

class TestBasicApp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        cls.client = app.test_client()

    def test_homepage_status(self):
        """Verify homepage loads successfully."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'GATHERLY', response.data)

    def test_movies_page_status(self):
        """Verify movies discovery page responds."""
        response = self.client.get('/movies')
        self.assertIn(response.status_code, (200, 302))

    def test_static_css_accessible(self):
        """Verify core CSS stylesheet is accessible."""
        response = self.client.get('/static/css/style.css')
        self.assertEqual(response.status_code, 200)

    def test_404_error_handler(self):
        """Verify non-existent routes return 404 cleanly."""
        response = self.client.get('/non_existent_page_12345')
        self.assertEqual(response.status_code, 404)

if __name__ == '__main__':
    unittest.main()
