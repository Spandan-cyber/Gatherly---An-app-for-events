import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import (
    translate_placeholders,
    format_sql_for_pg,
    normalize_postgres_url,
    Row,
    TABLES_WITHOUT_ID
)

class TestDatabaseLayer(unittest.TestCase):
    def test_translate_placeholders_basic(self):
        """Test conversion of SQLite ? placeholders to PostgreSQL %s."""
        sql = "SELECT * FROM users WHERE email = ? AND is_verified = ?"
        translated = translate_placeholders(sql)
        self.assertEqual(translated, "SELECT * FROM users WHERE email = %s AND is_verified = %s")

    def test_translate_placeholders_preserved_in_quotes(self):
        """Verify ? inside string literals is preserved."""
        sql = "SELECT * FROM events WHERE description = 'Is this working?' AND id = ?"
        translated = translate_placeholders(sql)
        self.assertEqual(translated, "SELECT * FROM events WHERE description = 'Is this working?' AND id = %s")

    def test_format_sql_for_pg_insert_or_ignore(self):
        """Verify INSERT OR IGNORE is translated to ON CONFLICT DO NOTHING."""
        sql = "INSERT OR IGNORE INTO movie_favourites (user_id, movie_id) VALUES (?, ?)"
        formatted = format_sql_for_pg(sql)
        self.assertIn("ON CONFLICT DO NOTHING", formatted)
        self.assertNotIn("OR IGNORE", formatted)

    def test_format_sql_for_pg_collate_nocase(self):
        """Verify COLLATE NOCASE is safely removed for PostgreSQL compatibility."""
        sql = "SELECT * FROM users WHERE email = ? COLLATE NOCASE"
        formatted = format_sql_for_pg(sql)
        self.assertNotIn("COLLATE NOCASE", formatted)

    def test_format_sql_for_pg_group_concat(self):
        """Verify SQLite GROUP_CONCAT is translated to PostgreSQL STRING_AGG."""
        sql = "SELECT GROUP_CONCAT(name, ', ') FROM categories"
        formatted = format_sql_for_pg(sql)
        self.assertIn("STRING_AGG", formatted)
        self.assertNotIn("GROUP_CONCAT", formatted)

    def test_format_sql_for_pg_blob_to_bytea(self):
        """Verify BLOB type is converted to BYTEA for Postgres."""
        sql = "CREATE TABLE test (data BLOB)"
        formatted = format_sql_for_pg(sql)
        self.assertIn("BYTEA", formatted)
        self.assertNotIn("BLOB", formatted)

    def test_format_sql_for_pg_transactions(self):
        """Verify SQLite BEGIN IMMEDIATE/EXCLUSIVE are mapped to safe statements."""
        self.assertEqual(format_sql_for_pg("BEGIN IMMEDIATE"), "SELECT 1")
        self.assertEqual(format_sql_for_pg("BEGIN EXCLUSIVE;"), "SELECT 1")

    def test_normalize_postgres_url(self):
        """Verify postgres:// is rewritten to postgresql:// and sslmode is ensured."""
        url = "postgres://user:pass@host.supabase.co:5432/dbname"
        normalized = normalize_postgres_url(url)
        self.assertTrue(normalized.startswith("postgresql://"))
        self.assertIn("sslmode=require", normalized)

    def test_row_emulation_dict_and_index_access(self):
        """Test custom Row class mimicking sqlite3.Row for PostgreSQL results."""
        class MockCol:
            def __init__(self, name):
                self.name = name

        desc = [MockCol("id"), MockCol("title"), MockCol("price")]
        values = (42, "Rock Concert", 199.99)
        row = Row(desc, values)

        # Index access
        self.assertEqual(row[0], 42)
        self.assertEqual(row[1], "Rock Concert")
        self.assertEqual(row[2], 199.99)

        # Key access
        self.assertEqual(row["id"], 42)
        self.assertEqual(row["title"], "Rock Concert")

        # Case-insensitive key access
        self.assertEqual(row["TITLE"], "Rock Concert")
        self.assertEqual(row["Title"], "Rock Concert")

        # Dictionary / keys / items
        self.assertEqual(row.keys(), ["id", "title", "price"])
        self.assertEqual(row.get("non_existent", "fallback"), "fallback")
        self.assertIn("title", row)
        self.assertEqual(len(row), 3)

    def test_tables_without_id_set(self):
        """Ensure critical junction tables are listed in TABLES_WITHOUT_ID."""
        self.assertIn("movie_favourites", TABLES_WITHOUT_ID)
        self.assertIn("movie_waitlist", TABLES_WITHOUT_ID)
        self.assertIn("movie_ratings", TABLES_WITHOUT_ID)

if __name__ == '__main__':
    unittest.main()
