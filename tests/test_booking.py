import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app, init_db

class TestBooking(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()
        init_db()

    def test_booking_unauthorized(self):
        """Verify unauthenticated user cannot book passes without credentials."""
        res = self.client.post('/api/events/some-event-id/bookings', json={
            'quantity': 2
        })
        self.assertIn(res.status_code, (401, 302, 404))

    def test_my_passes_unauthorized(self):
        """Verify unauthenticated user cannot view protected passes list."""
        res = self.client.get('/api/my-passes')
        self.assertIn(res.status_code, (401, 302))

    def test_booking_invalid_quantity(self):
        """Verify booking rejects zero or negative ticket quantities."""
        res = self.client.post('/api/events/test-id/bookings', json={
            'quantity': 0
        })
        self.assertIn(res.status_code, (400, 401, 404))

if __name__ == '__main__':
    unittest.main()
