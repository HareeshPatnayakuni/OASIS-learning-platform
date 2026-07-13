import type { Metadata } from 'next';
import { apiRequest, apiRequestPaginated } from '@/lib/api-client';
import { CourseFilterBar } from '@/components/course/CourseFilterBar';
import { CourseCard } from '@/components/course/CourseCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import type { CatalogRef, ClassGrade, CourseListItem } from '@/types/api';

export const metadata: Metadata = {
  title: 'Browse Courses',
  description: 'Browse CBSE, ICSE, and State Board courses for Classes 4–10 on OASIS.',
};

interface CoursesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.boardId) query.set('boardId', params.boardId);
  if (params.classGradeId) query.set('classGradeId', params.classGradeId);
  if (params.subjectId) query.set('subjectId', params.subjectId);
  if (params.q) query.set('q', params.q);
  query.set('page', params.page ?? '1');
  query.set('limit', '20');

  let boards: CatalogRef[] = [];
  let classGrades: ClassGrade[] = [];
  let subjects: CatalogRef[] = [];
  let courses: CourseListItem[] = [];
  let total = 0;
  let loadError: string | null = null;

  try {
    const [boardsRes, classGradesRes, subjectsRes, coursesRes] = await Promise.all([
      apiRequest<CatalogRef[]>('/boards'),
      apiRequest<ClassGrade[]>('/class-grades'),
      apiRequest<CatalogRef[]>('/subjects'),
      apiRequestPaginated<CourseListItem>(`/courses?${query.toString()}`),
    ]);
    boards = boardsRes;
    classGrades = classGradesRes;
    subjects = subjectsRes;
    courses = coursesRes.data;
    total = coursesRes.meta.total;
  } catch {
    loadError = "Couldn't load courses right now.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Browse Courses</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {loadError ? '' : `${total} course${total === 1 ? '' : 's'} available`}
      </p>

      <div className="mb-6">
        <CourseFilterBar boards={boards} classGrades={classGrades} subjects={subjects} />
      </div>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses match your filters"
          description="Try a different Board, Class, Subject, or search term."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </main>
  );
}
