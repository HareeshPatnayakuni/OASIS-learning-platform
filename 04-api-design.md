# API Design
## OASIS V1 — Module 1 Deliverable (v1.1 — post-refinement)

---

## 1. Conventions

Unchanged from v1.0:
- **Base path:** `/api/v1`
- **Format:** JSON in, JSON out.
- **Auth:** `Authorization: Bearer <accessToken>` (JWT) on protected routes.
- **Pagination:** `?page=1&limit=20` → `{ "data": [...], "meta": { "page", "limit", "total" } }`.
- **Errors:** `{ "error": { "code": "...", "message": "..." } }`.
- **Idempotency:** payment verification and webhook endpoints are idempotent.
- **Docs:** every route is annotated and compiled into OpenAPI/Swagger at `/api/v1/docs`.

One addition: **soft-deleted resources never appear in list/get responses**
by default across every resource group below — a 404, not a 200 with a
"deleted" flag, is returned for a soft-deleted item requested by ID, unless
the caller is Admin+ and explicitly requests `?includeDeleted=true` (used
for recovery tooling only).

---

## 2. Resource Groups

### 2.1 Auth — `/api/v1/auth`
Unchanged from v1.0: `/register`, `/login`, `/refresh`, `/logout`,
`/logout-all`, `/forgot-password`, `/reset-password`.

### 2.2 Users — `/api/v1/users`
Unchanged from v1.0: `/me`, `/me/devices`, admin user management,
teacher/admin provisioning.

### 2.3 Catalog — `/api/v1/boards`, `/api/v1/class-grades`, `/api/v1/subjects` **[REVISED]**
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/boards` | Public | List Boards (CBSE, ICSE, specific State Boards, ...) **[NEW]** |
| POST | `/boards` | Admin+ | Add a new Board **[NEW]** |
| PATCH/DELETE | `/boards/:id` | Admin+ | Edit / soft-delete a Board **[NEW]** |
| GET | `/class-grades` | Public | List Classes 4–10 |
| GET | `/subjects` | Public | List subjects |
| POST | `/subjects` | Admin+ | Add a new subject |

### 2.4 Courses — `/api/v1/courses`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | Browse published courses; filters: `boardId`, `classGradeId`, `subjectId`, `q` **[boardId replaces the old `board` enum filter]** |
| GET | `/:slug` | Public | Course detail (syllabus, teacher, price, thumbnail) |
| POST | `/` | Teacher | Create a course (starts `DRAFT`) |
| PATCH | `/:id` | Teacher (own) / Admin+ | Edit course, including `thumbnailId` |
| PATCH | `/:id/status` | Teacher (own) / Admin+ | Publish / archive / unpublish (`CourseStatus`) |
| DELETE | `/:id` | Admin+ | Soft-delete **[REVISED — was a hard delete in v1.0]** |

### 2.5 Content — `/api/v1/courses/:courseId/chapters`, `.../modules`, `.../lectures`, `.../notes`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/courses/:courseId/chapters` | Enrolled student / Owning teacher / Admin+ | Full nested syllabus |
| POST | `/courses/:courseId/chapters` | Teacher (own) | Create chapter; requires a `slug` unique within the course **[NEW field]** |
| PATCH/DELETE | `/chapters/:id` | Teacher (own) | Edit / soft-delete chapter **[REVISED]** |
| POST | `/chapters/:id/modules` | Teacher (own) | Create module |
| POST | `/modules/:id/lectures` | Teacher (own) | Upload lecture (R2 private-bucket upload target, then confirm) |
| PATCH | `/lectures/:id/status` | Teacher (own) | Set `LectureStatus`: Draft / Published / Hidden **[NEW]** |
| POST | `/modules/:id/notes` | Teacher (own) | Upload note PDF |
| GET | `/lectures/:id/stream-url` | Enrolled student | Issue short-lived signed URL (private bucket) |
| GET | `/notes/:id/download-url` | Enrolled student | Issue short-lived signed URL (private bucket) |
| PUT | `/lectures/:id/progress` | Enrolled student | Update last watched position / completion |

### 2.6 Quizzes — `/api/v1/quizzes`
Unchanged from v1.0.

### 2.7 Enrollments & Payments — `/api/v1/payments`, `/api/v1/enrollments`
Unchanged from v1.0.

### 2.8 Announcements & Notifications — `/api/v1/announcements`, `/api/v1/notifications` **[REVISED / NEW]**
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/courses/:courseId/announcements` | Enrolled student / Owning teacher / Admin+ | List |
| POST | `/courses/:courseId/announcements` | Teacher (own) / Admin+ | Create — triggers Notification fan-out to enrolled students |
| DELETE | `/announcements/:id` | Author / Admin+ | Soft-delete **[REVISED]** |
| GET | `/notifications/me` | Any authenticated | List own notifications, paginated **[NEW]** |
| PATCH | `/notifications/:id/read` | Any authenticated (own) | Mark a notification read **[NEW]** |
| PATCH | `/notifications/read-all` | Any authenticated | Mark all own notifications read **[NEW]** |

### 2.9 Live Classes — `/api/v1/live-classes`
Unchanged from v1.0, except deletion is now a soft delete.

### 2.10 Media — `/api/v1/media` **[NEW]**
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/media` | Teacher / Admin+ (Student: own avatar only) | Upload an image (course thumbnail, avatar, testimonial photo, logo); returns `{ id, publicUrl }` |
| DELETE | `/media/:id` | Owner / Admin+ | Soft-delete an image |

This is a distinct upload path from lecture/note uploads — it writes to the
**public** R2 bucket and returns an immediately usable public URL, rather
than issuing a signed URL. See `docs/02-architecture.md §8`.

### 2.11 Testimonials — `/api/v1/testimonials` **[NEW]**
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/testimonials` | Public | List published testimonials, ordered by `displayOrder` |
| GET | `/testimonials/featured` | Public | List only `isFeatured` testimonials (for the Home page) |
| POST | `/testimonials` | Admin+ | Create |
| PATCH | `/testimonials/:id` | Admin+ | Edit (text, photo, rating, featured flag, order, publish state) |
| DELETE | `/testimonials/:id` | Admin+ | Soft-delete |

### 2.12 Enquiries (Contact Us) — `/api/v1/enquiries` **[NEW]**
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/enquiries` | Public | Submit a Contact Us message |
| GET | `/enquiries` | Admin+ | List, filterable by `status` |
| PATCH | `/enquiries/:id/status` | Admin+ | Update status (`NEW/IN_PROGRESS/RESOLVED/SPAM`), records `respondedById`/`respondedAt` |

Rate-limited more aggressively than most public endpoints, given it's an
unauthenticated write endpoint and a natural spam target.

### 2.13 Academy Settings — `/api/v1/settings` **[NEW]**
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/settings` | Public | Read academy branding/contact info (name, logo, contact, social links, default SEO meta) — no secrets ever returned, because none are stored here |
| PATCH | `/settings` | Admin+ | Update the single settings row |

### 2.14 Admin Dashboard — `/api/v1/admin`
Unchanged from v1.0.

### 2.15 Search — `/api/v1/search`
Unchanged from v1.0.

---

## 3. Why this shape (updated)

- **Board is now a resource, not a fixed filter value** — `GET /boards`
  exists precisely so the frontend never hardcodes "CBSE/ICSE/State," and a
  new board added by an Admin shows up in filters automatically.
- **Media has its own endpoint group** rather than being bolted onto
  `courses`/`users`, because the same upload path is reused across four
  different consuming entities (Course, User, Testimonial, AcademySettings) —
  one endpoint, one place to enforce image-specific validation (size,
  dimensions, MIME type).
- **Notifications are read-only from the client's perspective** — nothing
  creates a notification directly via the API; they're always a side effect
  of another action (posting an announcement, a payment succeeding, etc.),
  keeping the "no client-side business logic" invariant intact (per
  `docs/02-architecture.md §10`) — a mobile app can't spoof a notification
  because it never has a create endpoint to call.
- **Settings is public-GET, Admin-PATCH** — deliberately shaped so the
  frontend can render dynamic branding without auth, while guaranteeing
  (by what's stored, not just by permission) that nothing sensitive is ever
  exposed there.
- **Soft delete changes the meaning of `DELETE`** across every resource
  that supports it: it's now "hide and allow recovery," not "destroy."
  Where that distinction matters operationally, an Admin-only
  `includeDeleted=true` query param (§1) provides the recovery path, rather
  than a separate `/restore` endpoint per resource.
