import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiRequest, ApiClientError } from '@/lib/api-client';
import { CourseDetailClient } from './CourseDetailClient';
import type { CourseDetail } from '@/types/api';

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

async function fetchCourse(slug: string): Promise<CourseDetail | null> {
  try {
    return await apiRequest<CourseDetail>(`/courses/${slug}`);
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await fetchCourse(slug);
  if (!course) return { title: 'Course not found' };
  return {
    title: course.title,
    description: course.description,
    openGraph: {
      title: course.title,
      description: course.description,
      images: course.thumbnailUrl ? [course.thumbnailUrl] : undefined,
    },
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = await fetchCourse(slug);
  if (!course) notFound();

  return <CourseDetailClient initialCourse={course} />;
}
