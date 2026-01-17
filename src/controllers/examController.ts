import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Exam from '../models/Exam';
import ExamAttempt from '../models/ExamAttempt';
import Question from '../models/Question';
import { computeGradeSummary } from '../utils/grading';

function isExamCurrentlyAvailable(exam: any, now: Date) {
  if (!exam.published) return false;
  const start = new Date(exam.date);
  const duration = typeof exam.durationMinutes === 'number' ? exam.durationMinutes : 60;
  const end = new Date(start.getTime() + duration * 60_000);
  return now >= start && now <= end;
}

function computeAttemptExpiresAt(exam: any, startedAt: Date) {
  const duration = typeof exam.durationMinutes === 'number' ? exam.durationMinutes : 60;
  return new Date(new Date(startedAt).getTime() + duration * 60_000);
}

function getAttemptQuestionIds(attempt: any, exam: any) {
  const fromAttempt = Array.isArray(attempt?.questionIds) ? attempt.questionIds : [];
  if (fromAttempt.length > 0) return fromAttempt;
  const fromExam = Array.isArray(exam?.questionIds) ? exam.questionIds : [];
  return fromExam;
}

function cryptoRandomInt(maxExclusive: number) {
  if (maxExclusive <= 0) return 0;
  return crypto.randomInt(0, maxExclusive);
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function pickRandomUnique<T>(arr: T[], n: number) {
  const copy = arr.slice();
  shuffleInPlace(copy);
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
}

async function validateRandomExamHasEnoughQuestions(exam: any) {
  if (!exam?.course) {
    return { ok: false, error: 'Random question selection requires a courseId' } as const;
  }

  const total = Number(exam?.numQuestions ?? 0);
  if (!Number.isFinite(total) || total < 1) {
    return { ok: false, error: 'numQuestions must be at least 1' } as const;
  }

  const cfg = (exam as any).randomQuestionConfig ?? {};
  const mcCount = Number(cfg?.mcCount ?? 0);
  const tfCount = Number(cfg?.tfCount ?? 0);
  const imageCount = Number(cfg?.imageCount ?? 0);
  const essayCount = Number(cfg?.essayCount ?? 0);

  if ([mcCount, tfCount, imageCount, essayCount].some((x) => !Number.isFinite(x) || x < 0)) {
    return { ok: false, error: 'mcCount, tfCount, imageCount and essayCount must be 0 or greater' } as const;
  }

  const typedSum = mcCount + tfCount + imageCount + essayCount;
  if (typedSum > total) {
    return { ok: false, error: 'Sum of mc/tf/image/essay counts cannot exceed total numQuestions' } as const;
  }

  const [mc, tf, img, essay, all] = await Promise.all([
    Question.countDocuments({ course: exam.course, type: 'multiple-choice' }).exec(),
    Question.countDocuments({ course: exam.course, type: 'tf' }).exec(),
    Question.countDocuments({ course: exam.course, type: 'image-upload' }).exec(),
    Question.countDocuments({ course: exam.course, type: 'essay' }).exec(),
    Question.countDocuments({ course: exam.course }).exec(),
  ]);

  if (mcCount > mc) return { ok: false, error: `Not enough multiple-choice questions in pool (needed ${mcCount}, have ${mc})` } as const;
  if (tfCount > tf) return { ok: false, error: `Not enough true/false questions in pool (needed ${tfCount}, have ${tf})` } as const;
  if (imageCount > img) return { ok: false, error: `Not enough image-upload questions in pool (needed ${imageCount}, have ${img})` } as const;
  if (essayCount > essay) return { ok: false, error: `Not enough essay questions in pool (needed ${essayCount}, have ${essay})` } as const;
  if (total > all) return { ok: false, error: `Not enough total questions in pool (needed ${total}, have ${all})` } as const;

  return { ok: true } as const;
}

async function selectRandomQuestionsForAttempt(exam: any) {
  const total = Number(exam?.numQuestions ?? 0);
  const cfg = (exam as any).randomQuestionConfig ?? {};
  const mcCount = Number(cfg?.mcCount ?? 0);
  const tfCount = Number(cfg?.tfCount ?? 0);
  const imageCount = Number(cfg?.imageCount ?? 0);
  const essayCount = Number(cfg?.essayCount ?? 0);
  const shuffleOrder = cfg?.shuffleOrder !== false;

  const [mcDocs, tfDocs, imgDocs, essayDocs, allDocs] = await Promise.all([
    Question.find({ course: exam.course, type: 'multiple-choice' }).select('_id').exec(),
    Question.find({ course: exam.course, type: 'tf' }).select('_id').exec(),
    Question.find({ course: exam.course, type: 'image-upload' }).select('_id').exec(),
    Question.find({ course: exam.course, type: 'essay' }).select('_id').exec(),
    Question.find({ course: exam.course }).select('_id').exec(),
  ]);

  const mcIds = mcDocs.map((q) => q._id);
  const tfIds = tfDocs.map((q) => q._id);
  const imgIds = imgDocs.map((q) => q._id);
  const essayIds = essayDocs.map((q) => q._id);
  const allIds = allDocs.map((q) => q._id);

  const pickedMc = pickRandomUnique(mcIds, mcCount);
  const pickedTf = pickRandomUnique(tfIds, tfCount);
  const pickedImg = pickRandomUnique(imgIds, imageCount);
  const pickedEssay = pickRandomUnique(essayIds, essayCount);

  const pickedSet = new Set<string>([...pickedMc, ...pickedTf, ...pickedImg, ...pickedEssay].map((id) => String(id)));
  const remainingNeeded = Math.max(0, total - (mcCount + tfCount + imageCount + essayCount));
  const remainingPool = allIds.filter((id) => !pickedSet.has(String(id)));
  const pickedRemaining = pickRandomUnique(remainingPool, remainingNeeded);

  const finalIds = [...pickedMc, ...pickedTf, ...pickedImg, ...pickedEssay, ...pickedRemaining];
  if (shuffleOrder) shuffleInPlace(finalIds);
  return finalIds;
}

async function finalizeAttempt(attempt: any, exam: any, submittedAnswers: { question?: string; answer: any }[]) {
  const qids = getAttemptQuestionIds(attempt, exam);
  if (!Array.isArray(qids) || qids.length === 0) {
    await ensureExamQuestions(exam);
  }
  const questionIdsToGrade = getAttemptQuestionIds(attempt, exam);

  const questionDocs = await Question.find({ _id: { $in: questionIdsToGrade ?? [] } }).exec();
  const questionById = new Map(questionDocs.map((q) => [q._id.toString(), q]));
  const submitted = Array.isArray(submittedAnswers) ? submittedAnswers : [];
  const submittedByQ = new Map(submitted.filter((a) => a.question).map((a) => [String(a.question), a.answer]));

  let total = 0;
  let awarded = 0;
  let needsReview = false;

  const normalizedAnswers = (questionIdsToGrade ?? []).map((qid: any) => {
    const q = questionById.get(String(qid));
    if (!q) return { question: qid as any, answer: submittedByQ.get(String(qid)) };

    const maxPoints = typeof (q as any).points === 'number' ? (q as any).points : 1;
    total += maxPoints;

    const ans = submittedByQ.get(q._id.toString());
    const qType = String((q as any).type);

    // Manual review question types
    if (qType === 'essay' || qType === 'image-upload') {
      needsReview = true;
      return { question: q._id as any, answer: ans, maxPoints, pointsAwarded: 0 };
    }

    let isCorrect = false;
    if (qType === 'tf') {
      isCorrect = typeof ans === 'boolean' && ans === (q as any).correctAnswer;
    } else if (qType === 'multiple-choice') {
      isCorrect = typeof ans === 'string' && ans === (q as any).correctAnswer;
    }

    const pa = isCorrect ? maxPoints : 0;
    awarded += pa;
    return { question: q._id as any, answer: ans, isCorrect, maxPoints, pointsAwarded: pa };
  });

  attempt.answers = normalizedAnswers as any;
  attempt.pointsTotal = total;
  attempt.pointsAwarded = awarded;
  attempt.needsReview = needsReview;
  attempt.submittedAt = new Date();
  await attempt.save();

  return attempt;
}

async function ensureExamQuestions(exam: any) {
  if (String((exam as any)?.questionSelectionMode) === 'random') return exam;
  if (Array.isArray(exam.questionIds) && exam.questionIds.length > 0) return exam;
  if (!exam.course || !exam.numQuestions) return exam;

  const all = await Question.find({ course: exam.course }).select('_id').exec();
  const ids = all.map((q) => q._id);
  if (ids.length === 0) return exam;

  // pick up to numQuestions randomly
  const shuffled = ids.sort(() => Math.random() - 0.5);
  exam.questionIds = shuffled.slice(0, Math.min(exam.numQuestions, shuffled.length));
  await exam.save();
  return exam;
}

export const createExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, date, durationMinutes, examType, numQuestions, courseId, questionIds, questionSelectionMode, randomQuestionConfig } = req.body as {
      title: string;
      description?: string;
      date: string;
      durationMinutes?: number;
      examType?: string;
      numQuestions?: number;
      courseId?: string;
      questionIds?: string[];
      questionSelectionMode?: 'manual' | 'random';
      randomQuestionConfig?: {
        mcCount?: number;
        tfCount?: number;
        imageCount?: number;
        essayCount?: number;
        randomizePerStudent?: boolean;
        shuffleOrder?: boolean;
      };
    };

    if (!title || !date || numQuestions == null || examType == null) {
      return res.status(400).json({ error: 'title, date, examType and numQuestions are required' });
    }

    const exam = new Exam({
      title,
      description,
      date: new Date(date),
      durationMinutes,
      examType,
      numQuestions,
      course: courseId,
      questionSelectionMode: questionSelectionMode ?? 'manual',
      randomQuestionConfig: randomQuestionConfig ?? undefined,
      createdBy: (req as any).user._id,
      published: false,
    });

    if (String(exam.questionSelectionMode) === 'random') {
      const v = await validateRandomExamHasEnoughQuestions(exam);
      if (!v.ok) return res.status(400).json({ error: v.error });
      // For random mode, questions are chosen per student attempt.
      exam.questionIds = [] as any;
    }

    // Optional: explicit question selection from pool
    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const qdocs = await Question.find({ _id: { $in: questionIds } }).select('_id course').exec();
      if (qdocs.length !== questionIds.length) {
        return res.status(400).json({ error: 'One or more questionIds are invalid' });
      }
      if (courseId) {
        const mismatch = qdocs.some((q) => String((q as any).course) !== String(courseId));
        if (mismatch) return res.status(400).json({ error: 'All selected questions must belong to the selected course' });
      }
      exam.questionSelectionMode = 'manual' as any;
      exam.questionIds = questionIds as any;
      exam.numQuestions = questionIds.length;
    }

    await exam.save();
    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
};

export const setExamQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.published) return res.status(400).json({ error: 'Cannot change questions after publish' });

    if (String((exam as any).questionSelectionMode) === 'random') {
      return res.status(400).json({ error: 'This exam uses random question selection. Switch to manual selection to set explicit questions.' });
    }

    const { questionIds } = req.body as { questionIds: string[] };

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      exam.questionIds = [] as any;
      await exam.save();
      return res.json(exam);
    }

    const qdocs = await Question.find({ _id: { $in: questionIds } }).select('_id course').exec();
    if (qdocs.length !== questionIds.length) {
      return res.status(400).json({ error: 'One or more questionIds are invalid' });
    }

    if (exam.course) {
      const mismatch = qdocs.some((q) => String((q as any).course) !== String(exam.course));
      if (mismatch) return res.status(400).json({ error: 'All selected questions must belong to the exam course' });
    }

    exam.questionIds = questionIds as any;
    exam.numQuestions = questionIds.length;
    await exam.save();
    res.json(exam);
  } catch (err) {
    next(err);
  }
};

export const getExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = await Exam.find().populate('createdBy', 'name email').populate('course', 'title courseCode').exec();
    res.json(exams);
  } catch (err) {
    next(err);
  }
};

export const getAvailableExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const exams = await Exam.find({ published: true, date: { $lte: now } })
      .populate('createdBy', 'name email')
      .populate('course', 'title courseCode')
      .exec();
    res.json(exams.filter((e) => isExamCurrentlyAvailable(e, now)));
  } catch (err) {
    next(err);
  }
};

export const getMyActiveAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();

    const attempt = await ExamAttempt.findOne({
      student: studentId,
      $or: [{ submittedAt: { $exists: false } }, { submittedAt: null }],
    })
      .sort({ startedAt: -1 })
      .populate('exam')
      .exec();

    if (!attempt) return res.status(404).json({ active: false });

    const exam = (attempt as any).exam;
    if (!exam) return res.status(404).json({ active: false });

    // Ensure expiresAt exists (for attempts created before expiry support)
    if (!(attempt as any).expiresAt) {
      (attempt as any).expiresAt = computeAttemptExpiresAt(exam, attempt.startedAt ?? now);
      await attempt.save();
    }

    const expiresAt = (attempt as any).expiresAt ? new Date((attempt as any).expiresAt) : null;
    if (!expiresAt) return res.status(404).json({ active: false });

    // If expired, auto-finalize with whatever we have and treat as no longer active.
    if (now > expiresAt) {
      const existingAnswers = Array.isArray((attempt as any).answers)
        ? (attempt as any).answers.map((a: any) => ({ question: a.question, answer: a.answer }))
        : [];

      try {
        await finalizeAttempt(attempt, exam, existingAnswers);
      } catch {
        // If finalize fails, still treat as not active.
      }

      return res.json({ active: false, expired: true, examId: String(exam._id), attemptId: String(attempt._id) });
    }

    return res.json({
      active: true,
      examId: String(exam._id),
      attemptId: String(attempt._id),
      startedAt: attempt.startedAt,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

export const getExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('course', 'title courseCode')
      .populate('questionIds')
      .exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    next(err);
  }
};

export const publishExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.published) return res.json(exam);

    if (String((exam as any).questionSelectionMode) === 'random') {
      const v = await validateRandomExamHasEnoughQuestions(exam);
      if (!v.ok) return res.status(400).json({ error: v.error });
    }

    // Ensure exam has questions before publishing (manual mode).
    await ensureExamQuestions(exam);
    if (String((exam as any).questionSelectionMode) !== 'random') {
      if (!Array.isArray(exam.questionIds) || exam.questionIds.length === 0) {
        return res.status(400).json({
          error: 'Cannot publish an exam with no questions. Attach questions or select a course with a question pool.',
        });
      }
    }

    exam.published = true;
    exam.publishedAt = new Date();
    await exam.save();
    res.json(exam);
  } catch (err) {
    next(err);
  }
};

export const startAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    const now = new Date();
    const exam = await Exam.findById(req.params.id).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (!isExamCurrentlyAvailable(exam, now)) return res.status(400).json({ error: 'Exam is not currently available' });

    const isRandom = String((exam as any).questionSelectionMode) === 'random' && ((exam as any).randomQuestionConfig?.randomizePerStudent !== false);
    if (!isRandom) {
      await ensureExamQuestions(exam);
    } else {
      const v = await validateRandomExamHasEnoughQuestions(exam);
      if (!v.ok) return res.status(400).json({ error: v.error });
    }

    let attempt = await ExamAttempt.findOne({ exam: exam._id, student: studentId }).exec();
    if (attempt?.submittedAt) return res.status(400).json({ error: 'You already submitted this exam' });
    if (!attempt) {
      const attemptQuestionIds = isRandom ? await selectRandomQuestionsForAttempt(exam) : (exam.questionIds ?? []);
      attempt = new ExamAttempt({
        exam: exam._id,
        student: studentId,
        startedAt: now,
        expiresAt: computeAttemptExpiresAt(exam, now),
        questionIds: attemptQuestionIds as any,
        answers: [],
      });
      await attempt.save();
    } else if (!attempt.expiresAt) {
      attempt.expiresAt = computeAttemptExpiresAt(exam, attempt.startedAt ?? now);
      await attempt.save();
    }

    // Ensure attempt has questionIds for older attempts created before this feature.
    if (!Array.isArray((attempt as any).questionIds) || (attempt as any).questionIds.length === 0) {
      const fallback = isRandom ? await selectRandomQuestionsForAttempt(exam) : (exam.questionIds ?? []);
      ;(attempt as any).questionIds = fallback as any;
      await attempt.save();
    }

    const attemptQids = getAttemptQuestionIds(attempt, exam);

    // If time already expired, auto-submit with whatever is saved.
    if (attempt.expiresAt && now > new Date(attempt.expiresAt)) {
      const existingAnswers = Array.isArray(attempt.answers)
        ? attempt.answers.map((a: any) => ({ question: a.question, answer: a.answer }))
        : [];
      const finalized = await finalizeAttempt(attempt, exam, existingAnswers as any);

      const [examDoc, questionDocs] = await Promise.all([
        Exam.findById(exam._id).populate('course', 'title courseCode').exec(),
        Question.find({ _id: { $in: attemptQids } }).exec(),
      ]);
      const byId = new Map(questionDocs.map((q) => [String(q._id), q]));
      const orderedQuestions = (attemptQids ?? []).map((id: any) => byId.get(String(id))).filter(Boolean);
      const populatedExam = examDoc ? ({ ...(examDoc as any).toObject(), questionIds: orderedQuestions } as any) : null;
      if (!populatedExam) return res.status(500).json({ error: 'Failed to load exam' });

      return res.json({
        attempt: {
          id: finalized._id,
          exam: finalized.exam,
          student: finalized.student,
          startedAt: finalized.startedAt,
          expiresAt: finalized.expiresAt,
          submittedAt: finalized.submittedAt,
          answers: finalized.answers,
          pointsAwarded: finalized.pointsAwarded,
          pointsTotal: finalized.pointsTotal,
          needsReview: finalized.needsReview,
          ...computeGradeSummary({
            pointsAwarded: finalized.pointsAwarded,
            pointsTotal: finalized.pointsTotal,
            isFinal: !(finalized.needsReview && !(finalized as any).gradedAt),
          }),
          autoSubmitted: true,
        },
        exam: populatedExam,
      });
    }

    const [examDoc, questionDocs] = await Promise.all([
      Exam.findById(exam._id).populate('course', 'title courseCode').exec(),
      Question.find({ _id: { $in: attemptQids } }).exec(),
    ]);
    const byId = new Map(questionDocs.map((q) => [String(q._id), q]));
    const orderedQuestions = (attemptQids ?? []).map((id: any) => byId.get(String(id))).filter(Boolean);
    const populatedExam = examDoc ? ({ ...(examDoc as any).toObject(), questionIds: orderedQuestions } as any) : null;

    if (!populatedExam) return res.status(500).json({ error: 'Failed to load exam' });

    res.json({
      attempt: {
        id: attempt._id,
        exam: attempt.exam,
        student: attempt.student,
        startedAt: attempt.startedAt,
        expiresAt: (attempt as any).expiresAt,
        submittedAt: attempt.submittedAt,
        answers: attempt.answers,
      },
      exam: populatedExam,
    });
  } catch (err) {
    next(err);
  }
};

export const getAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    const attempt = await ExamAttempt.findById(req.params.attemptId).populate('exam').exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.student.toString() !== studentId.toString()) return res.status(403).json({ error: 'Forbidden' });

    const examDoc = await Exam.findById(attempt.exam).populate('course', 'title courseCode').exec();
    if (!examDoc) return res.status(404).json({ error: 'Exam not found' });

    const qids = getAttemptQuestionIds(attempt, examDoc);
    const questionDocs = await Question.find({ _id: { $in: qids } }).exec();
    const byId = new Map(questionDocs.map((q) => [String(q._id), q]));
    const orderedQuestions = (qids ?? []).map((id: any) => byId.get(String(id))).filter(Boolean);
    const exam = ({ ...(examDoc as any).toObject(), questionIds: orderedQuestions } as any);

    res.json({ attempt, exam });
  } catch (err) {
    next(err);
  }
};

export const autosaveAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    const { answers } = (req.body ?? {}) as { answers?: { question?: string; answer: any }[] };

    const attempt = await ExamAttempt.findById(req.params.attemptId).exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.student.toString() !== studentId.toString()) return res.status(403).json({ error: 'Forbidden' });
    if (attempt.submittedAt) return res.status(400).json({ error: 'Attempt already submitted' });

    const exam = await Exam.findById(attempt.exam).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const expiresAt = (attempt as any).expiresAt ? new Date((attempt as any).expiresAt) : computeAttemptExpiresAt(exam, attempt.startedAt);
    if (!(attempt as any).expiresAt) (attempt as any).expiresAt = expiresAt;
    if (new Date() > expiresAt) return res.status(400).json({ error: 'Time is up' });

    const submitted = Array.isArray(answers) ? answers : [];
    const byQ = new Map(submitted.filter((a) => a.question).map((a) => [String(a.question), a.answer]));

    // Merge into existing draft answers.
    const nextAnswers: any[] = Array.isArray(attempt.answers) ? attempt.answers.map((a: any) => ({ question: a.question, answer: a.answer })) : [];
    const idx = new Map(nextAnswers.map((a) => [String(a.question), a]));
    for (const [q, ans] of byQ) {
      const existing = idx.get(String(q));
      if (existing) existing.answer = ans;
      else nextAnswers.push({ question: q as any, answer: ans });
    }

    attempt.answers = nextAnswers as any;
    await attempt.save();

    res.json({
      id: attempt._id,
      startedAt: attempt.startedAt,
      expiresAt: (attempt as any).expiresAt,
      submittedAt: attempt.submittedAt,
      answers: attempt.answers,
    });
  } catch (err) {
    next(err);
  }
};

export const uploadAttemptAnswerImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    const attempt = await ExamAttempt.findById(req.params.attemptId).exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.student.toString() !== studentId.toString()) return res.status(403).json({ error: 'Forbidden' });
    if (attempt.submittedAt) return res.status(400).json({ error: 'Attempt already submitted' });

    const exam = await Exam.findById(attempt.exam).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const questionId = String(req.params.questionId);

    const attemptQids = getAttemptQuestionIds(attempt, exam);
    const allowed = (attemptQids ?? []).some((qid: any) => String(qid) === questionId);
    if (!allowed) return res.status(400).json({ error: 'Question is not part of this exam' });

    const qdoc = await Question.findById(questionId).select('type').exec();
    if (!qdoc) return res.status(404).json({ error: 'Question not found' });
    if (String((qdoc as any).type) !== 'image-upload') return res.status(400).json({ error: 'Question is not image-upload type' });

    const f = (req as any).file as Express.Multer.File | undefined;
    if (!f) return res.status(400).json({ error: 'image file is required' });

    const imageAnswer = {
      kind: 'image',
      path: `/uploads/attempts/${f.filename}`,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      uploadedAt: new Date().toISOString(),
    };

    const nextAnswers: any[] = Array.isArray(attempt.answers) ? attempt.answers.map((a: any) => ({ question: a.question, answer: a.answer })) : [];
    const existing = nextAnswers.find((a) => String(a.question) === questionId);
    if (existing) existing.answer = imageAnswer;
    else nextAnswers.push({ question: questionId as any, answer: imageAnswer });
    attempt.answers = nextAnswers as any;
    await attempt.save();

    res.json({ question: questionId, answer: imageAnswer });
  } catch (err) {
    next(err);
  }
};

export const submitAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    const { answers } = (req.body ?? {}) as { answers?: { question?: string; answer: any }[] };

    const attempt = await ExamAttempt.findById(req.params.attemptId).exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.student.toString() !== studentId.toString()) return res.status(403).json({ error: 'Forbidden' });
    if (attempt.submittedAt) return res.status(400).json({ error: 'Attempt already submitted' });

    const exam = await Exam.findById(attempt.exam).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Enforce attempt expiration (server-side safety).
    const expiresAt = (attempt as any).expiresAt ? new Date((attempt as any).expiresAt) : computeAttemptExpiresAt(exam, attempt.startedAt);
    if (!(attempt as any).expiresAt) {
      (attempt as any).expiresAt = expiresAt;
      await attempt.save();
    }

    // If client didn't send answers (or time expired), fall back to saved draft answers.
    const submittedAnswers = Array.isArray(answers)
      ? answers
      : Array.isArray(attempt.answers)
        ? attempt.answers.map((a: any) => ({ question: a.question, answer: a.answer }))
        : [];

    const finalized = await finalizeAttempt(attempt, exam, submittedAnswers as any);

    const gradeSummary = computeGradeSummary({
      pointsAwarded: finalized.pointsAwarded,
      pointsTotal: finalized.pointsTotal,
      isFinal: !(finalized.needsReview && !(finalized as any).gradedAt),
    });

    res.json({
      id: finalized._id,
      exam: finalized.exam,
      student: finalized.student,
      startedAt: finalized.startedAt,
      expiresAt: (finalized as any).expiresAt,
      submittedAt: finalized.submittedAt,
      pointsAwarded: finalized.pointsAwarded,
      pointsTotal: finalized.pointsTotal,
      needsReview: finalized.needsReview,
      ...gradeSummary,
    });
  } catch (err) {
    next(err);
  }
};

export const updateExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    Object.assign(exam, req.body);
    await exam.save();
    res.json(exam);
  } catch (err) {
    next(err);
  }
};

export const deleteExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    await exam.deleteOne();
    res.json({ msg: 'Exam removed' });
  } catch (err) {
    next(err);
  }
};
