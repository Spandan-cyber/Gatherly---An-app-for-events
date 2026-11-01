import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app, init_db

class TestEvents(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()
        init_db()

    def test_events_api_list(self):
        """Verify the public events list endpoint returns valid JSON."""
        res = self.client.get('/api/events')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, (list, dict))

    def test_events_filter_category(self):
        """Verify filtering events by category works without server error."""
        res = self.client.get('/api/events?category=Concert')
        self.assertEqual(res.status_code, 200)

    def test_events_filter_city(self):
        """Verify filtering events by city works without server error."""
        res = self.client.get('/api/events?city=Mumbai')
        self.assertEqual(res.status_code, 200)

    def test_create_event_unauthorized(self):
        """Verify unauthorized users cannot create events without signing in."""
        res = self.client.post('/api/events/create', data={
            'title': 'Unauthorized Event',
            'category': 'Meetup'
        })
        self.assertIn(res.status_code, (401, 302, 403))

    def test_nonexistent_event_detail(self):
        """Verify non-existent event public ID returns 404."""
        res = self.client.get('/api/events/does-not-exist-9999')
        self.assertEqual(res.status_code, 404)

if __name__ == '__main__':
    unittest.main()
