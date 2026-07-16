# OASIS Frontend

Next.js (App Router) + TypeScript + Tailwind CSS. See the
[repository root README](../README.md) and [`docs/`](../docs) for the full
project — this file only covers frontend-specific notes.

## Getting Started

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL etc.
npm run dev                  # http://localhost:3000
```

The backend (see `../backend`) must be running for anything beyond static
pages to work — this app has no business logic of its own and talks to the
backend exclusively through `src/lib/api-client.ts`
(docs/02-architecture.md §10).

## Structure

```
src/
├── app/
│   ├── (public)/        # Home, and future About/Courses/FAQs/Contact
│   ├── (auth)/           # /login, /register, /forgot-password
│   ├── student/dashboard/  # real URL segment — see docs/07-module-2-notes.md §4
│   ├── teacher/dashboard/  # for why these aren't route groups like (auth)/(public)
│   └── admin/dashboard/
├── components/           # empty until Module 5 — see components/README.md
├── hooks/                # empty until Module 5/6 — see hooks/README.md
├── lib/                  # api-client.ts — the only thing that talks to the backend
├── types/                # shared types mirroring backend API contracts
└── styles/               # non-Tailwind CSS only, if ever needed
```

## Notes

- **No `next/font/google`** — a system font stack is used instead (no
  external font-CDN dependency at build or runtime). See the comment in
  `src/app/layout.tsx` for the full rationale.
- **`output: "standalone"`** is set in `next.config.ts` for the optional
  self-hosted Docker path (`../docker/frontend.Dockerfile`) — the default
  V1 deployment target is still Vercel (`docs/06-deployment-and-docker.md`).
