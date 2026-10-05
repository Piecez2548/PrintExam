import type { Course, ExamSchedule } from '../types';

export interface CoordinatorCourseFilters {
  search: string;
  instructorId: string;
  semester: string;
  academicYear: string;
}

const matchesSearch = (values: Array<string | undefined>, search: string): boolean =>
  !search || values.some((value) => value?.toLowerCase().includes(search.toLowerCase()));

const matchesCourseDimensions = (course: Course | undefined, filters: CoordinatorCourseFilters): boolean => {
  if (filters.instructorId && course?.instructor_id.toString() !== filters.instructorId) return false;
  if (filters.semester !== 'all' && course?.semester.toString() !== filters.semester) return false;
  if (filters.academicYear !== 'all' && course?.academic_year !== filters.academicYear) return false;
  return true;
};

export function filterCoordinatorCourses(courses: Course[], filters: CoordinatorCourseFilters): Course[] {
  return courses.filter((course) =>
    matchesCourseDimensions(course, filters) &&
    matchesSearch([course.course_code, course.course_name, course.instructor_name], filters.search),
  );
}

export function filterCoordinatorSchedules(
  schedules: ExamSchedule[],
  courses: Course[],
  filters: CoordinatorCourseFilters,
): ExamSchedule[] {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  return schedules.filter((schedule) => {
    const course = courseById.get(schedule.course_id);
    return matchesCourseDimensions(course, filters) &&
      matchesSearch([schedule.course_code, schedule.course_name, schedule.instructor_name], filters.search);
  });
}
