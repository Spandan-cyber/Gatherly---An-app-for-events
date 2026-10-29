CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS organization_verification_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS movie_favourites (
    user_id INTEGER NOT NULL,
    film_title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, film_title),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movie_waitlist (
    user_id INTEGER NOT NULL,
    film_title TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, film_title, city),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movie_ratings (
    user_id INTEGER NOT NULL,
    film_title TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    review TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, film_title),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    purpose TEXT DEFAULT 'reset_password',
    expires_at TIMESTAMP NOT NULL,
    is_used INTEGER DEFAULT 0,
    attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    media_path TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video')),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    partner_type TEXT NOT NULL DEFAULT 'SPONSOR' CHECK(partner_type IN ('SPONSOR', 'EVENT PARTNER')),
    logo_path TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS ticket_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    ticket_code TEXT UNIQUE NOT NULL,
    qr_image BLOB,
    payment_status TEXT CHECK(payment_status IN ('COMPLETED', 'PENDING')) DEFAULT 'COMPLETED',
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(booking_id) REFERENCES bookings(id),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS event_wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    user_id INTEGER,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'ACTIVE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, email),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS gate_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    event_title TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'UPDATE' CHECK(kind IN ('UPDATE', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_announcement_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    announcement_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(announcement_id) REFERENCES event_announcements(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS cinema_showtimes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS cinema_seat_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    showtime_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6ee7b7',
    price REAL NOT NULL CHECK(price >= 0),
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id) ON DELETE CASCADE,
    UNIQUE(showtime_id, code)
);

CREATE TABLE IF NOT EXISTS cinema_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    showtime_id INTEGER NOT NULL,
    tier_id INTEGER NOT NULL,
    row_label TEXT NOT NULL,
    seat_number INTEGER NOT NULL CHECK(seat_number > 0),
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id) ON DELETE CASCADE,
    FOREIGN KEY(tier_id) REFERENCES cinema_seat_tiers(id),
    UNIQUE(showtime_id, row_label, seat_number)
);

CREATE TABLE IF NOT EXISTS cinema_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    showtime_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    payment_status TEXT NOT NULL CHECK(payment_status IN ('PENDING', 'COMPLETED', 'NOT_REQUIRED')),
    payment_provider TEXT NOT NULL DEFAULT 'manual',
    provider_reference TEXT,
    hold_expires_at TEXT,
    admitted_count INTEGER NOT NULL DEFAULT 0 CHECK(admitted_count >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cinema_gate_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS cinema_offline_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gate_account_id INTEGER NOT NULL,
    reservation_id INTEGER NOT NULL,
    sync_id TEXT NOT NULL,
    result TEXT NOT NULL CHECK(result IN ('ADMITTED', 'REJECTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gate_account_id, sync_id),
    FOREIGN KEY(gate_account_id) REFERENCES cinema_gate_accounts(id),
    FOREIGN KEY(reservation_id) REFERENCES cinema_reservations(id)
);

CREATE TABLE IF NOT EXISTS cinema_reservation_seats (
    reservation_id INTEGER NOT NULL,
    showtime_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    PRIMARY KEY(reservation_id, seat_id),
    FOREIGN KEY(reservation_id) REFERENCES cinema_reservations(id) ON DELETE CASCADE,
    FOREIGN KEY(showtime_id) REFERENCES cinema_showtimes(id),
    FOREIGN KEY(seat_id) REFERENCES cinema_seats(id)
);

CREATE TABLE IF NOT EXISTS event_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS event_offline_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE INDEX IF NOT EXISTS idx_cinema_showtimes_start ON cinema_showtimes(starts_at);
CREATE INDEX IF NOT EXISTS idx_cinema_showtimes_manager ON cinema_showtimes(manager_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_cinema_seats_showtime ON cinema_seats(showtime_id, row_label, seat_number);
CREATE INDEX IF NOT EXISTS idx_cinema_reservations_active ON cinema_reservations(showtime_id, status);
CREATE INDEX IF NOT EXISTS idx_cinema_reservation_seats_lookup ON cinema_reservation_seats(showtime_id, seat_id);