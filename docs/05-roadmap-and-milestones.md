# Development Roadmap & Milestone Plan
## OASIS V1 — Module 1 Deliverable (v1.1 — post-refinement)

Each module below ends with the same checklist from the project brief:
design decisions explained, assumptions and trade-offs called out, docs
updated, and **your explicit approval before the next module starts.**
Nothing is built out of order.

> **Revision note:** the module boundaries are unchanged from v1.0; what's
> updated is *which* deliverables land in which module, now that Boards,
> Media, Notifications, Testimonials, Enquiries, and Settings exist as
> first-class pieces of the design.

---

## Module-by-Module Plan

| Module | Name | Deliverable | Depends on |
|---|---|---|---|
| **1** | Planning & Architecture | *This set of documents* — SRS, architecture, DB design, API design, roadmap, deployment strategy | — |
| **2** | Repo Scaffolding & Auth | Monorepo initialized, Prisma migrated against a real Postgres (including `Board`/seed data), `/auth` endpoints, device-limit enforcement, RBAC middleware, request-ID + structured logging middleware wired in from day one | Module 1 approved |
| **3** | Catalog & Content Management (Backend) | Board/Class/Subject CRUD, Course/Chapter/Module/Lecture/Note/Quiz CRUD with slugs and status fields, private-bucket signed-URL issuance, ownership checks | Module 2 |
| **4** | Media Module (Backend) **[NEW]** | Public-bucket image upload endpoint, `Media` model wiring for course thumbnails / avatars, validation (size/type/dimensions) | Module 3 |
| **5** | Teacher Dashboard (Frontend) | Teacher UI to author courses/chapters/modules, upload lectures/notes/thumbnails, set lecture status, create quizzes, post announcements, schedule live classes | Module 4 |
| **6** | Student Experience (Frontend + Backend) | Public course browse/detail pages (using Board/Class/Subject filters and slugs), student dashboard, video player with resume, note downloads, quiz-taking UI, progress + streak display, in-app Notifications list | Module 4 |
| **7** | Payments | Razorpay order creation, checkout integration, signature verification, webhook handling, invoice generation, payment history UI, payment-success Notification | Module 6 |
| **8** | Public Site Content: Testimonials, Enquiries, Settings **[NEW]** | Contact Us form → `Enquiry` intake, public Testimonials section, Admin management UI for both, `AcademySettings` read (public footer/contact) + Admin edit UI | Module 6 |
| **9** | Admin Dashboard | Student/Teacher management, course moderation, payment records, Enquiry triage, Testimonial curation, Settings editor, basic analytics dashboard | Module 7, Module 8 |
| **10** | Search & SEO | Search endpoint + UI, sitemap.xml, robots.txt, per-page metadata/Open Graph/structured data (now using Course/Chapter slugs and Media public URLs directly) | Module 6 |
| **11** | Security Hardening & Testing | Rate limiting tuned (Enquiry submission gets stricter limits — public + unauthenticated), Helmet review, unit + integration test coverage, load-test the ~100-concurrent-student scenario | Module 9 |
| **12** | Deployment & Launch | Production Docker build, environment setup (including the second, public R2 bucket for Media), Vercel production deploy, DNS/TLS, backups configured, smoke test, go-live | Module 11 |

**Estimated effort** (elapsed calendar time, planning estimate not a
contractual timeline): Module 2 ≈ 1–2 weeks; Modules 3–4 ≈ 1–2 weeks
combined (Media is a small module riding on Course/Content's upload
plumbing); Modules 5–10 ≈ 1–2 weeks each depending on UI complexity;
Modules 11–12 ≈ 1–2 weeks combined.

---

## Milestone Exit Criteria

Unchanged from v1.0:

1. All functional requirements a module claims to satisfy (traceable to
   `docs/01-srs-and-requirements.md`) are implemented and manually verified.
2. Relevant unit/integration tests pass.
3. No contradiction with a decision recorded in an earlier module's docs —
   and if one is needed, it's called out explicitly and this documentation
   set is updated, never silently overridden.
4. You've reviewed and approved before the next module begins.

---

## Suggested Launch-Readiness Checklist (Module 12 gate)

- [ ] All V1 functional requirements implemented and smoke-tested
- [ ] Payments tested in Razorpay test mode, then a real small live transaction
- [ ] Backups verified with an actual restore drill
- [ ] Privacy Policy / Terms & Conditions / Refund Policy pages published
- [ ] Both R2 buckets (private video/notes, public media) confirmed
      correctly scoped — private bucket has no public-read access at the
      infra level, not just the application level
- [ ] Rate limiting and Helmet headers confirmed in production
- [ ] Structured logs reaching a place you'll actually look at, with
      sensitive-field redaction verified
- [ ] Sitemap submitted to Google Search Console
- [ ] Contact Us submissions route to an Admin who'll actually check them
