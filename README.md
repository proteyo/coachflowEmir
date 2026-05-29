# CoachFlow

**Mobile fitness coaching platform for personal trainers and clients**

CoachFlow is a mobile application that helps fitness trainers manage clients, assign workouts, track progress, communicate, organize weekly plans and control the coaching process in one digital workspace.

The project is built as a real mobile/full-stack product with a mobile frontend, backend API, database, authentication, role-based logic and production deployment.

The application is currently available through **Google Play Closed Testing** for selected testers.

---

## Project Status

CoachFlow is currently in closed testing.

Current validation:

* 8 trainers are testing the application
* 5 trainers are using the free testing period
* 3 trainers purchased a 3000 KZT subscription
* First paid users received unlimited client access for one month

This project is not only a prototype. It has real users, production backend deployment and early paid validation.

---

## Main Idea

Many trainers manage clients through WhatsApp, notes, Excel tables and manual reminders. This creates a fragmented workflow for both trainers and clients.

CoachFlow solves this by giving trainers and clients one structured mobile workspace:

* trainers manage clients and training plans;
* clients see workouts, progress and coach messages;
* all important training data is stored in one place.

---

## User Roles

### Coach

The coach can:

* manage clients;
* view coach dashboard;
* open client profiles;
* assign workouts;
* assign ready-made weekly workout plans;
* track attendance;
* track client streaks;
* review progress;
* communicate with clients through chat;
* manage profile, FAQ, support and settings.

### Client

The client can:

* view today’s workout;
* check assigned exercises;
* follow a training schedule;
* track weight and progress;
* see supplements and reminders;
* chat with the coach;
* open coach profile;
* manage profile and settings.

---

## Key Features

* User registration and login
* Email verification with 6-digit code
* JWT-based authentication
* Two roles: Coach and Client
* Separate mobile interfaces for each role
* Coach dashboard with statistics
* Client list and client profiles
* Workout assignment
* Ready-made weekly workout plans
* Exercise templates and workout categories
* Calendar and today’s sessions
* Chat between coach and client
* Progress tracking
* Weight tracking
* Attendance and streak tracking
* Supplements and reminders
* FAQ section
* Technical support by email
* Profile editing
* Russian, English and Kazakh localization
* Backend deployment on Render
* PostgreSQL production database
* Cloudflare/CDN infrastructure planning for media delivery, DNS and production reliability

---

## Tech Stack

### Mobile Frontend

* Expo
* React Native
* TypeScript
* Expo Router
* Context API
* AsyncStorage / API integration
* Role-based navigation

### Backend

* Python
* FastAPI
* PostgreSQL
* SQLAlchemy
* JWT authentication
* Email verification flow
* REST API
* Role-based access logic
* Server-side validation

### Infrastructure

* Render for backend deployment
* Render PostgreSQL for production database
* GitHub for version control
* Environment variables for production configuration
* SMTP email service for verification codes
* Cloudflare/CDN for future DNS, custom domain and faster media delivery

---

## Architecture

```text
Mobile App / Expo React Native
        |
        | API requests
        v
FastAPI Backend
        |
        | SQLAlchemy ORM
        v
PostgreSQL Database

Additional services:
- SMTP email service for verification codes
- Render for backend hosting
- GitHub for version control
- Cloudflare/CDN for future media and DNS infrastructure
```

---

## Main Backend Modules

The backend includes logic for:

* authentication;
* users;
* coach profiles;
* client profiles;
* workout assignments;
* exercises;
* weekly plans;
* supplements;
* progress entries;
* attendance;
* messages;
* subscriptions;
* notifications;
* email verification.

---

## Main Mobile Screens

Coach side:

* Coach dashboard
* Clients list
* Client profile
* Assign workout
* Assign weekly plan
* Calendar
* Chat
* Profile and settings

Client side:

* Today screen
* Schedule
* Progress
* Coach chat
* Profile
* Supplements
* FAQ and support

---

## What Was Improved During Testing

During closed testing, several improvements were made:

* fixed weekly plan assignment server error;
* fixed duplicate exercise ID issue;
* added email verification during registration;
* improved coach profile;
* improved client profile;
* added FAQ and technical support;
* improved bottom navigation clickability;
* improved localization in Russian, English and Kazakh;
* translated raw labels such as `lose_weight` and `intermediate`;
* added more professional workout templates;
* improved plan assignment flow.

---

## Business Model

Current early-stage model:

* free testing period for new trainers;
* basic subscription from 3000 KZT per month;
* early paid users received unlimited client access for one month.

Future subscription plans may include:

* Free Trial
* Basic
* Pro
* Unlimited

Possible paid features:

* more client slots;
* advanced analytics;
* AI workout recommendations;
* premium workout plans;
* priority support;
* media exercise library.

---

## Roadmap

### Short-term

* polish coach and client UI;
* add more professional workout categories;
* improve weekly plan editing;
* add more exercise GIF/video demonstrations;
* improve push notifications;
* continue testing with more trainers.

### Medium-term

* add real payment flow;
* add backend subscription validation;
* add subscription limits by plan;
* improve trainer analytics;
* add admin monitoring;
* improve AI workout recommendations.

### Long-term

* public release;
* connect more trainers in Kazakhstan;
* partner with gyms and fitness studios;
* add web dashboard for trainers;
* scale CoachFlow to Kazakhstan and CIS market.

---

## Environment Variables

The project uses environment variables for secure configuration.

Example backend variables:

```env
DATABASE_URL=your_postgresql_database_url
JWT_SECRET=your_jwt_secret
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASSWORD=your_email_password
FRONTEND_URL=your_frontend_url
```

Example Expo variables:

```env
EXPO_PUBLIC_API_URL=your_backend_api_url
```

Do not commit real `.env` files to GitHub. Use `.env.example` files instead.

---

## How to Run Locally

### Backend

Go to the backend folder:

```bash
cd backend
```

Create and activate virtual environment:

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run FastAPI server:

```bash
uvicorn app.main:app --reload
```

or, depending on the project entry point:

```bash
uvicorn main:app --reload
```

Backend API will run locally at:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

---

### Expo Mobile App

Go to the Expo folder:

```bash
cd expo
```

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start --clear
```

---

## Project Highlights

* Real mobile application
* Real backend API
* Production PostgreSQL database
* Render deployment
* Google Play Closed Testing
* Email verification system
* Role-based coach/client logic
* Workout planning and progress tracking
* First real users and early paid validation

---

## Author

**Emir Kamilov**
Backend Developer Intern
Almaty / Shymkent, Kazakhstan

GitHub: https://github.com/proteyo
