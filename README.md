# WorkMate – AI-Powered Job Marketplace

Connecting job seekers and contractors with AI-assisted recommendations, real-time chat, and multi-language UX.

## Overview
WorkMate is a Next.js app where contractors post jobs and job seekers apply, chat, and discover relevant jobs using an AI assistant. The platform includes:
- Role-based auth (contractor, labourer/job seeker)
- Jobs CRUD and filtering (skill, location)
- AI recommendations (by skills/experience/location) and semantic search (“outdoor”, “activity”, locations)
- Real-time messaging with Socket.io
- Multi-language interface (English/Hindi/Marathi)
- Theming (light/dark)

## Tech Stack
- Frontend: Next.js (App Router), React, TypeScript, TailwindCSS
- Backend: Next.js API routes (Node.js), TypeScript/JavaScript mix
- Real-time: Socket.io (custom server in `server.js`)
- Database: Prisma ORM + SQLite (local dev)
- Auth: JWT (HS256) + bcrypt
- i18n: next-intl (messages in `messages/`)
- Icons/UI: Lucide React, Tailwind components

## Key Features
- Authentication: JWT-based signup/login, role-based access
- Jobs: post, list, filter by skill/location, AI image fallback
- AI Assistant:
  - In chat (AI Bot) and in the dashboard (AIMiddleman)
  - Understands semantic terms like “outdoor”, “activity”, “environment” and maps to skills (driving, gardening, construction…)
  - Extracts locations from queries (“jobs in Delhi”) and filters server-side
- Recommendations API: ranks jobs for labourers and labourers for jobs
- Real-time Chat:
  - Socket.io rooms per user (`user-<id>`) for instant delivery
  - Messages also persisted via REST API
  - Conversation isolation by selected user and optionally job
- i18n: English, Hindi, Marathi routes and message catalogs
- Theming: Light/Dark via context

## Project Structure
```
.
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── applications/
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── ai/recommendations/route.ts
│   │       ├── applications/route.ts
│   │       ├── auth/login/route.ts
│   │       ├── auth/signup/route.ts
│   │       ├── jobs/[id]/route.ts
│   │       ├── jobs/route.ts
│   │       ├── messages/route.ts
│   │       └── users/
│   ├── components/
│   │   ├── AIMiddleman.tsx      ← AI assistant widget with input field
│   │   ├── ChatSystem.tsx       ← Real-time chat + AI Bot chat
│   │   ├── ApplicationForm.tsx  ← Apply to job
│   │   ├── JobForm.tsx          ← Post job
│   │   └── ...
│   ├── contexts/ThemeContext.tsx
│   └── ...
├── lib/
│   ├── ai-images.ts
│   ├── ai-recommendations.ts
│   ├── auth.ts
│   └── prisma.ts
├── prisma/
│   ├── schema.prisma
│   └── dev.db
├── server.js                    ← Socket.io server
├── messages/                    ← i18n catalogs
├── README.md
└── ...
```

## Database Schema (Prisma)
- `User`: profile including role, skills, location
- `Job`: title, description, skill, category, wage, location, duration, contractorId
- `Application`: links user and job with status
- `Message`: chat messages between users (optional jobId context)
- `AIRecommendation`: optional analytics stub

See `prisma/schema.prisma` for details.

## Environment
Create `.env.local` in project root:
```env
JWT_SECRET=change-me
DATABASE_URL="file:./prisma/dev.db"
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

## Install & Dev
```bash
npm install
# Prisma client
npx prisma generate
# Initialize/Sync DB
npx prisma db push
# (Optional) inspect DB
npx prisma studio
# Run Next + custom socket server
npm run dev
```
- App: `http://localhost:3000`

## Running the Socket Server
The `npm run dev` script should start Next.js and use `server.js` to attach Socket.io. The client reads `NEXT_PUBLIC_SOCKET_URL` (defaults to `http://localhost:3000`).

## Authentication Flow
- `POST /api/auth/signup` creates user with role
- `POST /api/auth/login` returns JWT
- Clients store token (e.g., localStorage) and pass as `Authorization: Bearer <token>` to protected APIs

## Jobs API
- `GET /api/jobs?skill=<csv>&location=<text>&page=&limit=`
  - Filters:
    - `skill`: comma-separated skills; server uses OR logic
    - `location`: substring match on location
    - If both provided: location AND (any skill)
- `POST /api/jobs` (contractor only): create job

Example:
```
/api/jobs?skill=driving,gardening&location=delhi&limit=10
```

## AI Recommendations API
- `GET /api/ai/recommendations?type=jobs&id=<userId>`: jobs for labourer
- `POST /api/ai/recommendations` body `{ type: 'jobs'|'labourers', jobId? }`
- Logic in `lib/ai-recommendations.ts`:
  - Skill match, experience, location, contractor rating weighting

## AI Assistant
There are two ways to use the AI:

1) AI Bot in Chat (`ChatSystem.tsx`)
- Start a chat with “AI Bot” (virtual user id 0)
- Type:
  - “outdoor jobs” / “activity work” → semantic mapping to skills
  - “jobs in delhi” → location extraction
  - “driving in mumbai” → both skill + location
- The bot calls `/api/jobs` with the derived filters and replies with top matches. If no skill found, it falls back to recommendations.

2) AIMiddleman widget (`AIMiddleman.tsx`)
- In the Recommendations tab, use the input field to ask free text (same behavior as AI Bot)
- Clicking a result can navigate or prefill an action (up to your usage)

## Real-time Chat
- Client (`ChatSystem.tsx`):
  - On open, connects to socket and emits `join-user` with current user id
  - Sends messages via `send-message` socket event and also persists via `POST /api/messages`
  - Receives `new-message` in real time and shows per conversation (selected user and optional selected job)
- Server (`server.js`):
  - Creates room per user (`user-<id>`) on `join-user`
  - On `send-message`, relays normalized payload to the receiver’s room

How contractors see messages
- Open the chat UI with the job seeker selected (`selectedUser`)
- Messages load via `GET /api/messages?userId=<otherUserId>` and live updates come via socket
- Keep two browser sessions (or one incognito) to see real-time notifications while logged in as different users

## Internationalization (i18n)
- Routes: `/en`, `/hi`, `/mr`
- Catalogs in `messages/`
- App reads locale from route segment `[locale]`

## Theming
- Theme context in `src/contexts/ThemeContext.tsx`
- Light/Dark applied to UI

## Troubleshooting
- Next config warning: if you see “Invalid next.config.js options: serverExternalPackages”, remove that unsupported key from `next.config.js`.
- Prisma + SQLite case-insensitive: avoid `mode: 'insensitive'` (not supported); we use `contains` for filtering.
- Not receiving chat messages as contractor: ensure both sessions connected and each emits `join-user` with its own user id; verify `Authorization` header exists in `/api/messages` requests.
- AI doesn’t filter by location/skill: check the Network tab for `/api/jobs?...` parameters; ensure created jobs have the correct `skill` and `location` values.

## Scripts
```json
{
  "dev": "next dev",           
  "build": "next build",
  "start": "next start",
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "db:studio": "prisma studio"
}
```

## Roadmap
- Pagination (“Show more”) in AI replies
- Contractor inbox view listing all conversations
- File uploads in chat
- Replace placeholder images with a real image generation model
- Production DB (PostgreSQL) + migrations

---

WorkMate – AI-powered job matching and real-time hiring. Ready for local development and extensible for production. 
