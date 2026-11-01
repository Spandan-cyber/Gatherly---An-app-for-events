import unittest
import os
import sys
import re

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

class TestAccessibility(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()
        cls.home_html = cls.client.get('/').data.decode('utf-8')

    def test_html_has_lang_attribute(self):
        """Ensure <html> specifies lang attribute for screen readers (WCAG 3.1.1)."""
        self.assertRegex(self.home_html, r'<html[^>]*lang=["\'][a-zA-Z-]+["\']')

    def test_skip_to_main_content_link(self):
        """Ensure skip-link exists as the first landmark in body (WCAG 2.4.1)."""
        self.assertIn('class="skip-link"', self.home_html)
        self.assertIn('href="#mainContent"', self.home_html)

    def test_main_landmark_has_id(self):
        """Ensure main content landmark exists with matching id."""
        self.assertIn('<main id="mainContent"', self.home_html)

    def test_form_inputs_have_associated_labels(self):
        """Ensure form inputs have associated label for attributes (WCAG 1.3.1, 4.1.2)."""
        # Find all inputs with an id in the homepage HTML
        input_ids = re.findall(r'<input[^>]+id=["\']([a-zA-Z0-9_-]+)["\']', self.home_html)
        # Check that essential form inputs have a corresponding label for attribute
        for input_id in ['loginEmail', 'loginPassword', 'signupName', 'signupEmail', 'signupPassword',
                          'evTitle', 'evDate', 'evTime', 'evCity', 'evVenue']:
            if input_id in input_ids:
                expected_label = f'for="{input_id}"'
                self.assertIn(expected_label, self.home_html, f"Input #{input_id} is missing matching <label for='{input_id}'>")

    def test_modal_dialog_accessibility(self):
        """Ensure modals have role='dialog' and aria-modal='true' (WAI-ARIA 1.2)."""
        self.assertIn('role="dialog"', self.home_html)
        self.assertIn('aria-modal="true"', self.home_html)

    def test_modal_close_buttons_have_aria_label(self):
        """Ensure icon-only close buttons have aria-label."""
        self.assertRegex(self.home_html, r'<button[^>]+aria-label=["\']Close[^"\']+["\']')

    def test_css_includes_focus_visible_and_reduced_motion(self):
        """Ensure CSS provides visible focus indicators and supports prefers-reduced-motion."""
        css = self.client.get('/static/css/style.css').data.decode('utf-8')
        self.assertIn(':focus-visible', css)
        self.assertIn('prefers-reduced-motion', css)
        self.assertIn('.skip-link', css)

if __name__ == '__main__':
    unittest.main()
