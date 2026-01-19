import User from '../models/User';
import Course from '../models/Course';
import Question from '../models/Question';
import Exam from '../models/Exam';
import ExamAttempt from '../models/ExamAttempt';
import logger from '../utils/logger';

function envBool(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(raw).trim().toLowerCase());
}

function requireSeedValue(name: string): string {
  const v = process.env[name];
  if (typeof v === 'string' && v.trim()) return v.trim();
  throw new Error(`Missing required env var: ${name}`);
}

function getSeedValue(name: string, fallback?: string) {
  const v = process.env[name];
  if (typeof v === 'string' && v.trim()) return v.trim();
  return fallback;
}

async function upsertUser(params: { name: string; email: string; password: string; role: 'admin' | 'professor' | 'student' }) {
  const email = params.email.toLowerCase().trim();
  const existing = await User.findOne({ email }).exec();

  if (existing) {
    let changed = false;
    if (existing.name !== params.name) {
      existing.name = params.name;
      changed = true;
    }
    if (existing.role !== params.role) {
      existing.role = params.role as any;
      changed = true;
    }

    // Only update password if explicitly allowed
    if (envBool('SEED_UPDATE_PASSWORDS', false)) {
      existing.password = params.password;
      changed = true;
    }

    if (changed) await existing.save();
    return existing;
  }

  const created = new User({ name: params.name, email, password: params.password, role: params.role });
  await created.save();
  return created;
}

async function upsertCourse(params: {
  title: string;
  courseCode: string;
  ects: number;
  description?: string;
  professorId: string;
  studentId: string;
  createdById: string;
}) {
  const existing = await Course.findOne({ courseCode: params.courseCode }).exec();
  if (existing) {
    let changed = false;
    if (existing.title !== params.title) {
      existing.title = params.title;
      changed = true;
    }
    if ((existing as any).ects !== params.ects) {
      (existing as any).ects = params.ects;
      changed = true;
    }
    if (params.description != null && existing.description !== params.description) {
      existing.description = params.description;
      changed = true;
    }

    const profs = Array.isArray((existing as any).professors) ? (existing as any).professors.map(String) : [];
    if (!profs.includes(String(params.professorId))) {
      (existing as any).professors = [...profs, String(params.professorId)] as any;
      changed = true;
    }

    const students = Array.isArray((existing as any).students) ? (existing as any).students.map(String) : [];
    if (!students.includes(String(params.studentId))) {
      (existing as any).students = [...students, String(params.studentId)] as any;
      changed = true;
    }

    if (!(existing as any).createdBy && params.createdById) {
      (existing as any).createdBy = params.createdById as any;
      changed = true;
    }

    if (changed) await existing.save();
    return existing;
  }

  const created = new Course({
    title: params.title,
    courseCode: params.courseCode,
    ects: params.ects,
    description: params.description,
    createdBy: params.createdById as any,
    professors: [params.professorId] as any,
    students: [params.studentId] as any,
  });

  await created.save();
  return created;
}

async function upsertQuestion(params: {
  courseId: string;
  type: 'essay' | 'multiple-choice' | 'tf' | 'image-upload';
  content: string;
  options?: string[];
  points: number;
  correctAnswer?: any;
  createdById?: string;
}) {
  const existing = await Question.findOne({ course: params.courseId, content: params.content, type: params.type }).exec();
  if (existing) {
    let changed = false;
    if ((existing as any).points !== params.points) {
      (existing as any).points = params.points;
      changed = true;
    }
    if (Array.isArray(params.options)) {
      (existing as any).options = params.options;
      changed = true;
    }
    if (params.correctAnswer !== undefined) {
      (existing as any).correctAnswer = params.correctAnswer;
      changed = true;
    }
    if (params.createdById && !(existing as any).createdBy) {
      (existing as any).createdBy = params.createdById as any;
      changed = true;
    }
    if (changed) await existing.save();
    return existing;
  }

  const created = new Question({
    course: params.courseId as any,
    type: params.type,
    content: params.content,
    options: params.options,
    points: params.points,
    correctAnswer: params.correctAnswer,
    createdBy: params.createdById as any,
  });
  await created.save();
  return created;
}

async function upsertExam(params: {
  title: string;
  description?: string;
  courseId?: string;
  createdById: string;
  date: Date;
  durationMinutes: number;
  examType: string;
  questionIds: string[];
  published: boolean;
}) {
  const query: any = { title: params.title };
  if (params.courseId) query.course = params.courseId;
  const existing = await Exam.findOne(query).exec();

  const payload: any = {
    title: params.title,
    description: params.description,
    date: params.date,
    durationMinutes: params.durationMinutes,
    examType: params.examType,
    numQuestions: params.questionIds.length,
    course: params.courseId,
    questionSelectionMode: 'manual',
    questionIds: params.questionIds as any,
    createdBy: params.createdById as any,
    published: params.published,
    publishedAt: params.published ? new Date() : undefined,
  };

  if (existing) {
    // Update a few key fields to keep demo consistent.
    existing.set(payload);
    await existing.save();
    return existing;
  }

  const created = new Exam(payload);
  await created.save();
  return created;
}

async function upsertSubmittedAttempt(params: {
  examId: string;
  studentId: string;
  questionIds: string[];
  answers: Array<{ question: string; answer: any; isCorrect?: boolean; pointsAwarded?: number; maxPoints?: number }>;
  needsReview: boolean;
  pointsAwarded: number;
  pointsTotal: number;
  reviewRequested?: boolean;
  reviewRequestMessage?: string;
}) {
  const existing = await ExamAttempt.findOne({ exam: params.examId, student: params.studentId }).exec();
  const now = new Date();

  const payload: any = {
    exam: params.examId as any,
    student: params.studentId as any,
    startedAt: new Date(now.getTime() - 15 * 60_000),
    submittedAt: new Date(now.getTime() - 10 * 60_000),
    questionIds: params.questionIds as any,
    answers: params.answers as any,
    needsReview: params.needsReview,
    pointsAwarded: params.pointsAwarded,
    pointsTotal: params.pointsTotal,
  };

  if (params.reviewRequested) {
    payload.reviewRequested = true;
    payload.reviewRequestedAt = new Date(now.getTime() - 9 * 60_000);
    payload.reviewRequestMessage = params.reviewRequestMessage ?? 'Please review my essay question.';
  }

  if (existing) {
    // Keep the seed idempotent: don't overwrite real data unless forced.
    if (!envBool('SEED_FORCE', false)) return existing;
    existing.set(payload);
    await existing.save();
    return existing;
  }

  const created = new ExamAttempt(payload);
  await created.save();
  return created;
}

export async function maybeSeedDemoData() {
  if (!envBool('SEED_ON_STARTUP', false)) return;

  const allowDefaults = envBool('SEED_USE_DEFAULTS', false);

  const adminEmail = getSeedValue('SEED_ADMIN_EMAIL', allowDefaults ? 'admin@demo.local' : undefined);
  const adminPassword = getSeedValue('SEED_ADMIN_PASSWORD', allowDefaults ? 'Admin123!Demo' : undefined);
  const adminName = getSeedValue('SEED_ADMIN_NAME', allowDefaults ? 'Demo Admin' : undefined);

  const profEmail = getSeedValue('SEED_PROF_EMAIL', allowDefaults ? 'prof@demo.local' : undefined);
  const profPassword = getSeedValue('SEED_PROF_PASSWORD', allowDefaults ? 'Prof123!Demo' : undefined);
  const profName = getSeedValue('SEED_PROF_NAME', allowDefaults ? 'Demo Professor' : undefined);

  const studentEmail = getSeedValue('SEED_STUDENT_EMAIL', allowDefaults ? 'student@demo.local' : undefined);
  const studentPassword = getSeedValue('SEED_STUDENT_PASSWORD', allowDefaults ? 'Student123!Demo' : undefined);
  const studentName = getSeedValue('SEED_STUDENT_NAME', allowDefaults ? 'Demo Student' : undefined);

  if (!adminEmail || !adminPassword || !adminName) {
    requireSeedValue('SEED_ADMIN_EMAIL');
    requireSeedValue('SEED_ADMIN_PASSWORD');
    requireSeedValue('SEED_ADMIN_NAME');
  }
  if (!profEmail || !profPassword || !profName) {
    requireSeedValue('SEED_PROF_EMAIL');
    requireSeedValue('SEED_PROF_PASSWORD');
    requireSeedValue('SEED_PROF_NAME');
  }
  if (!studentEmail || !studentPassword || !studentName) {
    requireSeedValue('SEED_STUDENT_EMAIL');
    requireSeedValue('SEED_STUDENT_PASSWORD');
    requireSeedValue('SEED_STUDENT_NAME');
  }

  logger.info('SEED_ON_STARTUP enabled: ensuring demo data exists');
  if (allowDefaults) {
    logger.warn('SEED_USE_DEFAULTS=true: demo credentials are predictable; do not use for real deployments');
  }

  const [admin, professor, student] = await Promise.all([
    upsertUser({ name: adminName!, email: adminEmail!, password: adminPassword!, role: 'admin' }),
    upsertUser({ name: profName!, email: profEmail!, password: profPassword!, role: 'professor' }),
    upsertUser({ name: studentName!, email: studentEmail!, password: studentPassword!, role: 'student' }),
  ]);

  const course = await upsertCourse({
    title: 'Web Programming',
    courseCode: 'WP201',
    ects: 6,
    description: 'Demo course used for seeding Render deployments.',
    professorId: professor._id.toString(),
    studentId: student._id.toString(),
    createdById: professor._id.toString(),
  });

  const q1 = await upsertQuestion({
    courseId: course._id.toString(),
    type: 'multiple-choice',
    content: 'Which HTTP method is typically used to create a new resource?',
    options: ['GET', 'POST', 'PUT', 'DELETE'],
    correctAnswer: 'POST',
    points: 2,
    createdById: professor._id.toString(),
  });

  const q2 = await upsertQuestion({
    courseId: course._id.toString(),
    type: 'tf',
    content: 'JWT stands for JSON Web Token.',
    correctAnswer: true,
    points: 1,
    createdById: professor._id.toString(),
  });

  const q3 = await upsertQuestion({
    courseId: course._id.toString(),
    type: 'essay',
    content: 'Explain the difference between authentication and authorization.',
    points: 5,
    createdById: professor._id.toString(),
  });

  const q4 = await upsertQuestion({
    courseId: course._id.toString(),
    type: 'image-upload',
    content: 'Upload a screenshot of your API request in Postman.',
    points: 2,
    createdById: professor._id.toString(),
  });

  const questionIds = [q1._id.toString(), q2._id.toString(), q3._id.toString(), q4._id.toString()];

  const now = new Date();
  const publishedExam = await upsertExam({
    title: 'Demo Midterm',
    description: 'Seeded exam for testing the full student flow.',
    courseId: course._id.toString(),
    createdById: professor._id.toString(),
    date: new Date(now.getTime() - 5 * 60_000),
    durationMinutes: 120,
    examType: 'midterm',
    questionIds,
    published: true,
  });

  await upsertExam({
    title: 'Demo Final (Unpublished)',
    description: 'Seeded exam visible in lists but not available to take.',
    courseId: course._id.toString(),
    createdById: professor._id.toString(),
    date: new Date(now.getTime() + 7 * 24 * 60 * 60_000),
    durationMinutes: 120,
    examType: 'final',
    questionIds,
    published: false,
  });

  // Create one submitted attempt so Grades/Results/Review pages have data.
  const pointsTotal = 2 + 1 + 5 + 2;
  const pointsAwarded = 2 + 1; // objective questions only; essay/image need review

  await upsertSubmittedAttempt({
    examId: publishedExam._id.toString(),
    studentId: student._id.toString(),
    questionIds,
    needsReview: true,
    pointsAwarded,
    pointsTotal,
    reviewRequested: true,
    reviewRequestMessage: 'Could you re-check the essay grading criteria?',
    answers: [
      { question: q1._id.toString(), answer: 'POST', isCorrect: true, maxPoints: 2, pointsAwarded: 2 },
      { question: q2._id.toString(), answer: true, isCorrect: true, maxPoints: 1, pointsAwarded: 1 },
      { question: q3._id.toString(), answer: 'Authentication verifies identity; authorization verifies permissions.', maxPoints: 5, pointsAwarded: 0 },
      { question: q4._id.toString(), answer: '', maxPoints: 2, pointsAwarded: 0 },
    ],
  });

  logger.info('Demo seed complete');
  logger.info(`Demo admin: ${adminEmail} / ${allowDefaults ? 'Admin123!Demo' : '[set via env]'}`);
  logger.info(`Demo professor: ${profEmail} / ${allowDefaults ? 'Prof123!Demo' : '[set via env]'}`);
  logger.info(`Demo student: ${studentEmail} / ${allowDefaults ? 'Student123!Demo' : '[set via env]'}`);
}
