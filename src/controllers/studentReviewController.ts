import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Course from '../models/Course';
import Exam from '../models/Exam';
import ExamAttempt from '../models/ExamAttempt';
import { computeGradeSummary, PASS_PERCENT } from '../utils/grading';

const PASS_RATIO = PASS_PERCENT / 100;

export const listStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requester = (req as any).user as any;
    const requesterRole = String(requester?.role ?? '').toLowerCase();

    let query: any = { role: { $in: ['student', 'user'] } };

    if (requesterRole === 'professor') {
      const courses = await Course.find({ createdBy: requester?._id }).select('students').exec();
      const studentIds = new Set<string>();
      for (const c of courses) {
        for (const s of c.students ?? []) studentIds.add(String(s));
      }

      if (studentIds.size === 0) return res.json([]);
      query = { ...query, _id: { $in: Array.from(studentIds) } };
    }

    const students = await User.find(query).select('_id name email role createdAt').sort({ name: 1, email: 1 }).exec();

    res.json(
      students.map((s) => ({
        id: String(s._id),
        name: s.name,
        email: s.email,
        role: (s as any).role,
        createdAt: (s as any).createdAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};

export const lookupStudentByEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.query.email ?? '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await User.findOne({ email }).select('-password').exec();
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ id: user._id, name: user.name, email: user.email, role: (user as any).role });
  } catch (err) {
    next(err);
  }
};

export const getStudentReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.id;
    const student = await User.findById(studentId).select('-password').exec();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const courses = await Course.find({ students: student._id }).select('title courseCode ects').exec();

    const courseIds = courses.map((c) => c._id);
    const exams = await Exam.find({ course: { $in: courseIds } }).select('title date course').exec();

    const examIds = exams.map((e) => e._id);
    const attempts = await ExamAttempt.find({ student: student._id, exam: { $in: examIds }, submittedAt: { $exists: true, $ne: null } })
      .populate('exam', 'title date course')
      .sort({ submittedAt: -1 })
      .exec();

    const attemptsByCourse = new Map<string, any[]>();
    for (const a of attempts) {
      const ex: any = a.exam;
      const cId = ex?.course ? String(ex.course) : 'unassigned';
      const arr = attemptsByCourse.get(cId) ?? [];
      arr.push({
        attemptId: a._id,
        exam: ex,
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
        ...computeGradeSummary({
          pointsAwarded: a.pointsAwarded ?? 0,
          pointsTotal: a.pointsTotal ?? 0,
          isFinal: !((a.needsReview ?? false) && !(a as any).gradedAt),
        }),
      });
      attemptsByCourse.set(cId, arr);
    }

    const breakdown = courses.map((c) => {
      const rows = attemptsByCourse.get(String(c._id)) ?? [];
      let passed = 0;
      let failed = 0;
      for (const r of rows) {
        // Don't count pending-review attempts toward pass/fail stats.
        const isFinal = !(r.needsReview && !r.gradedAt);
        if (!isFinal) continue;
        const ratio = r.pointsTotal > 0 ? r.pointsAwarded / r.pointsTotal : 0;
        if (ratio >= PASS_RATIO) passed++;
        else failed++;
      }
      return {
        course: c,
        attempts: rows,
        stats: {
          passed,
          failed,
          total: rows.length,
          passRatioThreshold: PASS_RATIO,
        },
      };
    });

    res.json({ student, breakdown });
  } catch (err) {
    next(err);
  }
};
