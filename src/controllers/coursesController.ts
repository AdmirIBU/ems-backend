import { Request, Response, NextFunction } from 'express';
import Course from '../models/Course';
import fs from 'fs';
import path from 'path';
import { canProfessorManageCourse, canStudentAccessCourse } from '../utils/courseAccess';
import User from '../models/User';

export const getCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await Course.find()
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    res.json(courses);
  } catch (err) {
    next(err);
  }
};

export const getCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (err) {
    next(err);
  }
};

export const getMyCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;
    const courses = await Course.find({ students: userId })
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    res.json(courses);
  } catch (err) {
    next(err);
  }
};

export const getMyTeachingCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;
    const courses = await Course.find({ $or: [{ professors: userId }, { createdBy: userId }] })
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    res.json(courses);
  } catch (err) {
    next(err);
  }
};

export const getMyCoursesStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;
    const courses = await Course.find({
      $or: [{ students: userId }, { 'enrollmentRequests.student': userId }],
    })
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();

    const enrolled: any[] = [];
    const pending: any[] = [];

    const asIdString = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'object' && v._id) return String(v._id);
      return String(v);
    };

    for (const c of courses) {
      const uid = String(userId);
      const isEnrolled = (c.students ?? []).some((s: any) => asIdString(s) === uid);
      const isPending = (c.enrollmentRequests ?? []).some((r: any) => asIdString(r.student) === uid);
      if (isEnrolled) enrolled.push(c);
      else if (isPending) pending.push(c);
    }

    res.json({ enrolled, pending });
  } catch (err) {
    next(err);
  }
};

// Enrollment request (student)
export const enrollCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user._id;
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // already enrolled
    if (course.students.some((s: any) => s.toString() === userId.toString())) {
      const populated = await Course.findById(course._id)
        .populate('students', 'name email')
        .populate('enrollmentRequests.student', 'name email')
        .exec();
      return res.json(populated);
    }

    const existing = (course.enrollmentRequests ?? []).some((r: any) => r.student?.toString?.() === userId.toString());
    if (!existing) {
      course.enrollmentRequests = course.enrollmentRequests ?? [];
      course.enrollmentRequests.push({ student: userId, requestedAt: new Date() } as any);
      await course.save();
    }

    const populated = await Course.findById(course._id)
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .exec();

    res.json(populated);
  } catch (err) {
    next(err);
  }
};

export const approveEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const studentId = req.params.studentId;
    const pending = (course.enrollmentRequests ?? []).some((r: any) => String(r.student) === String(studentId));
    if (!pending) return res.status(400).json({ error: 'No pending request for this student' });

    course.enrollmentRequests = (course.enrollmentRequests ?? []).filter((r: any) => String(r.student) !== String(studentId));
    if (!course.students.some((s: any) => String(s) === String(studentId))) {
      course.students.push(studentId as any);
    }
    await course.save();

    const populated = await Course.findById(course._id)
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    res.json(populated);
  } catch (err) {
    next(err);
  }
};

export const rejectEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const studentId = req.params.studentId;
    course.enrollmentRequests = (course.enrollmentRequests ?? []).filter((r: any) => String(r.student) !== String(studentId));
    await course.save();

    const populated = await Course.findById(course._id)
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    res.json(populated);
  } catch (err) {
    next(err);
  }
};

export const updateCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { title, description, courseCode, ects } = req.body as {
      title?: string;
      description?: string;
      courseCode?: string;
      ects?: string | number;
    };

    if (title != null) course.title = title;
    if (description != null) course.description = description;
    if (courseCode != null) course.courseCode = courseCode;
    if (ects != null) course.ects = typeof ects === 'string' ? parseInt(ects, 10) : (ects as any);

    const syllabusFile = (req as any).file;
    if (syllabusFile) {
      course.syllabus = {
        filename: syllabusFile.filename,
        originalName: syllabusFile.originalname,
        path: `/uploads/syllabi/${syllabusFile.filename}`,
        mimetype: syllabusFile.mimetype,
        size: syllabusFile.size,
      } as any;
    }

    await course.save();

    const populated = await Course.findById(course._id)
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    res.json(populated);
  } catch (err) {
    next(err);
  }
};

export const createCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // fields parsed by multer when using multipart/form-data
    const { title, description, courseCode, ects } = req.body as {
      title: string;
      description?: string;
      courseCode: string;
      ects: string | number;
    };

    if (!title || !courseCode || ects == null) {
      return res.status(400).json({ error: 'title, courseCode and ects are required' });
    }

    const syllabusFile = (req as any).file;
    const syllabus = syllabusFile
      ? {
          filename: syllabusFile.filename,
          originalName: syllabusFile.originalname,
          // expose a relative URL path for clients
          path: `/uploads/syllabi/${syllabusFile.filename}`,
          mimetype: syllabusFile.mimetype,
          size: syllabusFile.size,
        }
      : undefined;

    const creatorId = (req as any).user?._id;
    const creatorRole = String((req as any).user?.role ?? '').toLowerCase();

    const course = new Course({
      title,
      description,
      courseCode,
      ects: typeof ects === 'string' ? parseInt(ects, 10) : ects,
      syllabus,
      createdBy: creatorId,
      professors: creatorRole === 'professor' && creatorId ? [creatorId] : [],
    });

    await course.save();
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
};

export const setCourseProfessors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const professorIds = (req.body as any)?.professorIds;
    if (!Array.isArray(professorIds)) {
      return res.status(400).json({ error: 'professorIds must be an array' });
    }

    const cleaned = [...new Set(professorIds.map((x: any) => String(x)).filter(Boolean))];

    if (cleaned.length > 0) {
      const users = await User.find({ _id: { $in: cleaned } }).select('role').exec();
      const bad = users.some((u: any) => String(u.role ?? '').toLowerCase() !== 'professor');
      if (users.length !== cleaned.length || bad) {
        return res.status(400).json({ error: 'All assigned users must exist and be professors' });
      }
    }

    ;(course as any).professors = cleaned as any;
    await course.save();

    const populated = await Course.findById(course._id)
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();

    res.json(populated);
  } catch (err) {
    next(err);
  }
};

export const shareCourseWithProfessors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!canProfessorManageCourse(user, course)) return res.status(403).json({ error: 'Forbidden' });

    const emailsRaw = (req.body as any)?.emails;
    if (!Array.isArray(emailsRaw) || emailsRaw.length === 0) {
      return res.status(400).json({ error: 'emails must be a non-empty array' });
    }

    const emails = [...new Set(emailsRaw.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean))];
    if (emails.length === 0) return res.status(400).json({ error: 'No valid emails provided' });

    const users = await User.find({ email: { $in: emails } }).select('_id role email').exec();
    if (users.length !== emails.length) {
      const found = new Set(users.map((u: any) => String(u.email ?? '').toLowerCase()));
      const missing = emails.filter((e) => !found.has(e));
      return res.status(400).json({ error: `Unknown professor email(s): ${missing.join(', ')}` });
    }

    const nonProf = users.find((u: any) => String(u.role ?? '').toLowerCase() !== 'professor');
    if (nonProf) return res.status(400).json({ error: 'All shared users must be professors' });

    const idsToAdd = users.map((u) => String(u._id));

    const current = Array.isArray((course as any).professors) ? (course as any).professors.map((p: any) => String(p)) : [];
    const merged = Array.from(new Set([...current, ...idsToAdd]));

    // Ensure the current professor is included as well.
    if (String(user?.role ?? '').toLowerCase() === 'professor' && user?._id) {
      merged.push(String(user._id));
    }

    ;(course as any).professors = Array.from(new Set(merged)) as any;
    await course.save();

    const populated = await Course.findById(course._id)
      .populate('students', 'name email')
      .populate('enrollmentRequests.student', 'name email')
      .populate('professors', 'name email')
      .populate('createdBy', 'name email')
      .exec();

    res.json(populated);
  } catch (err) {
    next(err);
  }
};

// Questions
import Question from '../models/Question';

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, content, options, correctAnswer, points } = req.body as {
      type: 'essay' | 'multiple-choice' | 'tf' | 'image-upload';
      content: string;
      options?: string[];
      correctAnswer?: any;
      points?: number;
    };
    const courseId = req.params.id;
    const course = await Course.findById(courseId).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!type || !content) return res.status(400).json({ error: 'type and content are required' });

    const pts = typeof points === 'number' && Number.isFinite(points) ? points : 1;

    if (type === 'multiple-choice') {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: 'multiple-choice questions require at least 2 options' });
      }
      if (typeof correctAnswer !== 'string' || !options.includes(correctAnswer)) {
        return res.status(400).json({ error: 'multiple-choice questions require correctAnswer to be one of the options' });
      }
    }

    if (type === 'tf') {
      if (typeof correctAnswer !== 'boolean') {
        return res.status(400).json({ error: 'tf questions require correctAnswer to be boolean' });
      }
    }

    if (type === 'image-upload') {
      // No correctAnswer/options; graded manually.
    }

    const q = new Question({
      course: courseId,
      type,
      content,
      options,
      correctAnswer: type === 'essay' ? undefined : correctAnswer,
      points: pts,
      createdBy: (req as any).user?._id,
    });
    await q.save();
    res.status(201).json(q);
  } catch (err) {
    next(err);
  }
};

export const getQuestionsForCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id;
    const questions = await Question.find({ course: courseId }).exec();
    res.json(questions);
  } catch (err) {
    next(err);
  }
};

// Course materials
export const listCourseMaterials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (!canStudentAccessCourse(user, course)) return res.status(403).json({ error: 'Forbidden' });

    const materials = Array.isArray((course as any).materials) ? (course as any).materials : [];
    res.json(
      materials.map((m: any) => ({
        id: String(m._id),
        title: m.title,
        kind: m.kind,
        originalName: m.originalName,
        mimetype: m.mimetype,
        size: m.size,
        uploadedAt: m.uploadedAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};

export const uploadCourseMaterial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!canProfessorManageCourse(user, course)) return res.status(403).json({ error: 'Forbidden' });

    const f = (req as any).file as Express.Multer.File | undefined;
    if (!f) return res.status(400).json({ error: 'file is required' });

    const title = String((req.body as any)?.title ?? '').trim() || f.originalname;
    const kindRaw = String((req.body as any)?.kind ?? '').trim().toLowerCase();
    const kind = (['lecture', 'lab', 'video', 'other'] as const).includes(kindRaw as any)
      ? (kindRaw as any)
      : f.mimetype.startsWith('video/')
        ? 'video'
        : 'other';

    const storagePath = f.path; // absolute path inside container

    ;(course as any).materials = Array.isArray((course as any).materials) ? (course as any).materials : [];
    ;(course as any).materials.push({
      title,
      kind,
      filename: f.filename,
      originalName: f.originalname,
      storagePath,
      mimetype: f.mimetype,
      size: f.size,
      uploadedAt: new Date(),
      uploadedBy: user?._id,
    });

    await course.save();

    const added = (course as any).materials[(course as any).materials.length - 1];
    res.status(201).json({
      id: String(added._id),
      title: added.title,
      kind: added.kind,
      originalName: added.originalName,
      mimetype: added.mimetype,
      size: added.size,
      uploadedAt: added.uploadedAt,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteCourseMaterial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!canProfessorManageCourse(user, course)) return res.status(403).json({ error: 'Forbidden' });

    const materials = Array.isArray((course as any).materials) ? (course as any).materials : [];
    const idx = materials.findIndex((m: any) => String(m._id) === String(req.params.materialId));
    if (idx < 0) return res.status(404).json({ error: 'Material not found' });

    const m = materials[idx];
    const storagePath = String(m.storagePath ?? '');
    materials.splice(idx, 1);
    ;(course as any).materials = materials;
    await course.save();

    if (storagePath) {
      try {
        fs.unlinkSync(storagePath);
      } catch {
        // ignore
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const downloadCourseMaterial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const course = await Course.findById(req.params.id).exec();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!canStudentAccessCourse(user, course)) return res.status(403).json({ error: 'Forbidden' });

    const materials = Array.isArray((course as any).materials) ? (course as any).materials : [];
    const m = materials.find((x: any) => String(x._id) === String(req.params.materialId));
    if (!m) return res.status(404).json({ error: 'Material not found' });

    const storagePath = String(m.storagePath ?? '');
    if (!storagePath) return res.status(404).json({ error: 'File not found' });

    const stat = await fs.promises.stat(storagePath).catch(() => null as any);
    if (!stat) return res.status(404).json({ error: 'File not found' });

    const mimetype = String(m.mimetype ?? 'application/octet-stream');
    const isVideo = mimetype.startsWith('video/');
    const range = String(req.headers.range ?? '');

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(String(m.originalName ?? 'material'))}"`);

    if (isVideo && range.startsWith('bytes=')) {
      const total = stat.size;
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      const start = Math.max(0, parseInt(startStr || '0', 10));
      const end = endStr ? Math.min(total - 1, parseInt(endStr, 10)) : Math.min(total - 1, start + 1024 * 1024);

      res.status(206);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(end - start + 1));

      fs.createReadStream(storagePath, { start, end }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(storagePath).pipe(res);
  } catch (err) {
    next(err);
  }
};
