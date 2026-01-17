import { Request, Response, NextFunction } from 'express';
import ExamAttempt from '../models/ExamAttempt';
import { computeGradeSummary } from '../utils/grading';

export const getMyGrades = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = (req as any).user?._id;
    const attempts = await ExamAttempt.find({ student: studentId, submittedAt: { $exists: true, $ne: null } })
      .populate('exam', 'title date course')
      .sort({ submittedAt: -1 })
      .exec();

    res.json(
      attempts.map((a) => ({
        ...computeGradeSummary({
          pointsAwarded: a.pointsAwarded ?? 0,
          pointsTotal: a.pointsTotal ?? 0,
          isFinal: !((a.needsReview ?? false) && !(a as any).gradedAt),
        }),
        id: a._id,
        exam: a.exam,
        submittedAt: a.submittedAt,
        pointsAwarded: a.pointsAwarded ?? 0,
        pointsTotal: a.pointsTotal ?? 0,
        needsReview: a.needsReview ?? false,
        gradedAt: (a as any).gradedAt,
        reviewRequested: (a as any).reviewRequested ?? false,
        reviewRequestedAt: (a as any).reviewRequestedAt,
        reviewResponseMessage: (a as any).reviewResponseMessage,
        reviewAppointmentAt: (a as any).reviewAppointmentAt,
        reviewRespondedAt: (a as any).reviewRespondedAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};
