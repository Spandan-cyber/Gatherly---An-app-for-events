import unittest
import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app, init_db

class TestCinema(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()
        init_db()

    def test_showtimes_api(self):
        """Verify cinema showtimes API endpoint returns 200 with list."""
        res = self.client.get('/api/cinema/showtimes')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, (list, dict))

    def test_cinema_manager_unauthorized(self):
        """Verify cinema manager page redirects or blocks non-theatre users."""
        res = self.client.get('/movies/manage')
        self.assertIn(res.status_code, (401, 403, 302))

    def test_cinema_reservations_unauthorized(self):
        """Verify fetching reservations without auth returns 401."""
        res = self.client.get('/api/cinema/my-reservations')
        self.assertEqual(res.status_code, 401)

    def test_cinema_reservation_creation_unauthorized(self):
        """Verify unauthenticated user cannot reserve cinema seats."""
        res = self.client.post('/api/cinema/showtimes/1/reservations', json={
            'seats': ['A1', 'A2']
        })
        self.assertIn(res.status_code, (401, 302))

    def test_movie_actions_unauthorized(self):
        """Verify movie like/favourite actions require user authentication."""
        res = self.client.post('/api/cinema/movie-actions', json={
            'movie_id': 1,
            'action': 'favourite'
        })
        self.assertIn(res.status_code, (401, 403))

    def test_movie_ratings_unauthorized(self):
        """Verify rating a movie requires authentication."""
        res = self.client.post('/api/cinema/movie-ratings', json={
            'movie_id': 1,
            'rating': 5
        })
        self.assertEqual(res.status_code, 401)

if __name__ == '__main__':
    unittest.main()
