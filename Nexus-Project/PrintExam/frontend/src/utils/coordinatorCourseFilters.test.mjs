import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCoordinatorCourses, filterCoordinatorSchedules } from './coordinatorCourseFilters.ts';

const courses = [
  { id: 1, course_code: 'CPE101', course_name: 'Programming', instructor_id: 10, instructor_name: 'Somchai', semester: 1, academic_year: '2569' },
  { id: 2, course_code: 'ENG201', course_name: 'English', instructor_id: 20, instructor_name: 'Anong', semester: 2, academic_year: '2569' },
  { id: 3, course_code: 'SUM301', course_name: 'Summer Lab', instructor_id: 10, instructor_name: 'Somchai', semester: 3, academic_year: '2568' },
];

const schedules = courses.map((course, index) => ({
  id: index + 1,
  course_id: course.id,
  course_code: course.course_code,
  course_name: course.course_name,
  instructor_id: course.instructor_id,
  instructor_name: course.instructor_name,
  exam_type: 'FINAL',
  exam_date: '2026-10-19',
  start_time: '09:00',
  end_time: '12:00',
  room: 'QA-ROOM',
  deadline_date: '2026-10-17',
  status: 'SCHEDULED',
}));

const filters = (overrides = {}) => ({ search: '', instructorId: '', semester: 'all', academicYear: 'all', ...overrides });
const courseIds = (result) => result.map(({ id }) => id);

test('course filters support all, each semester, and data-derived academic year', () => {
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, filters())), [1, 2, 3]);
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, filters({ semester: '1' }))), [1]);
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, filters({ semester: '2' }))), [2]);
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, filters({ semester: '3' }))), [3]);
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, filters({ academicYear: '2569' }))), [1, 2]);
});

test('semester, year, instructor, and search compose as an AND intersection', () => {
  const semesterAndYear = filters({ semester: '1', academicYear: '2569' });
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, semesterAndYear)), [1]);
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, semesterAndYear)), [1]);

  const selected = filters({ semester: '1', academicYear: '2569', instructorId: '10', search: 'CPE' });
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, selected)), [1]);
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, selected)), [1]);
  assert.deepEqual(courseIds(filterCoordinatorCourses(courses, filters({ semester: '2', academicYear: '2568' }))), []);
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, filters({ semester: '2', academicYear: '2568' }))), []);
});

test('schedule filters join canonical course semester/year and keep search/instructor intersections', () => {
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, filters())), [1, 2, 3]);
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, filters({ semester: '3' }))), [3]);
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, filters({ academicYear: '2569' }))), [1, 2]);
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, filters({ instructorId: '10' }))), [1, 3]);
  assert.deepEqual(courseIds(filterCoordinatorSchedules(schedules, courses, filters({ instructorId: '20', search: 'ENG' }))), [2]);
});
