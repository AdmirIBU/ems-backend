# EMS Backend

Node.js + Express backend for the Exam Management System (EMS).

## Features
- Express server
- MongoDB using Mongoose
- Authentication (register/login) with JWT
- Example `Exam` resource with CRUD
- Dockerfile and docker-compose for local development

## Quick start
1. Copy `.env.example` to `.env` and set `JWT_SECRET` and `MONGO_URI` if needed.
2. Install deps: `npm install`
3. Start in dev: `npm run dev`
4. Or with Docker: `docker-compose up --build`

## API
- POST `/api/auth/register` - register
- POST `/api/auth/login` - login
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
