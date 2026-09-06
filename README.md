# EAIMS Admissions Management System

A full-stack admissions management web application built with **Django REST Framework** (backend API + server-rendered frontend) and vanilla JavaScript (client-side interactivity). It manages programmes (courses), intakes, students, and admission letters.

## Schema

- `courses` — programmes with code, name, type (Diploma/Certificate), and capacity
- `intakes` — academic terms (MARCH, AUGUST) with active/closed status
- `students` — applicant records linked to a course and intake
- `admission_letters` — generated letters with registration numbers and sequence numbers

## Project structure

```
EAIMS Admissions MGT/
├─ backend/                  # Django project
│  ├─ config/                # Django project settings
│  │  ├─ settings.py
│  │  └─ urls.py
│  ├─ admissions/            # Django app (models, API, serializers)
│  │  ├─ models.py
│  │  ├─ serializers.py
│  │  ├─ views.py
│  │  └─ urls.py
│  ├─ manage.py
│  └─ requirements.txt
├─ index.html                # Main UI — dashboard, courses, intakes, students, letters
├─ login.html                # Login page (JWT auth)
├─ styles.css
├─ app.js                    # Frontend logic — API client, rendering, form handling
└─ README.md
```

## Backend Setup

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata initial_data  # or seed_data.py for demo data
python manage.py createsuperuser         # create admin account
python manage.py runserver               # starts at http://127.0.0.1:8000
```

### API endpoints

| Method   | Endpoint                          | Description                          |
|----------|-----------------------------------|--------------------------------------|
| POST     | `/api/auth/token/`                | Obtain JWT access + refresh tokens   |
| POST     | `/api/auth/token/refresh/`        | Refresh JWT access token             |
| GET      | `/api/courses/`                   | List all courses                     |
| POST     | `/api/courses/`                   | Create a course                      |
| GET/PUT/DELETE | `/api/courses/{id}/`        | Retrieve/update/delete a course      |
| GET      | `/api/intakes/`                   | List all intakes                     |
| POST     | `/api/intakes/{id}/activate/`     | Activate an intake (deactivates others) |
| GET      | `/api/students/`                  | List all students                    |
| POST     | `/api/students/`                  | Create a student                     |
| GET      | `/api/letters/`                   | List all admission letters           |
| POST     | `/api/letters/`                   | Create an admission letter           |

### Authentication

JWT tokens are used for API authentication. The frontend stores the access token in `sessionStorage`. Login credentials are the Django superuser credentials you create with `createsuperuser`.

## Frontend

Django serves the frontend HTML files at the root URL. When you run `python manage.py runserver`, open `http://127.0.0.1:8000/login.html` and log in with your superuser credentials.

## How to use

1. Start the Django server: `python manage.py runserver`
2. Open `http://127.0.0.1:8000/login.html` and sign in.
3. Use the dashboard, programmes, intakes, students, and admission letters tabs.
4. Data is persisted in the SQLite database (`backend/db.sqlite3`).

## Demo data

A `seed_data.py` script is included in the `backend/` directory to populate the database with sample courses, intakes, and students:

```bash
cd backend
python seed_data.py
```

## Next steps

- Add CSRF protection for production deployment
- Add edit functionality for each entity
- Implement pagination for large datasets
- Add file upload for admission letters
- Deploy to a production WSGI server (gunicorn + nginx)
