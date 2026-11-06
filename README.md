# RAHMA — Final Year Project

A simple authentication and user-management module built with **React + Tailwind CSS**, **Python FastAPI**, and **MongoDB**.

## What is included

- Register as **Household, Donor, Volunteer, or NGO**.
- Verify email, sign in, sign out, and recover a forgotten password.
- Update your profile and change your password.
- Administrator user management, account suspension, and role assignment.
- NGO accounts wait for administrator approval after verifying their email.

Passwords are hashed, sessions expire, and administrator actions are checked by the backend.

## Run the project

Install Node.js 24+, Python 3.12+, and MongoDB Community Server. Start MongoDB locally on port `27017`.

### 1. Frontend

Open a terminal in the project folder:

```powershell
npm.cmd install
node scripts/configure-local.mjs
npm.cmd run dev
```

Open **http://localhost:5173**.

### 2. Backend

Open another terminal:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

API documentation: **http://127.0.0.1:8000/docs**.

Local development allows all origins with `ALLOWED_ORIGINS=*`. You can also use a JSON list of specific origins later.

Settings are in `backend/.env`. The setup script creates this file with a random session key if it does not already exist. The default database is **rahma** on your local MongoDB server.

## Email verification and password reset

No email service is required for local testing. Emails are saved in **`backend/dev-emails/`** as plain `.txt` files. Open the latest file in a text editor and copy its verification or reset link into your browser.

These files contain private links, so they are ignored by Git and are not served by the API. To send real email later, set `MAIL_BACKEND=smtp` and fill in the SMTP settings in `.env`.

## First administrator

With the backend environment and MongoDB ready, run this from `backend`:

```powershell
.venv\Scripts\python.exe -m app.cli admin@example.org --name "Administrator"
```

Enter a password when prompted. There is no shared/default admin password.

To approve an NGO: sign in as an administrator, open **User management**, filter by **Awaiting NGO approval**, choose **Manage access**, enter its approved organization ID, and save its status as **Active**.

## Folder structure

```text
frontend/src/     React pages, shared components and API calls
backend/app/      FastAPI routes, MongoDB access and authentication
backend/tests/    Basic authentication and permission tests
scripts/         Local environment setup
```

The original proposal, prototype, and LaTeX documents are kept for your submission.

## Optional checks

```powershell
npm.cmd run build
cd backend
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m pytest
```

Tests use temporary databases with unique names on your local MongoDB. They do not use the application's `rahma` database. Set `MONGODB_TEST_URI` only if your local test server uses a different address.
