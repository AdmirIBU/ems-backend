import { Request, Response, NextFunction } from 'express';
import ExamAttempt from '../models/ExamAttempt';
import Exam from '../models/Exam';
import Question from '../models/Question';
import { computeGradeSummary } from '../utils/grading';

function getAttemptQuestionIds(attempt: any, exam: any) {
  const fromAttempt = Array.isArray(attempt?.questionIds) ? attempt.questionIds : [];
  if (fromAttempt.length > 0) return fromAttempt;
  const fromExam = Array.isArray(exam?.questionIds) ? exam.questionIds : [];
  return fromExam;
}

export const getExamResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).select('title date').exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const attempts = await ExamAttempt.find({ exam: exam._id, submittedAt: { $exists: true, $ne: null } })
      .populate('student', 'name email')
      .sort({ pointsAwarded: -1, submittedAt: 1 })
      .exec();

    res.json({
      exam,
      results: attempts.map((a) => ({
        attemptId: a._id,
        student: (a as any).student,
        pointsAwarded: a.pointsAwarded ?? 0,
        pointsTotal: a.pointsTotal ?? 0,
        needsReview: a.needsReview ?? false,
        reviewRequested: (a as any).reviewRequested ?? false,
        reviewRequestedAt: (a as any).reviewRequestedAt,
        reviewAppointmentAt: (a as any).reviewAppointmentAt,
        reviewRespondedAt: (a as any).reviewRespondedAt,
        ...computeGradeSummary({
          pointsAwarded: a.pointsAwarded ?? 0,
          pointsTotal: a.pointsTotal ?? 0,
          isFinal: !((a.needsReview ?? false) && !(a as any).gradedAt),
        }),
        submittedAt: a.submittedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const getAttemptReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.attemptId)
      .populate('student', 'name email')
      .exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    const exam = await Exam.findById(attempt.exam).populate('course', 'title courseCode').exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const qids = getAttemptQuestionIds(attempt, exam);
    const questionDocs = await Question.find({ _id: { $in: qids ?? [] } }).exec();
    const questionById = new Map(questionDocs.map((q) => [q._id.toString(), q]));

    const detailed = (attempt.answers ?? []).map((a: any) => {
      const q = a.question ? questionById.get(String(a.question)) : null;
      return {
        question: q
          ? {
              id: q._id,
              type: (q as any).type,
              content: (q as any).content,
              options: (q as any).options,
              correctAnswer: (q as any).correctAnswer,
              points: (q as any).points ?? 1,
            }
          : { id: a.question },
        answer: a.answer,
        isCorrect: a.isCorrect,
        pointsAwarded: a.pointsAwarded ?? 0,
        maxPoints: a.maxPoints ?? (q as any)?.points ?? 1,
      };
    });

    res.json({
      attempt: {
        id: attempt._id,
        student: (attempt as any).student,
        submittedAt: attempt.submittedAt,
        pointsAwarded: attempt.pointsAwarded ?? 0,
        pointsTotal: attempt.pointsTotal ?? 0,
        needsReview: attempt.needsReview ?? false,
        reviewRequested: (attempt as any).reviewRequested ?? false,
        reviewRequestedAt: (attempt as any).reviewRequestedAt,
        reviewRequestMessage: (attempt as any).reviewRequestMessage,
        reviewResponseMessage: (attempt as any).reviewResponseMessage,
        reviewAppointmentAt: (attempt as any).reviewAppointmentAt,
        reviewRespondedAt: (attempt as any).reviewRespondedAt,
        gradedAt: (attempt as any).gradedAt,
        gradedBy: (attempt as any).gradedBy,
        ...computeGradeSummary({
          pointsAwarded: attempt.pointsAwarded ?? 0,
          pointsTotal: attempt.pointsTotal ?? 0,
          isFinal: !((attempt.needsReview ?? false) && !(attempt as any).gradedAt),
        }),
      },
      exam,
      answers: detailed,
    });
  } catch (err) {
    next(err);
  }
};

export const gradeAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const graderId = (req as any).user?._id;
    const { pointsByQuestion } = req.body as { pointsByQuestion: Record<string, number> };

    const attempt = await ExamAttempt.findById(req.params.attemptId).exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (!attempt.submittedAt) return res.status(400).json({ error: 'Attempt not submitted' });

    const exam = await Exam.findById(attempt.exam).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const qids = getAttemptQuestionIds(attempt, exam);
    const questionDocs = await Question.find({ _id: { $in: qids ?? [] } }).exec();
    const questionById = new Map(questionDocs.map((q) => [q._id.toString(), q]));

    let total = 0;
    let awarded = 0;

    const updatedAnswers = (attempt.answers ?? []).map((a: any) => {
      const q = a.question ? questionById.get(String(a.question)) : null;
      const maxPoints = a.maxPoints ?? (q as any)?.points ?? 1;
      total += maxPoints;

      const qid = a.question ? String(a.question) : '';
      const override = qid && pointsByQuestion ? pointsByQuestion[qid] : undefined;

      const qType = q ? String((q as any).type) : '';

      if (q && (qType === 'essay' || qType === 'image-upload')) {
        const existing = typeof a.pointsAwarded === 'number' && Number.isFinite(a.pointsAwarded) ? a.pointsAwarded : 0;
        const p = typeof override === 'number' && Number.isFinite(override)
          ? Math.max(0, Math.min(maxPoints, override))
          : existing;
        awarded += p;
        return { ...a, maxPoints, pointsAwarded: p, isCorrect: undefined };
      }

      // objective: keep existing auto-score unless explicitly overridden
      const pAuto = typeof a.pointsAwarded === 'number' ? a.pointsAwarded : 0;
      const p = typeof override === 'number' && Number.isFinite(override) ? Math.max(0, Math.min(maxPoints, override)) : pAuto;
      awarded += p;
      return { ...a, maxPoints, pointsAwarded: p };
    });

    attempt.answers = updatedAnswers as any;
    attempt.pointsTotal = total;
    attempt.pointsAwarded = awarded;
    // Grading endpoint implies the attempt has been reviewed.
    attempt.needsReview = false;
    (attempt as any).gradedAt = new Date();
    (attempt as any).gradedBy = graderId;

    await attempt.save();

    res.json({
      id: attempt._id,
      pointsAwarded: attempt.pointsAwarded,
      pointsTotal: attempt.pointsTotal,
      needsReview: attempt.needsReview,
      gradedAt: (attempt as any).gradedAt,
      ...computeGradeSummary({
        pointsAwarded: attempt.pointsAwarded ?? 0,
        pointsTotal: attempt.pointsTotal ?? 0,
        isFinal: true,
      }),
    });
  } catch (err) {
    next(err);
  }
};

export const requestAttemptReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    const { message } = (req.body ?? {}) as { message?: string };

    const attempt = await ExamAttempt.findById(req.params.attemptId).exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.student.toString() !== String(studentId)) return res.status(403).json({ error: 'Forbidden' });
    if (!attempt.submittedAt) return res.status(400).json({ error: 'Attempt not submitted' });

    if ((attempt as any).reviewRequested) {
      return res.status(400).json({ error: 'Review already requested' });
    }

    (attempt as any).reviewRequested = true;
    (attempt as any).reviewRequestedAt = new Date();
    if (typeof message === 'string' && message.trim()) {
      (attempt as any).reviewRequestMessage = message.trim().slice(0, 1000);
    }

    await attempt.save();

    res.json({
      attemptId: attempt._id,
      reviewRequested: (attempt as any).reviewRequested ?? false,
      reviewRequestedAt: (attempt as any).reviewRequestedAt,
    });
  } catch (err) {
    next(err);
  }
};

export const respondToReviewRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const responderId = (req as any).user?._id;
    const { appointmentAt, message } = (req.body ?? {}) as { appointmentAt?: string | null; message?: string | null };

    const attempt = await ExamAttempt.findById(req.params.attemptId).exec();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (!attempt.submittedAt) return res.status(400).json({ error: 'Attempt not submitted' });
    if (!((attempt as any).reviewRequested ?? false)) return res.status(400).json({ error: 'No review request for this attempt' });

    if (appointmentAt === null) {
      (attempt as any).reviewAppointmentAt = undefined;
    } else if (typeof appointmentAt === 'string' && appointmentAt.trim()) {
      const d = new Date(appointmentAt);
      if (!Number.isFinite(d.getTime())) return res.status(400).json({ error: 'appointmentAt must be a valid date/time' });
      ;(attempt as any).reviewAppointmentAt = d;
    }

    if (message === null) {
      (attempt as any).reviewResponseMessage = undefined;
    } else if (typeof message === 'string') {
      const trimmed = message.trim();
      (attempt as any).reviewResponseMessage = trimmed ? trimmed.slice(0, 1000) : undefined;
    }

    ;(attempt as any).reviewRespondedAt = new Date();
    ;(attempt as any).reviewRespondedBy = responderId;
    await attempt.save();

    res.json({
      attemptId: attempt._id,
      reviewAppointmentAt: (attempt as any).reviewAppointmentAt,
      reviewResponseMessage: (attempt as any).reviewResponseMessage,
      reviewRespondedAt: (attempt as any).reviewRespondedAt,
    });
  } catch (err) {
    next(err);
  }
};
