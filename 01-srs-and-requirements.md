# Software Requirements Specification (SRS)
## OASIS — Online Academy for Smart Integrated Studies
Version 1.1 · Module 1 Deliverable (post-refinement)

> **Revision note:** this version incorporates 13 refinements you requested
> after reviewing v1.0 — multi-board support, course/lecture status, slugs,
> soft deletes, a media strategy, Notifications, Enquiries, Testimonials,
> Settings, an explicit backend-only-business-logic invariant, and expanded
> observability. Nothing from v1.0 was contradicted; this is additive and
> clarifying. See `docs/02-architecture.md` and `docs/03-database-design.md`
> for the design rationale behind each change.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for
Version 1.0 (MVP) of OASIS, a public-facing online coaching platform for
school students in Classes 4–10. It is the reference all later modules must
remain consistent with.

### 1.2 Scope
OASIS V1 lets:
- **Students** discover, purchase, and consume video courses with notes and
  quizzes, track their progress, receive notifications, and join
  teacher-scheduled live classes hosted on Zoom/Google Meet.
- **Teachers** author course content (chapters → modules → lectures/notes/quizzes),
  post announcements, and schedule live classes.
- **Admins / Super Admins** manage users, courses, payments, testimonials,
  contact-form enquiries, academy-wide settings, and view basic business
  analytics.
- **Prospective students/parents** browse the public site, read testimonials,
  and submit a Contact Us enquiry — without creating an account.

The system must comfortably serve ~100 concurrent active students at launch,
and scale to several thousand without a re-architecture.

### 1.3 Definitions & Acronyms
| Term | Meaning |
|---|---|
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| R2 | Cloudflare R2 object storage |
| MVP | Minimum Viable Product |
| SRS | Software Requirements Specification |
| Signed URL | Time-limited, tamper-proof URL granting temporary access to a private object |
| Board | Curriculum body — e.g. CBSE, ICSE, or a specific State Board |
| Soft delete | Marking a record as removed (`deletedAt` timestamp) without physically deleting it |

### 1.4 Intended Audience
Unchanged — this document is written for the engineering team building OASIS
and doubles as onboarding material for any future engineer joining the project.

---

## 2. Overall Description

### 2.1 Product Perspective
Unchanged: OASIS is a decoupled frontend (Next.js, on Vercel) talking to a
versioned REST API (Express, Dockerized) over HTTPS. **This revision adds an
explicit, non-negotiable constraint** (§6.11) that all business logic —
without exception — lives in that backend API, precisely so the same
contract remains reusable, unmodified, by future Android/iOS apps.

### 2.2 User Classes and Characteristics
Unchanged: Super Admin, Admin, Teacher, Student — plus an implicit
"anonymous visitor" class for public browsing and Contact Us submissions,
which was always assumed but is now made explicit given the new Enquiry
feature (§3.9).

### 2.3–2.5
Unchanged from v1.0.

---

## 3. Functional Requirements

Requirements are written as **FR-<area>-<n>: The system shall …** statements.
New or materially changed requirements in this revision are marked **[NEW]**
or **[REVISED]**.

### 3.1 Authentication & Account Management
- **FR-AUTH-1** through **FR-AUTH-7**: unchanged from v1.0.
- **FR-AUTH-8 [NEW]:** Account deactivation/deletion requests shall soft-delete
  the `User` record (`deletedAt` set) rather than physically removing it, so
  that historical payments, enrollments, and quiz attempts remain intact and
  auditable.

### 3.2 Catalog & Course Organization **[REVISED]**
- **FR-CAT-1 [NEW]:** The system shall represent curriculum Boards (CBSE,
  ICSE, and one or more specific State Boards) as manageable catalog entries,
  not a fixed, closed list — an Admin shall be able to add a new Board (e.g.,
  a specific state board) without a code change.
- **FR-CAT-2 [REVISED]:** Course organization shall follow the hierarchy
  **Board → Class → Subject → Chapter → Module**, with a Course as the
  sellable unit at the Board+Class+Subject intersection.
- **FR-CAT-3:** Classes (4–10) and Subjects remain shared/global catalog
  entries, addable by an Admin without a code change (unchanged from v1.0).
- **FR-CAT-4 [NEW]:** Courses and Chapters shall have SEO-friendly, unique
  slugs suitable for public URLs (Chapter slugs unique within their parent
  course, Course slugs unique platform-wide).

### 3.3 Content Status & Lifecycle **[NEW SECTION]**
- **FR-STAT-1 [NEW]:** A Course shall have a status of `DRAFT`, `PUBLISHED`,
  or `ARCHIVED`, controlling whether it is visible/purchasable.
- **FR-STAT-2 [NEW]:** A Lecture shall have an independent status of `DRAFT`,
  `PUBLISHED`, or `HIDDEN`, so an individual lecture can be held back or
  pulled without affecting its parent course's own status or other students'
  access to the rest of the course.
- **FR-STAT-3 [NEW]:** Deleting a course, chapter, module, lecture, note,
  quiz, announcement, live class, testimonial, or user account shall be a
  **soft delete** (record retained, hidden from normal listings) rather than
  permanent removal, except for financial/audit records (Payments,
  Enrollments, Quiz Attempts, Lecture Progress), which are never deleted, and
  Enquiries, which use a status workflow instead of deletion.

### 3.4 Student Features
- **FR-STU-1** through **FR-STU-13**: unchanged from v1.0.
- **FR-STU-14 [NEW]:** A student shall receive an in-app notification when a
  new announcement is posted to a course they're enrolled in.
- **FR-STU-15 [NEW]:** A student shall be able to view and mark their
  notifications as read.

### 3.5 Teacher Features
- **FR-TCH-1** through **FR-TCH-8**: unchanged from v1.0.
- **FR-TCH-9 [NEW]:** A teacher shall be able to upload a course thumbnail
  image and their own profile photo.
- **FR-TCH-10 [NEW]:** A teacher shall be able to set a lecture's status to
  Draft, Published, or Hidden independent of the parent course's status.

### 3.6 Admin / Super Admin Features
- **FR-ADM-1** through **FR-ADM-6**: unchanged from v1.0.
- **FR-ADM-7 [NEW]:** An Admin shall be able to add/manage curriculum Boards,
  in addition to existing Class and Subject management.
- **FR-ADM-8 [NEW]:** An Admin shall be able to create, edit, publish/unpublish,
  reorder, and soft-delete Testimonials shown on the public site, including
  an optional photo and a "featured" flag.
- **FR-ADM-9 [NEW]:** An Admin shall be able to view submitted Contact Us
  Enquiries, update their status (New / In Progress / Resolved / Spam), and
  record who handled each one.
- **FR-ADM-10 [NEW]:** An Admin shall be able to view and update academy-wide
  settings: academy name, tagline, logo, contact email/phone, address, social
  media links, and default SEO title/description.
- **FR-ADM-11 [NEW]:** Academy Settings shall never be used to store secrets
  (payment keys, JWT secrets, storage credentials); those remain environment
  variables, since Settings are served through a public, unauthenticated
  read endpoint.

### 3.7 Payments
Unchanged from v1.0 (FR-PAY-1 through FR-PAY-5).

### 3.8 Search
Unchanged from v1.0 (FR-SRCH-1).

### 3.9 Public Contact & Trust Content **[NEW SECTION]**
- **FR-CONTACT-1 [NEW]:** Any visitor shall be able to submit a Contact Us
  enquiry (name, email, optional phone, optional subject, message) without
  creating an account.
- **FR-CONTACT-2 [NEW]:** The system shall not expose one visitor's enquiry
  to another; enquiries are visible only to Admin+.
- **FR-TESTI-1 [NEW]:** The public Testimonials section shall display only
  testimonials an Admin has marked `isPublished`, ordered by an
  Admin-controlled display order, with featured testimonials able to surface
  prominently (e.g., on the Home page).

### 3.10 Media Handling **[NEW SECTION]**
- **FR-MEDIA-1 [NEW]:** The system shall support uploading images for course
  thumbnails, teacher/user avatars, the academy logo, and testimonial photos,
  distinct from the existing private video/PDF upload path.
- **FR-MEDIA-2 [NEW]:** Uploaded images shall be served via a public,
  long-lived URL suitable for direct embedding in pages, Open Graph tags, and
  the sitemap — unlike lecture videos and notes, which remain access-gated
  behind short-lived signed URLs.

### 3.11 SEO
- **FR-SEO-1, FR-SEO-2**: unchanged from v1.0, now reinforced by Course/Chapter
  slugs (§3.2) and directly embeddable Media URLs (§3.10) rather than
  hindered by them.

---

## 4. Non-Functional Requirements

### 4.1 Performance
Unchanged from v1.0 (NFR-PERF-1 through NFR-PERF-3).

### 4.2 Scalability
Unchanged from v1.0 (NFR-SCALE-1, NFR-SCALE-2).

### 4.3 Security
- **NFR-SEC-1** through **NFR-SEC-9**: unchanged from v1.0.
- **NFR-SEC-10 [NEW]:** The public image-serving bucket (Media) and the
  private video/notes bucket shall use separate credentials at the
  infrastructure level, not merely separate application logic, so a
  misconfiguration in one cannot expose the other.
- **NFR-SEC-11 [NEW]:** Academy Settings, being publicly readable, shall be
  schema-constrained (typed columns) so it is structurally impossible to
  accidentally store a secret there (see FR-ADM-11).

### 4.4 Reliability & Availability
Unchanged from v1.0 (NFR-AVAIL-1 through NFR-AVAIL-3).

### 4.5 Maintainability
- **NFR-MAINT-1** through **NFR-MAINT-3**: unchanged from v1.0.
- **NFR-MAINT-4 [NEW]:** All business logic (RBAC, payment verification,
  course unlock, quiz scoring, signed-URL issuance, device-limit enforcement,
  notification generation) shall reside exclusively in the backend API. The
  frontend (and any future mobile client) shall contain no independent
  implementation of these rules — see `docs/02-architecture.md §10`.
- **NFR-MAINT-5 [NEW]:** Soft-deleted records shall be excluded from default
  queries via a consistent repository-layer convention, not handled ad hoc
  per feature.

### 4.6 Usability
Unchanged from v1.0 (NFR-UX-1, NFR-UX-2).

### 4.7 Compliance & Data Handling
Unchanged from v1.0 (NFR-COMP-1 through NFR-COMP-3), with soft-delete (§3.3)
now the concrete mechanism satisfying NFR-COMP-3's account-deletion-request
support.

### 4.8 Portability
- **NFR-PORT-1**: unchanged from v1.0.
- **NFR-PORT-2 [NEW]:** Because all business logic lives in the backend
  (NFR-MAINT-4), a future native Android/iOS app is a pure API consumer,
  requiring zero backend changes to onboard — this is treated as a hard
  architectural constraint, not an aspiration.

### 4.9 Observability **[NEW SECTION]**
- **NFR-OBS-1 [NEW]:** The backend shall emit structured (JSON) logs to
  stdout, with a correlation ID per request, so that production issues can
  be traced without redeploying instrumentation.
- **NFR-OBS-2 [NEW]:** Sensitive fields (passwords, tokens, payment
  signatures, storage credentials) shall never appear in logs, enforced via
  redaction configuration, not developer discipline alone.
- **NFR-OBS-3 [NEW]:** The logging approach shall be structured so that
  adding external monitoring (error tracking, log aggregation, metrics) later
  requires no application code changes — only pointing a log shipper at
  stdout. See `docs/02-architecture.md §11`.

---

## 5. Out of Scope for V1 (explicit, unchanged)

Parent Dashboard, native Android/iOS apps, AI Tutor/Doubt Solver, built-in
live video conferencing, discussion forum, real-time chat, and advanced
analytics remain out of scope, per v1.0. Extension points for each are
documented in `docs/02-architecture.md §9`.

---

## 6. Traceability Note

Unchanged principle: every functional requirement maps to at least one
entity in `database/schema.prisma` and at least one endpoint group in
`docs/04-api-design.md`. The new requirements in this revision map to the
new `Board`, `Media`, `Notification`, `Testimonial`, `Enquiry`, and
`AcademySettings` models, and to the new `boards`, `media`, `notifications`,
`testimonials`, `enquiries`, and `settings` endpoint groups.
