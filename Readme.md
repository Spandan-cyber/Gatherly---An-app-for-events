# Gatherly 🎟️

### Event Management and Cinema Booking Platform

Gatherly is a web-based platform designed to simplify event discovery, event management, ticket booking, and cinema reservations. It provides functionality for attendees, event organizers, theatre operators, and administrators through a unified application.

Built with Python and Flask, Gatherly aims to provide a convenient platform for managing events, handling reservations, and improving the overall booking experience.

---

## 🚀 Features

### 👤 User Authentication
- User registration and login.
- Email OTP verification.
- Password reset functionality.
- Account management.
- Role-based access for different types of users.

### 🎉 Event Management
- Event discovery and details.
- Event creation and management.
- Public and private events.
- Event invitations.
- Ticket categories and pricing.
- Event capacity management.
- Event images and media support.
- Organizer and sponsor information.

### 🎫 Ticket Booking
- Event ticket reservations.
- QR-code ticket generation.
- Waitlist functionality.
- Booking management.
- Ticket validation and scanning workflows.

### 🎬 Cinema Booking
- Movie and showtime listings.
- Cinema reservation workflows.
- Theatre management.
- Reservation-related QR codes.

### 🏢 Organizer and Theatre Management
- Organizer accounts.
- Theatre accounts.
- Account verification workflows.
- Event and cinema management features.

### 🛡️ Administration
- Administrative account management.
- Organizer and theatre verification.
- Administrative management workflows.

### 📧 Email Notifications
- Email verification codes.
- Password reset emails.
- Event-related notifications.
- Invitation and ticket-related emails.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend programming language |
| Flask | Web application framework |
| HTML | Page structure |
| CSS | Styling and layout |
| JavaScript | Frontend interactivity |
| SQLite / PostgreSQL | Database options, depending on configuration |
| Supabase | Database and storage integration |
| QR Code | Digital ticket generation |
| Gmail SMTP | Email delivery |

The technologies listed above reflect the project's apparent architecture. Exact database and integration requirements depend on the application configuration.

---

## 📁 Project Structure

The repository contains the main application and its supporting frontend and configuration files.

```text
Gatherly/
│
├── main.py
├── schema.sql
├── schema_postgres.sql
├── requirements.txt
├── README.md
├── .gitignore
├── .env.example
│
├── static/
│   ├── css/
│   ├── js/
│   └── images/
│
└── templates/
    ├── base.html
    └── application pages
```

The exact contents of `static/` and `templates/` may differ from this illustrative structure.

For repository organization, local databases, uploaded media, private scripts, and sensitive environment configuration are excluded from Git.

---

## ⚙️ Installation and Setup

### Prerequisites

Install the following before running the application:

- Python 3.10 or a compatible version.
- pip.
- Git.
- Access to the database configured for your application.

Additional services, such as Supabase and Gmail SMTP, may require their own credentials.

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
```

Navigate into the project directory:

```bash
cd YOUR-REPOSITORY
```

Replace the example repository URL and directory name with your actual GitHub details.

### 2. Create a Virtual Environment

On Windows:

```powershell
py -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a local `.env` file using `.env.example` as a reference.

On Windows:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Configure the required environment variables for your local environment.

Never commit actual passwords, API keys, database credentials, or other secrets.

### 5. Configure the Database

Configure the database connection required by your application.

The repository may contain SQL schema files for different database backends. Select the schema that matches your actual database configuration.

**Note:** The private `database.py` file is excluded from this repository. If `main.py` imports `database.py`, the application will not run from a fresh clone unless that dependency is provided separately.

### 6. Run the Application

If `main.py` contains the application's startup entry point, run:

```bash
python main.py
```

Otherwise, if the Flask application object is named `app`, you may be able to run:

```bash
flask --app main run --debug
```

Open the local address shown in the terminal.

Use Flask debug mode only for local development, never for public production deployment.

---

## 🔐 Security

Security is important for applications that handle user accounts, reservations, and tickets.

Recommended precautions:

- Keep `.env` out of Git.
- Never publish API keys or database passwords.
- Use strong, persistent secret keys.
- Validate user input.
- Protect authenticated routes with appropriate authorization checks.
- Validate uploaded files.
- Use HTTPS in production.
- Protect administrative functionality.
- Keep dependencies updated.
- Back up databases before migrations.
- Avoid publishing private user data or uploaded media.

---

## 🧪 Testing

Gatherly includes a comprehensive automated test suite covering unit tests, integration tests, accessibility audits, and security boundaries.

### Running the Test Suite:

```bash
python run_tests.py
```

Or using `pytest`:

```bash
pytest
```

The test suite covers:
- **Accessibility & WCAG Compliance** (`tests/test_accessibility.py`): Landmark roles, skip-link, `<label for>` associations, `:focus-visible`, and ARIA modals.
- **AI Assistant & Event Drafts** (`tests/test_ai_assistant.py`): Autonomous date/time scheduling, format normalization, and payload handling.
- **Authentication & Sessions** (`tests/test_auth.py`): Validation, password complexity, login verification, and session management.
- **Events & Ticketing** (`tests/test_events.py`, `tests/test_booking.py`): Public event listings, filtering, booking workflows, and authorization checks.
- **Cinema Booking** (`tests/test_cinema.py`): Showtimes, seat reservations, and manager access.
- **Security & RBAC** (`tests/test_security.py`): HTTP security headers (`nosniff`, `DENY`), OTP verification, super-admin guards, and gate scanner security.
- **Database Compatibility Layer** (`tests/test_database.py`): Dual SQLite & PostgreSQL/Supabase dialect query translation and row mapping.
- **Helper Utilities** (`tests/test_helpers.py`): IST timezone conversion, datetime parsing, OTP generator, and QR image generation.

---

## 🗺️ Future Improvements

Potential improvements include:
- Enhanced booking and payment workflows.
- Improved event discovery and filtering.
- Better organizer analytics.
- Expanded notification options.
- Improved mobile responsiveness.
- Production deployment automation.
- Enhanced monitoring and error reporting.

These are potential development goals rather than claims that the features have already been implemented.

---

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Test your changes locally.
5. Commit your work.
6. Open a pull request describing the changes.

Please do not include credentials, private databases, or user-uploaded files in contributions.

---

## 📄 License

No license has been specified yet.

Add an appropriate license before permitting others to reuse, modify, or distribute this project.

---

## 👨‍💻 Project

**Gatherly — Event Management and Cinema Booking Platform**

Developed using Python, Flask, and supporting web technologies.