import Course from '../models/Course';

export async function loadCourseOr404(courseId: string) {
  const course = await Course.findById(courseId).exec();
  return course;
}

export function canProfessorManageCourse(user: any, course: any): boolean {
  const role = String(user?.role ?? '').toLowerCase();
  if (role === 'admin') return true;
  if (role !== 'professor') return false;

  const uid = String(user?._id ?? '');
  if (!uid) return false;

  // New model: assigned professors.
  if (Array.isArray(course?.professors) && course.professors.length > 0) {
    return course.professors.some((p: any) => String(p) === uid) || String(course?.createdBy ?? '') === uid;
  }

  // Backward compatibility:
  // - If createdBy exists, restrict to owner professor.
  // - Legacy courses without createdBy: allow professor.
  if (course?.createdBy) return String(course.createdBy) === uid;
  return true;
}

export function canStudentAccessCourse(user: any, course: any): boolean {
  const role = String(user?.role ?? '').toLowerCase();
  if (role === 'admin' || role === 'professor') return true;
  if (role !== 'student') return false;

  const uid = String(user?._id ?? '');
  return Array.isArray(course?.students) && course.students.some((s: any) => String(s) === uid);
}
