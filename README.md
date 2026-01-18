# EMS Backend

Node.js + Express backend for the Exam Management System (EMS).

## Features
- Express server
- MongoDB using Mongoose
- Authentication (login) with JWT
- Example `Exam` resource with CRUD
- Dockerfile and docker-compose for local development

## Quick start
1. Copy `.env.example` to `.env` and set `JWT_SECRET` and `MONGO_URI` if needed.
2. Install deps: `npm install`
3. Start in dev: `npm run dev`
4. Or with Docker: `docker-compose up --build`

## Create a super admin
This project uses the `admin` role as the highest-privileged role. You can create (or promote) an admin user via:

- Build first (required so `dist/` exists): `npm run build`
- Then run: `npm run create-super-admin -- --email you@example.com --password "a-strong-password" --name "Super Admin"`

You can also provide values via environment variables:
- `SUPER_ADMIN_EMAIL` (or `ADMIN_EMAIL`)
- `SUPER_ADMIN_PASSWORD` (or `ADMIN_PASSWORD`) (required if the user does not exist)
- `SUPER_ADMIN_NAME` (or `ADMIN_NAME`)

The script is idempotent:
- If the user does not exist, it creates an `admin` user.
- If the user exists, it promotes them to `admin` (and updates password only if provided).

## API
- POST `/api/auth/login` - login
- User creation is handled by admins via `POST /api/admin/users` (requires `admin` role).
- GET `/api/exams` - list exams
- POST `/api/exams` - create exam (requires Authorization: Bearer <token>) (required fields: `title`, `date`, `examType`, `numQuestions`)

### Courses & Users
- GET `/api/courses` - list all courses
- POST `/api/courses` - create course (requires Authorization). Accepts multipart/form-data with fields:
  - `title` (required)
  - `courseCode` (required)
  - `ects` (required, integer)
  - `description` (optional)
  - `syllabus` (optional file upload)
  The uploaded syllabus will be served from `/uploads/syllabi/<filename>`.
- GET `/api/courses/:id/questions` - list questions for a course
- POST `/api/courses/:id/questions` - add question to a course (requires Authorization). Body:
  - `type` (one of `essay`, `multiple-choice`, `tf`)
  - `content` (required)
  - `options` (array of strings; required for `multiple-choice` if applicable)
- POST `/api/courses/:id/enroll` - enroll current user in course (requires Authorization)
- GET `/api/courses/my` - list courses the current user is enrolled in (requires Authorization)
- GET `/api/users/me` - get current user profile (requires Authorization)

Use `npm run dev` for development and `npm run build && npm start` for production.
