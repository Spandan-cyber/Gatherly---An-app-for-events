-- =====================================================================
-- GATHERLY - PostgreSQL Schema for Supabase
-- =====================================================================

-- Compatibility Aggregate for SQLite GROUP_CONCAT(expr, delimiter)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_group_concat_state') THEN
        CREATE FUNCTION _group_concat_state(state text, val text, delim text)
        RETURNS text LANGUAGE sql IMMUTABLE AS $func$
            SELECT CASE
                WHEN state IS NULL THEN val
                WHEN val IS NULL THEN state
                ELSE state || delim || val
            END;
        $func$;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'group_concat' AND pronargs = 2) THEN
        CREATE AGGREGATE group_concat(text, text) (
            SFUNC = _group_concat_state,
            STYPE = text
        );
    END IF;
END $$;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified INTEGER NOT NULL DEFAULT 0,
    account_type TEXT NOT NULL DEFAULT 'USER' CHECK(account_type IN ('USER', 'THEATRE', 'ORGANIZER', 'ADMIN')),
    organization_name TEXT,
    verified_at TIMESTAMP,
    verified_by INTEGER,
    lat REAL,
    lng REAL,
    city TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Organization Verification Requests
CREATE TABLE IF NOT EXISTS organization_verification_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    requested_type TEXT NOT NULL CHECK(requested_type IN ('THEATRE', 'ORGANIZER')),
    organization_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id)
);

-- 3. Movie Favourites
CREATE TABLE IF NOT EXISTS movie_favourites (
    user_id INTEGER NOT NULL,
    film_title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, film_title),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Movie Waitlist
CREATE TABLE IF NOT EXISTS movie_waitlist (
    user_id INTEGER NOT NULL,
    film_title TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, film_title, city),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Movie Ratings
CREATE TABLE IF NOT EXISTS movie_ratings (
    user_id INTEGER NOT NULL,
    film_title TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    review TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, film_title),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. OTPs
CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    purpose TEXT DEFAULT 'reset_password',
    expires_at TIMESTAMP NOT NULL,
    is_used INTEGER DEFAULT 0,
    attempt_count INTEGER NOT NULL DEFAULT 0
);

-- 7. Events
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    public_id TEXT UNIQUE,
    organizer_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    visibility TEXT CHECK(visibility IN ('PUBLIC', 'PRIVATE')) DEFAULT 'PUBLIC',
    is_paid INTEGER DEFAULT 0,
    price REAL DEFAULT 0.0,
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    venue TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    lat REAL,
    lng REAL,
    description TEXT,
    main_image TEXT,
    cover_image TEXT,
    video_file TEXT,
    sponsor_name TEXT,
    sponsor_logo TEXT,
    ticket_limit INTEGER,
    publish_at TEXT,
    ticket_sales_start_at TEXT,
    cancelled_at TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organizer_id) REFERENCES users(id)
);

-- 8. Event Media
CREATE TABLE IF NOT EXISTS event_media (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    media_path TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video')),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 9. Event Partners
CREATE TABLE IF NOT EXISTS event_partners (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    partner_type TEXT NOT NULL DEFAULT 'SPONSOR' CHECK(partner_type IN ('SPONSOR', 'EVENT PARTNER')),
    logo_path TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 10. Ticket Tiers (Defined before bookings for FK reference)
CREATE TABLE IF NOT EXISTS ticket_tiers (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
    capacity INTEGER NOT NULL CHECK(capacity > 0),
    image_path TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 11. Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    payment_status TEXT NOT NULL CHECK(payment_status IN ('NOT_REQUIRED', 'PENDING', 'COMPLETED')),
    confirmation_method TEXT,
    admitted_count INTEGER NOT NULL DEFAULT 0 CHECK(admitted_count >= 0),
    tier_id INTEGER,
    hold_expires_at TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(tier_id) REFERENCES ticket_tiers(id)
);

-- 12. Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    ticket_code TEXT UNIQUE NOT NULL,
    qr_image BYTEA,
    payment_status TEXT CHECK(payment_status IN ('COMPLETED', 'PENDING')) DEFAULT 'COMPLETED',
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(booking_id) REFERENCES bookings(id),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 13. Event Wishlists
CREATE TABLE IF NOT EXISTS event_wishlists (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 14. Event Waitlist
CREATE TABLE IF NOT EXISTS event_waitlist (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    tier_id INTEGER,
    user_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    status TEXT NOT NULL CHECK(status IN ('WAITING', 'OFFERED', 'FULFILLED', 'EXPIRED', 'CANCELLED')),
    offered_until TEXT,
    booking_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(tier_id) REFERENCES ticket_tiers(id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(booking_id) REFERENCES bookings(id)
);

-- 15. Event Members
CREATE TABLE IF NOT EXISTS event_members (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    user_id INTEGER,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'ACTIVE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, email),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 16. Gate Accounts
CREATE TABLE IF NOT EXISTS gate_accounts (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- 17. Event Invitations
CREATE TABLE IF NOT EXISTS event_invitations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    user_id INTEGER,
    invitation_token TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('GUEST', 'MANAGER')),
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 18. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    invitation_id INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(invitation_id) REFERENCES event_invitations(id) ON DELETE CASCADE,
    UNIQUE(user_id, invitation_id)
);

-- 19. Event Announcements
CREATE TABLE IF NOT EXISTS event_announcements (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    event_title TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'UPDATE' CHECK(kind IN ('UPDATE', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20. Event Announcement Recipients
CREATE TABLE IF NOT EXISTS event_announcement_recipients (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(announcement_id) REFERENCES event_announcements(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(announcement_id, user_id)
);

-- 21. Cinema Showtimes
CREATE TABLE IF NOT EXISTS cinema_showtimes (
    id SERIAL PRIMARY KEY,
    manager_id INTEGER NOT NULL,
    film_title TEXT NOT NULL,
    synopsis TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT '',
    duration_minutes INTEGER NOT NULL,
    poster_path TEXT,
    theatre_name TEXT NOT NULL,
    screen_name TEXT NOT NULL,
    city TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(manager_id) REFERENCES users(id)
);

-- 22. Cinema Seat Tiers
CREATE TABLE IF NOT EXISTS cinema_seat_tiers (
    id SERIAL PRIMARY KEY,
    showtime_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6ee7b7',
    price REAL NOT NULL CHECK(price >= 0),
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id) ON DELETE CASCADE,
    UNIQUE(showtime_id, code)
);

-- 23. Cinema Seats
CREATE TABLE IF NOT EXISTS cinema_seats (
    id SERIAL PRIMARY KEY,
    showtime_id INTEGER NOT NULL,
    tier_id INTEGER NOT NULL,
    row_label TEXT NOT NULL,
    seat_number INTEGER NOT NULL CHECK(seat_number > 0),
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id) ON DELETE CASCADE,
    FOREIGN KEY(tier_id) REFERENCES cinema_seat_tiers(id),
    UNIQUE(showtime_id, row_label, seat_number)
);

-- 24. Cinema Reservations
CREATE TABLE IF NOT EXISTS cinema_reservations (
    id SERIAL PRIMARY KEY,
    showtime_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    payment_status TEXT NOT NULL CHECK(payment_status IN ('PENDING', 'COMPLETED', 'NOT_REQUIRED')),
    payment_provider TEXT NOT NULL DEFAULT 'manual',
    provider_reference TEXT,
    hold_expires_at TEXT,
    ticket_code TEXT,
    qr_image BYTEA,
    admitted_count INTEGER NOT NULL DEFAULT 0 CHECK(admitted_count >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 25. Cinema Gate Accounts
CREATE TABLE IF NOT EXISTS cinema_gate_accounts (
    id SERIAL PRIMARY KEY,
    theatre_id INTEGER NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    FOREIGN KEY(theatre_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- 26. Cinema Offline Checkins
CREATE TABLE IF NOT EXISTS cinema_offline_checkins (
    id SERIAL PRIMARY KEY,
    gate_account_id INTEGER NOT NULL,
    reservation_id INTEGER NOT NULL,
    sync_id TEXT NOT NULL,
    result TEXT NOT NULL CHECK(result IN ('ADMITTED', 'REJECTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gate_account_id, sync_id),
    FOREIGN KEY(gate_account_id) REFERENCES cinema_gate_accounts(id),
    FOREIGN KEY(reservation_id) REFERENCES cinema_reservations(id)
);

-- 27. Cinema Reservation Seats
CREATE TABLE IF NOT EXISTS cinema_reservation_seats (
    reservation_id INTEGER NOT NULL,
    showtime_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    PRIMARY KEY(reservation_id, seat_id),
    FOREIGN KEY(reservation_id) REFERENCES cinema_reservations(id) ON DELETE CASCADE,
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id),
    FOREIGN KEY(seat_id) REFERENCES cinema_seats(id)
);

-- 28. Event Tasks
CREATE TABLE IF NOT EXISTS event_tasks (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'DONE')),
    due_at TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(assigned_to) REFERENCES users(id)
);

-- 29. Event Budget Items
CREATE TABLE IF NOT EXISTS event_budget_items (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    estimated_amount REAL NOT NULL DEFAULT 0 CHECK(estimated_amount >= 0),
    actual_amount REAL NOT NULL DEFAULT 0 CHECK(actual_amount >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- 30. Event Venues
CREATE TABLE IF NOT EXISTS event_venues (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    capacity INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- 31. Event Vendors
CREATE TABLE IF NOT EXISTS event_vendors (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    contact_name TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0 CHECK(cost >= 0),
    status TEXT NOT NULL DEFAULT 'PROSPECT' CHECK(status IN ('PROSPECT', 'CONTACTED', 'CONFIRMED')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- 32. Event Offline Checkins
CREATE TABLE IF NOT EXISTS event_offline_checkins (
    id SERIAL PRIMARY KEY,
    gate_account_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    ticket_code TEXT NOT NULL,
    admitted_count INTEGER NOT NULL CHECK(admitted_count > 0),
    sync_id TEXT NOT NULL,
    result TEXT NOT NULL CHECK(result IN ('ADMITTED', 'REJECTED')),
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gate_account_id, sync_id, ticket_code),
    FOREIGN KEY(gate_account_id) REFERENCES gate_accounts(id),
    FOREIGN KEY(event_id) REFERENCES events(id)
);

-- Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_cinema_showtimes_start ON cinema_showtimes(starts_at);
CREATE INDEX IF NOT EXISTS idx_cinema_showtimes_manager ON cinema_showtimes(manager_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_cinema_seats_showtime ON cinema_seats(showtime_id, row_label, seat_number);
CREATE INDEX IF NOT EXISTS idx_cinema_reservations_active ON cinema_reservations(showtime_id, status);
CREATE INDEX IF NOT EXISTS idx_cinema_reservation_seats_lookup ON cinema_reservation_seats(showtime_id, seat_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_public_id ON events(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_one_per_booking ON tickets(booking_id);
