import unittest
import os
import sys
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app, normalize_date_str, normalize_time_str, normalize_ai_event_create

class TestAiAssistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()

    def test_normalize_date_iso(self):
        """Test ISO format date normalization."""
        self.assertEqual(normalize_date_str('2026-12-31'), '2026-12-31')

    def test_normalize_date_human(self):
        """Test human readable date formats (e.g. 31 Dec 2026, December 31, 2026)."""
        self.assertEqual(normalize_date_str('31 Dec 2026'), '2026-12-31')
        self.assertEqual(normalize_date_str('December 31, 2026'), '2026-12-31')
        self.assertEqual(normalize_date_str('2026/12/31'), '2026-12-31')

    def test_normalize_date_fallback(self):
        """Test that missing or invalid date falls back to default date."""
        self.assertEqual(normalize_date_str(None, default_date='2026-11-20'), '2026-11-20')
        self.assertEqual(normalize_date_str('', default_date='2026-11-20'), '2026-11-20')
        self.assertEqual(normalize_date_str('invalid-date', default_date='2026-11-20'), '2026-11-20')

    def test_normalize_time_24h(self):
        """Test standard 24h format normalization."""
        self.assertEqual(normalize_time_str('19:00'), '19:00')
        self.assertEqual(normalize_time_str('09:30'), '09:30')
        self.assertEqual(normalize_time_str('23:45'), '23:45')

    def test_normalize_time_12h_meridiem(self):
        """Test 12h formats like 7:00 PM, 7 PM, 7pm, 9:30 AM."""
        self.assertEqual(normalize_time_str('7:00 PM'), '19:00')
        self.assertEqual(normalize_time_str('7 PM'), '19:00')
        self.assertEqual(normalize_time_str('7pm'), '19:00')
        self.assertEqual(normalize_time_str('9:30 AM'), '09:30')
        self.assertEqual(normalize_time_str('12:00 PM'), '12:00')
        self.assertEqual(normalize_time_str('12:00 AM'), '00:00')

    def test_normalize_time_fallback(self):
        """Test missing time defaults to 19:00."""
        self.assertEqual(normalize_time_str(None), '19:00')
        self.assertEqual(normalize_time_str(''), '19:00')

    def test_normalize_ai_event_create_full(self):
        """Test complete action normalization including price and capacity."""
        action = {
            'type': 'event_create',
            'fields': {
                'title': 'Indie Rock Carnival',
                'category': 'Concert',
                'venue': 'Blue Frog',
                'city': 'Mumbai',
                'description': 'An evening of live indie rock.',
                'event_date': '31 Dec 2026',
                'event_time': '8:00 PM',
                'visibility': 'PUBLIC',
                'is_paid': True,
                'ticket_price': 500.0,
                'ticket_limit': 200
            }
        }
        res = normalize_ai_event_create(action)
        self.assertEqual(res['type'], 'event_create')
        self.assertEqual(res['fields']['title'], 'Indie Rock Carnival')
        self.assertEqual(res['fields']['event_date'], '2026-12-31')
        self.assertEqual(res['fields']['event_time'], '20:00')
        self.assertEqual(res['fields']['venue'], 'Blue Frog')
        self.assertEqual(res['fields']['city'], 'Mumbai')
        self.assertTrue(res['fields']['is_paid'])
        self.assertEqual(res['fields']['ticket_price'], 500.0)

    def test_normalize_ai_event_create_autonomous_defaults(self):
        """Test that omitted date/time are autonomously populated."""
        action = {
            'type': 'event_create',
            'fields': {
                'title': 'Open Mic Comedy',
                'category': 'Comedy',
                'venue': 'Canvas Laugh Club',
                'city': 'Delhi'
            }
        }
        res = normalize_ai_event_create(action)
        self.assertIsNotNone(res['fields']['event_date'])
        self.assertRegex(res['fields']['event_date'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertEqual(res['fields']['event_time'], '19:00')
        self.assertEqual(res['fields']['visibility'], 'PUBLIC')

    def test_assistant_endpoint_input_validation(self):
        """Verify event-draft endpoint rejects empty or overly long prompt."""
        res_empty = self.client.post('/api/organizer/assistant/event-draft',
                                     json={'prompt': ''})
        self.assertEqual(res_empty.status_code, 400)

        res_long = self.client.post('/api/organizer/assistant/event-draft',
                                    json={'prompt': 'x' * 1300})
        self.assertEqual(res_long.status_code, 400)

if __name__ == '__main__':
    unittest.main()
