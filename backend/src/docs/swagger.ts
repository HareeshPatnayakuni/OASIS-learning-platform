import swaggerJsdoc from 'swagger-jsdoc';
import path from 'node:path';

/**
 * Per docs/04-api-design.md §1: "every route is annotated and compiled into
 * OpenAPI/Swagger at /api/v1/docs." This scans every `*.routes.ts` file
 * under src/modules for `@openapi` JSDoc blocks (see auth.routes.ts for the
 * pattern) and assembles them into one spec — new modules are picked up
 * automatically as long as they follow the same annotation convention.
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'OASIS API',
      version: '1.0.0',
      description:
        'Online Academy for Smart Integrated Studies — backend REST API. ' +
        'See docs/04-api-design.md in the project repository for full conventions.',
    },
    servers: [{ url: '/api/v1', description: 'Current server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'System', description: 'Health checks and operational endpoints' },
      { name: 'Auth', description: 'Registration, login, tokens, password/email verification' },
      { name: 'Catalog', description: 'Boards, Class Grades, Subjects — filter options for Browse Courses' },
      { name: 'Courses', description: 'Browse/view course details (public) and create/edit/publish courses (Teacher)' },
      { name: 'Content', description: 'Signed video/note URLs and lecture progress — enrollment-gated (Student)' },
      {
        name: 'Content Management',
        description: 'Create/edit/delete/reorder chapters, modules, lectures, and notes (Teacher)',
      },
      { name: 'Quizzes', description: 'Create/edit/delete quizzes with questions and options (Teacher)' },
      {
        name: 'Announcements',
        description: 'Post/edit/delete course announcements, with student notification fan-out (Teacher)',
      },
      { name: 'Media', description: 'Signed image upload URLs for course thumbnails, etc. (Teacher, Admin)' },
      {
        name: 'Admin',
        description:
          'Admin Dashboard, teacher/student account management, read-only course oversight, ' +
          'platform-wide announcements, and platform settings (Admin/Super Admin only)',
      },
      { name: 'Enrollments', description: "A student's own enrolled courses and computed progress" },
      {
        name: 'Payments',
        description:
          'Course purchase (free-instant-enroll or Razorpay checkout) and server-side payment verification (Student only)',
      },
      { name: 'Users', description: 'Profile, Learning Streak, Continue Watching, Announcements' },
      { name: 'Search', description: 'Search across courses, chapters, and modules' },
    ],
  },
  apis: [path.join(__dirname, '../modules/**/*.routes.ts'), path.join(__dirname, '../modules/**/*.routes.js')],
};

export const openapiSpec = swaggerJsdoc(options);
