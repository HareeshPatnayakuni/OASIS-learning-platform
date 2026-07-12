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
    tags: [{ name: 'Auth', description: 'Registration, login, tokens, password/email verification' }],
  },
  apis: [path.join(__dirname, '../modules/**/*.routes.ts'), path.join(__dirname, '../modules/**/*.routes.js')],
};

export const openapiSpec = swaggerJsdoc(options);
