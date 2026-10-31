"""
Gatherly Database Layer - Dual Support for Supabase PostgreSQL & SQLite
========================================================================
Seamlessly connects to Supabase PostgreSQL when DATABASE_URL or SUPABASE_DB_URL
is provided in .env, with graceful fallback to local SQLite (gatherly.db).
Includes official Supabase Python Client integration (get_supabase_client).
"""

import os
import re
import sys
import logging
import sqlite3
import secrets
from datetime import datetime
from contextlib import contextmanager
from threading import Lock
from typing import Optional, Any, List, Dict

logger = logging.getLogger("gatherly.database")

# Optional psycopg2 import
try:
    import psycopg2
    import psycopg2.extras
    from psycopg2.pool import ThreadedConnectionPool
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    ThreadedConnectionPool = None

# Optional supabase SDK import
try:
    import supabase
    from supabase import create_client, Client
    SUPABASE_SDK_AVAILABLE = True
except ImportError:
    SUPABASE_SDK_AVAILABLE = False
    Client = None

# Configuration
DB_NAME = os.getenv("DB_NAME", "gatherly.db")
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL") or ""
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or ""
).strip()
SUPABASE_DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("SUPABASE_PASSWORD") or ""

# Connection pool settings
DB_POOL_MIN = int(os.getenv("DB_POOL_MIN", "1"))
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "20"))

_pg_pool: Optional[Any] = None
_pg_pool_lock = Lock()
_supabase_client: Optional[Any] = None
_supabase_client_lock = Lock()
_db_initialized = False
_db_init_lock = Lock()

# Tables without an autoincrementing 'id' primary key
TABLES_WITHOUT_ID = {
    "movie_favourites",
    "movie_waitlist",
    "movie_ratings",
    "cinema_reservation_seats",
}


def normalize_postgres_url(url: str) -> str:
    """Normalize postgres URLs to standard postgresql:// format and ensure sslmode."""
    if not url:
        return ""
    url = url.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    # Any remote cloud host (Supabase, Render, Neon, etc.) requires SSL
    if "sslmode=" not in url and not any(h in url.lower() for h in ("localhost", "127.0.0.1")):
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


def get_effective_database_url() -> str:
    """
    Returns the resolved PostgreSQL database URL.
    Checks:
    1. DATABASE_URL / SUPABASE_DB_URL if explicitly provided in .env
    2. Auto-constructed from SUPABASE_URL + SUPABASE_DB_PASSWORD if set
    """
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL") or ""
    if url.strip():
        return normalize_postgres_url(url.strip())

    # Auto-construct from SUPABASE_URL and database password
    sb_url = os.getenv("SUPABASE_URL", "").strip()
    sb_pw = os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("SUPABASE_PASSWORD") or ""
    if sb_url and sb_pw:
        from urllib.parse import urlparse, quote_plus
        parsed = urlparse(sb_url)
        host = parsed.netloc or parsed.path
        if "." in host:
            project_ref = host.split(".")[0]
            return f"postgresql://postgres:{quote_plus(sb_pw)}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require"
    return ""


def is_postgres() -> bool:
    """Check if PostgreSQL/Supabase is configured and driver is available."""
    url = get_effective_database_url()
    return bool(url and PSYCOPG2_AVAILABLE)


def get_db_backend() -> str:
    """Return 'postgres' if Supabase PostgreSQL is active, else 'sqlite'."""
    return "postgres" if is_postgres() else "sqlite"


def get_supabase_client() -> Optional[Any]:
    """
    Returns the initialized Supabase client if SUPABASE_URL and SUPABASE_KEY are set.
    Allows accessing Supabase Auth, Storage, Edge Functions, etc.
    """
    global _supabase_client
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    if not SUPABASE_SDK_AVAILABLE:
        logger.warning("supabase python package is not installed. Run 'pip install supabase'.")
        return None

    if _supabase_client is None:
        with _supabase_client_lock:
            if _supabase_client is None:
                try:
                    _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
                    logger.info("Supabase client initialized successfully.")
                except Exception as e:
                    logger.error("Failed to initialize Supabase client: %s", e)
                    return None
    return _supabase_client


# =====================================================================
# Row Wrapper (Matching sqlite3.Row Behavior)
# =====================================================================

class Row:
    """
    A row representation that mimics sqlite3.Row for PostgreSQL results.
    Supports index access row[0], key access row['name'], case-insensitive
    lookup, .keys(), .get(), dict(row), and conversion of BYTEA to bytes.
    """
    __slots__ = ("_values", "_desc", "_map")

    def __init__(self, description, values):
        # Convert any memoryview (from BYTEA) to bytes
        clean_values = []
        for v in values:
            if isinstance(v, memoryview):
                clean_values.append(v.tobytes())
            else:
                clean_values.append(v)
        self._values = tuple(clean_values)
        self._desc = description
        self._map = {}
        if description:
            for idx, col in enumerate(description):
                col_name = col.name if hasattr(col, 'name') else col[0]
                self._map[col_name] = idx
                self._map[col_name.lower()] = idx

    def __getitem__(self, item):
        if isinstance(item, int):
            return self._values[item]
        if isinstance(item, str):
            if item in self._map:
                return self._values[self._map[item]]
            item_lower = item.lower()
            if item_lower in self._map:
                return self._values[self._map[item_lower]]
            raise KeyError(item)
        raise TypeError(f"Row indices must be integers or strings, not {type(item).__name__}")

    def __contains__(self, item):
        if isinstance(item, str):
            return item in self._map or item.lower() in self._map
        return False

    def get(self, item, default=None):
        try:
            return self[item]
        except (KeyError, IndexError):
            return default

    def keys(self) -> List[str]:
        if not self._desc:
            return []
        return [col.name if hasattr(col, 'name') else col[0] for col in self._desc]

    def values(self):
        return self._values

    def items(self):
        return list(zip(self.keys(), self._values))

    def __iter__(self):
        return iter(self._values)

    def __len__(self):
        return len(self._values)

    def __repr__(self):
        return f"<Row {dict(self.items())}>"


# =====================================================================
# SQL Compatibility & Query Translation
# =====================================================================

def translate_placeholders(sql: str) -> str:
    """
    Replaces SQLite ? parameter placeholders with PostgreSQL %s,
    safely preserving ? inside string literals.
    """
    result = []
    in_single_quote = False
    in_double_quote = False
    i = 0
    length = len(sql)
    while i < length:
        ch = sql[i]
        if ch == "'" and not in_double_quote:
            if in_single_quote and i + 1 < length and sql[i + 1] == "'":
                result.append("''")
                i += 2
                continue
            in_single_quote = not in_single_quote
            result.append(ch)
        elif ch == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            result.append(ch)
        elif not in_single_quote and not in_double_quote:
            if ch == '?':
                result.append('%s')
            else:
                result.append(ch)
        else:
            result.append(ch)
        i += 1
    return "".join(result)


def format_sql_for_pg(sql: str) -> str:
    """
    Translates common SQLite SQL constructs into standard PostgreSQL:
    1. BEGIN IMMEDIATE / EXCLUSIVE -> SELECT 1
    2. PRAGMA table_info(tbl) -> information_schema query
    3. PRAGMA (foreign_keys / others) -> SELECT 1
    4. INSERT OR IGNORE INTO -> INSERT INTO ... ON CONFLICT DO NOTHING
    5. GROUP_CONCAT(expr, delim) -> STRING_AGG((expr)::text, delim)
    6. COLLATE NOCASE -> stripped
    7. BLOB -> BYTEA
    8. ? -> %s
    """
    sql_trimmed = sql.strip()

    # 0. Intercept SQLite transaction statements
    clean_upper = re.sub(r'\s+', ' ', sql_trimmed.rstrip(';')).upper()
    if clean_upper in ("BEGIN", "BEGIN IMMEDIATE", "BEGIN EXCLUSIVE", "BEGIN DEFERRED", "BEGIN TRANSACTION"):
        return "SELECT 1"

    # 1. PRAGMA table_info(tbl)
    m = re.match(r'^\s*PRAGMA\s+table_info\((\w+)\)\s*;?\s*$', sql_trimmed, re.IGNORECASE)
    if m:
        table_name = m.group(1)
        return (
            f"SELECT column_name AS name FROM information_schema.columns "
            f"WHERE lower(table_name) = lower('{table_name}') AND table_schema = current_schema()"
        )

    # 2. PRAGMA foreign_keys = ON / OFF or any other PRAGMA
    if re.match(r'^\s*PRAGMA\s+', sql_trimmed, re.IGNORECASE):
        return "SELECT 1"

    # 3. INSERT OR IGNORE INTO ...
    if re.match(r'^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+', sql_trimmed, re.IGNORECASE):
        sql_trimmed = re.sub(r'^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+', 'INSERT INTO ', sql_trimmed, flags=re.IGNORECASE)
        if 'ON CONFLICT' not in sql_trimmed.upper():
            sql_trimmed = sql_trimmed.rstrip().rstrip(';') + ' ON CONFLICT DO NOTHING'

    # 4. Strip COLLATE NOCASE
    sql_trimmed = re.sub(r'\s+COLLATE\s+NOCASE', '', sql_trimmed, flags=re.IGNORECASE)

    # 5. Translate GROUP_CONCAT(expr, delim) -> STRING_AGG((expr)::text, delim)
    sql_trimmed = re.sub(
        r'GROUP_CONCAT\s*\(\s*(.*?)\s*,\s*(\'[^\']*\')\s*\)',
        r'STRING_AGG((\1)::text, \2)',
        sql_trimmed,
        flags=re.IGNORECASE
    )
    sql_trimmed = re.sub(
        r'GROUP_CONCAT\s*\(\s*(.*?)\s*\)',
        r"STRING_AGG((\1)::text, ',')",
        sql_trimmed,
        flags=re.IGNORECASE
    )

    # 6. Translate BLOB type keyword to BYTEA for PostgreSQL
    sql_trimmed = re.sub(r'\bBLOB\b', 'BYTEA', sql_trimmed, flags=re.IGNORECASE)

    # 7. Translate ? to %s
    return translate_placeholders(sql_trimmed)


# =====================================================================
# PostgreSQL Cursor & Connection Wrappers
# =====================================================================

class PostgresCursorWrapper:
    """
    Wraps a psycopg2 cursor to provide the exact interface expected by Gatherly:
    - Automatically formats queries for PostgreSQL
    - Auto-populates cursor.lastrowid on INSERT using RETURNING id
    - Converts results into sqlite3.Row-compatible Row objects
    - Maps psycopg2 errors to sqlite3.IntegrityError / sqlite3.Error
    """

    def __init__(self, raw_cursor):
        self._cursor = raw_cursor
        self.lastrowid: Optional[int] = None

    def execute(self, sql: str, params=None):
        clean_upper = re.sub(r'\s+', ' ', sql.strip().rstrip(';')).upper()
        if clean_upper in ("BEGIN", "BEGIN IMMEDIATE", "BEGIN EXCLUSIVE", "BEGIN DEFERRED", "BEGIN TRANSACTION"):
            # PostgreSQL transactions are managed by psycopg2 and connection context manager.
            # No-op to avoid syntax errors and save a network roundtrip.
            return self
        if clean_upper == "COMMIT":
            if self._cursor and self._cursor.connection:
                self._cursor.connection.commit()
            return self
        if clean_upper == "ROLLBACK":
            if self._cursor and self._cursor.connection:
                self._cursor.connection.rollback()
            return self

        pg_sql = format_sql_for_pg(sql)
        self.lastrowid = None

        # Check if this is an INSERT statement that should return lastrowid
        is_insert = False
        table_has_id = False
        upper_sql = pg_sql.strip().upper()
        if upper_sql.startswith("INSERT INTO "):
            is_insert = True
            # Extract table name
            m = re.match(r'^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)', pg_sql, re.IGNORECASE)
            table_name = m.group(1).lower() if m else ""
            if table_name not in TABLES_WITHOUT_ID and "RETURNING" not in upper_sql:
                table_has_id = True
                pg_sql = pg_sql.rstrip().rstrip(';') + " RETURNING id"

        try:
            if params is None:
                self._cursor.execute(pg_sql)
            else:
                # Convert params to list/tuple if needed
                if isinstance(params, (list, tuple)):
                    clean_params = []
                    for p in params:
                        # Convert datetime if needed, or pass through
                        clean_params.append(p)
                    self._cursor.execute(pg_sql, clean_params)
                else:
                    self._cursor.execute(pg_sql, params)

            # If we appended RETURNING id, fetch the generated id
            if is_insert and table_has_id:
                try:
                    row = self._cursor.fetchone()
                    if row is not None:
                        self.lastrowid = row[0]
                except Exception:
                    self.lastrowid = None

            return self

        except psycopg2.IntegrityError as e:
            raise sqlite3.IntegrityError(str(e)) from e
        except psycopg2.Error as e:
            raise sqlite3.Error(str(e)) from e

    def executemany(self, sql: str, seq_of_params):
        pg_sql = format_sql_for_pg(sql)
        try:
            self._cursor.executemany(pg_sql, seq_of_params)
            return self
        except psycopg2.IntegrityError as e:
            raise sqlite3.IntegrityError(str(e)) from e
        except psycopg2.Error as e:
            raise sqlite3.Error(str(e)) from e

    def fetchone(self) -> Optional[Row]:
        try:
            raw = self._cursor.fetchone()
            if raw is None:
                return None
            return Row(self._cursor.description, raw)
        except psycopg2.Error as e:
            raise sqlite3.Error(str(e)) from e

    def fetchall(self) -> List[Row]:
        try:
            raw_rows = self._cursor.fetchall()
            desc = self._cursor.description
            return [Row(desc, r) for r in raw_rows]
        except psycopg2.Error as e:
            raise sqlite3.Error(str(e)) from e

    def fetchmany(self, size: Optional[int] = None) -> List[Row]:
        try:
            raw_rows = self._cursor.fetchmany(size) if size is not None else self._cursor.fetchmany()
            desc = self._cursor.description
            return [Row(desc, r) for r in raw_rows]
        except psycopg2.Error as e:
            raise sqlite3.Error(str(e)) from e

    @property
    def description(self):
        return self._cursor.description

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def close(self):
        try:
            self._cursor.close()
        except Exception:
            pass

    def __iter__(self):
        for raw in self._cursor:
            yield Row(self._cursor.description, raw)


class PostgresConnectionWrapper:
    """
    Wraps a pooled psycopg2 connection to mimic sqlite3.Connection.
    Provides execute(), executescript(), cursor(), commit(), rollback(), and context manager.
    """

    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self) -> PostgresCursorWrapper:
        return PostgresCursorWrapper(self._conn.cursor())

    def execute(self, sql: str, params=None) -> PostgresCursorWrapper:
        cursor = self.cursor()
        cursor.execute(sql, params)
        return cursor

    def executescript(self, script: str):
        """Execute a multi-statement SQL script."""
        with self._conn.cursor() as cur:
            try:
                cur.execute(script)
            except psycopg2.IntegrityError as e:
                raise sqlite3.IntegrityError(str(e)) from e
            except psycopg2.Error as e:
                raise sqlite3.Error(str(e)) from e

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        pass  # Real closure handled by connection pool return

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.rollback()
        else:
            self.commit()


# =====================================================================
# Connection Pool Management
# =====================================================================

def get_pg_pool() -> ThreadedConnectionPool:
    global _pg_pool
    if _pg_pool is None:
        with _pg_pool_lock:
            if _pg_pool is None:
                normalized_url = get_effective_database_url()
                if not normalized_url:
                    raise RuntimeError("No Supabase PostgreSQL URL configured. Set DATABASE_URL or SUPABASE_URL + SUPABASE_DB_PASSWORD in .env.")
                if not PSYCOPG2_AVAILABLE:
                    raise RuntimeError("psycopg2 is not installed. Please install psycopg2-binary.")
                logger.info("Initializing PostgreSQL connection pool (%d-%d connections)...", DB_POOL_MIN, DB_POOL_MAX)
                _pg_pool = ThreadedConnectionPool(
                    minconn=DB_POOL_MIN,
                    maxconn=DB_POOL_MAX,
                    dsn=normalized_url
                )
    return _pg_pool


def get_postgres_connection():
    """Borrow a validated connection from the pool."""
    pool = get_pg_pool()
    conn = pool.getconn()
    # Health check: verify connection is alive
    try:
        if conn.closed != 0:
            pool.putconn(conn, close=True)
            conn = pool.getconn()
        else:
            # Quick poll
            conn.poll()
    except Exception:
        try:
            pool.putconn(conn, close=True)
        except Exception:
            pass
        conn = pool.getconn()
    return conn


def release_postgres_connection(raw_conn, error: bool = False):
    """Return connection back to the pool, ensuring clean transaction state."""
    pool = get_pg_pool()
    try:
        if raw_conn is not None and not error:
            try:
                # Ensure connection is in a clean state (STATUS_READY = 0)
                if hasattr(raw_conn, 'status') and raw_conn.status != 0:
                    raw_conn.rollback()
            except Exception:
                error = True
        pool.putconn(raw_conn, close=error)
    except Exception as e:
        logger.warning("Error returning connection to pool: %s", e)


# =====================================================================
# Main Context Manager: get_db()
# =====================================================================

@contextmanager
def get_db():
    """
    Context manager yielding a database connection.
    Connects to Supabase PostgreSQL when DATABASE_URL is set;
    otherwise connects to local SQLite gatherly.db.
    """
    if is_postgres():
        raw_conn = None
        try:
            raw_conn = get_postgres_connection()
            wrapper = PostgresConnectionWrapper(raw_conn)
            error = False
            try:
                with wrapper:
                    yield wrapper
            except Exception:
                error = True
                raise
            finally:
                if raw_conn is not None:
                    release_postgres_connection(raw_conn, error=error)
        except Exception as e:
            if raw_conn is None:
                logger.error("PostgreSQL connection error: %s. Gracefully falling back to local SQLite.", e)
                conn = sqlite3.connect(DB_NAME)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA foreign_keys = ON")
                try:
                    with conn:
                        yield conn
                finally:
                    conn.close()
            else:
                raise
    else:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            with conn:
                yield conn
        finally:
            conn.close()


# =====================================================================
# Helper: generate_event_public_id
# =====================================================================

def generate_event_public_id(conn) -> str:
    """Generate a unique 12-character URL-safe public id for an event."""
    while True:
        candidate = f"evt_{secrets.token_urlsafe(9).replace('-', '').replace('_', '')[:12]}"
        row = conn.execute("SELECT id FROM events WHERE public_id = ?", (candidate,)).fetchone()
        if not row:
            return candidate


# =====================================================================
# Database Initialization & Migrations: init_db()
# =====================================================================

def init_db(root_path: Optional[str] = None):
    """
    Initialize database tables and run baseline schema migrations.
    Uses schema_postgres.sql for Supabase PostgreSQL, or schema.sql for SQLite.
    """
    global _db_initialized
    if root_path is None:
        root_path = os.path.dirname(os.path.abspath(__file__))

    from werkzeug.security import generate_password_hash

    backend = get_db_backend()
    logger.info("Initializing Gatherly database (Backend: %s)...", backend.upper())

    with get_db() as conn:
        is_pg = isinstance(conn, PostgresConnectionWrapper)
        if is_pg:
            # Run PostgreSQL schema
            schema_file = os.path.join(root_path, "schema_postgres.sql")
            if not os.path.exists(schema_file):
                schema_file = os.path.join(root_path, "schema.sql")
            with open(schema_file, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
        else:
            # Run SQLite schema
            schema_file = os.path.join(root_path, "schema.sql")
            with open(schema_file, "r", encoding="utf-8") as f:
                conn.executescript(f.read())

        # Migration checks: verify required columns exist
        user_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
        if "is_verified" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 1")
        if "account_type" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'USER'")
        if "organization_name" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN organization_name TEXT")
        if "verified_at" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN verified_at TIMESTAMP")
        if "verified_by" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN verified_by INTEGER")

        otp_columns = {row["name"] for row in conn.execute("PRAGMA table_info(otps)")}
        if "attempt_count" not in otp_columns:
            conn.execute("ALTER TABLE otps ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0")

        event_columns = {row["name"] for row in conn.execute("PRAGMA table_info(events)")}
        if "ticket_limit" not in event_columns:
            conn.execute("ALTER TABLE events ADD COLUMN ticket_limit INTEGER")
        if "city" not in event_columns:
            conn.execute("ALTER TABLE events ADD COLUMN city TEXT NOT NULL DEFAULT ''")
        if "publish_at" not in event_columns:
            conn.execute("ALTER TABLE events ADD COLUMN publish_at TEXT")
        if "ticket_sales_start_at" not in event_columns:
            conn.execute("ALTER TABLE events ADD COLUMN ticket_sales_start_at TEXT")
        if "cancelled_at" not in event_columns:
            conn.execute("ALTER TABLE events ADD COLUMN cancelled_at TEXT")
        if "public_id" not in event_columns:
            conn.execute("ALTER TABLE events ADD COLUMN public_id TEXT")

        # Fill missing event public IDs
        for event in conn.execute("SELECT id FROM events WHERE public_id IS NULL OR public_id = ''").fetchall():
            conn.execute(
                "UPDATE events SET public_id = ? WHERE id = ?",
                (generate_event_public_id(conn), event["id"])
            )
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_events_public_id ON events(public_id)")

        booking_columns = {row["name"] for row in conn.execute("PRAGMA table_info(bookings)")}
        if "admitted_count" not in booking_columns:
            conn.execute("ALTER TABLE bookings ADD COLUMN admitted_count INTEGER NOT NULL DEFAULT 0")
        if "tier_id" not in booking_columns:
            conn.execute("ALTER TABLE bookings ADD COLUMN tier_id INTEGER")
        if "hold_expires_at" not in booking_columns:
            conn.execute("ALTER TABLE bookings ADD COLUMN hold_expires_at TEXT")

        ticket_columns = {row["name"] for row in conn.execute("PRAGMA table_info(tickets)")}
        if "booking_id" not in ticket_columns:
            conn.execute("ALTER TABLE tickets ADD COLUMN booking_id INTEGER")
        if "qr_image" not in ticket_columns:
            col_type = "BYTEA" if backend == "postgres" else "BLOB"
            conn.execute(f"ALTER TABLE tickets ADD COLUMN qr_image {col_type}")

        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_one_per_booking ON tickets(booking_id)")

        cinema_reservation_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(cinema_reservations)")
        }
        if "ticket_code" not in cinema_reservation_columns:
            conn.execute("ALTER TABLE cinema_reservations ADD COLUMN ticket_code TEXT")
        if "qr_image" not in cinema_reservation_columns:
            col_type = "BYTEA" if backend == "postgres" else "BLOB"
            conn.execute(f"ALTER TABLE cinema_reservations ADD COLUMN qr_image {col_type}")
        if "hold_expires_at" not in cinema_reservation_columns:
            conn.execute("ALTER TABLE cinema_reservations ADD COLUMN hold_expires_at TEXT")
        if "admitted_count" not in cinema_reservation_columns:
            conn.execute("ALTER TABLE cinema_reservations ADD COLUMN admitted_count INTEGER NOT NULL DEFAULT 0")

        # Bootstrap super admin if configured and absent
        bootstrap_password = os.getenv("SUPER_ADMIN_PASSWORD", "")
        if len(bootstrap_password) >= 12:
            admin_email = "admin@gatherly.in"
            admin = conn.execute("SELECT id FROM users WHERE email = ?", (admin_email,)).fetchone()
            if not admin:
                conn.execute(
                    """INSERT INTO users
                       (full_name, email, password_hash, is_verified, account_type, verified_at)
                       VALUES (?, ?, ?, 1, 'ADMIN', ?)""",
                    (
                        "Gatherly Super Admin",
                        admin_email,
                        generate_password_hash(bootstrap_password),
                        datetime.now().isoformat(timespec="seconds")
                    )
                )
                logger.info("Bootstrap Super Admin account created (%s).", admin_email)

    _db_initialized = True
    logger.info("Gatherly database initialization complete.")


# =====================================================================
# Supabase Storage Integration (Upload & Download)
# =====================================================================

def upload_to_supabase_storage(
    relative_path: str,
    file_path_or_bytes: Any,
    content_type: Optional[str] = None,
    bucket_name: str = "gatherly-media"
) -> bool:
    """
    Upload an image or video to Supabase Storage bucket.
    Accepts a local file path or raw bytes.
    """
    client = get_supabase_client()
    if not client:
        return False

    import mimetypes
    clean_path = relative_path.replace("\\", "/").lstrip("/")

    if not content_type:
        content_type, _ = mimetypes.guess_type(clean_path)
    content_type = content_type or "application/octet-stream"

    try:
        if isinstance(file_path_or_bytes, (bytes, bytearray)):
            file_data = file_path_or_bytes
        else:
            if not os.path.exists(file_path_or_bytes):
                return False
            with open(file_path_or_bytes, "rb") as f:
                file_data = f.read()

        client.storage.from_(bucket_name).upload(
            path=clean_path,
            file=file_data,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        logger.info("Uploaded %s to Supabase Storage bucket '%s'.", clean_path, bucket_name)
        return True
    except Exception as e:
        logger.warning("Failed to upload %s to Supabase Storage: %s", clean_path, e)
        return False


def fetch_from_supabase_storage(
    relative_path: str,
    bucket_name: str = "gatherly-media"
) -> Optional[bytes]:
    """
    Download a file from Supabase Storage bucket.
    Returns bytes if found, else None.
    """
    client = get_supabase_client()
    if not client:
        return None

    clean_path = relative_path.replace("\\", "/").lstrip("/")
    try:
        data = client.storage.from_(bucket_name).download(clean_path)
        return data
    except Exception as e:
        logger.debug("File %s not found in Supabase Storage bucket '%s': %s", clean_path, bucket_name, e)
        return None

