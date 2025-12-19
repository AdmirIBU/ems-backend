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
- POST `/api/exams` - create exam (requires Authorization: Bearer <token>)

Use `npm run dev` for development and `npm run build && npm start` for production.
