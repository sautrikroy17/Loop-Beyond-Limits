<div align="center">
  <img src="public/loop-icon.png" alt="Loop Logo" width="80" height="80" />
  <h1>Loop — Feel the Waves 🎵</h1>
  <p><strong>A Gen-Z music platform that adapts to your vibe.</strong></p>

  ![TypeScript](https://img.shields.io/badge/TypeScript-98.8%25-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square&logo=vite&logoColor=white)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![Supabase](https://img.shields.io/badge/Supabase-Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
  ![Vercel](https://img.shields.io/badge/Live-loop--feel.vercel.app-black?style=flat-square&logo=vercel&logoColor=white)
</div>

---

## ✨ What is Loop?

Loop is a mood-driven music platform built for the next generation of listeners. It automatically senses what you're feeling — whether it's a late-night drive, a study session, or a hype workout — and curates your experience accordingly.

> Music that listens back.

---

## 🚀 Features

- 🎧 **Mood Intelligence** — AI-powered listening analysis that detects your vibe (Night Drive, Deep Focus, Hype Mode, etc.) and adapts the UI and recommendations in real time
- 🎨 **Dynamic Themes** — Multiple visual themes (Midnight, Neon, Aurora, Solar, Ocean) that transform the entire interface
- 🔍 **YouTube Music Search** — Search and stream any song instantly
- 📋 **Playlists & Library** — Create and manage your personal playlists
- 🎵 **Full Playback Controls** — Play, pause, skip, seek, shuffle, repeat
- 💬 **Lyrics View** — Real-time lyrics synced to playback
- 👑 **Admin Dashboard** — Manage registered users (admin only)
- 🔐 **Google Auth** — One-click sign in via Google OAuth (Supabase)
- 📱 **Responsive Design** — Works beautifully across all screen sizes

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [TanStack Start](https://tanstack.com/start) + React 19 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 + Framer Motion |
| UI Components | Radix UI + shadcn/ui |
| Auth & Database | [Supabase](https://supabase.com) |
| State Management | Zustand |
| Deployment | [Vercel](https://vercel.com) |

---

## 🏃 Running Locally

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

```bash
# Clone the repo
git clone https://github.com/sautrikroy17/Loop-Feel-the-waves.git
cd Loop-Feel-the-waves

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

# Start the dev server
npm run dev
```

The app will be running at `http://localhost:8080`

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 🌐 Deployment

Loop is deployed on Vercel. Every push to `main` triggers an automatic production deployment.

**Live:** [loop-feel.vercel.app](https://loop-feel.vercel.app)

---

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
├── hooks/            # Custom React hooks (playback, auth, themes, etc.)
├── routes/           # TanStack Router file-based routes
├── functions/        # Server functions
├── lib/              # Utilities and Supabase client
└── types/            # TypeScript type definitions

supabase/
└── migrations/       # Database schema migrations
```

---

## 👤 Author

**Sautrik Roy**
- GitHub: [@sautrikroy17](https://github.com/sautrikroy17)
- Website: [sautrikroy.me](https://sautrikroy.me)

---

<div align="center">
  <sub>Built with ❤️ and too many late nights — Sautrik Roy © 2026</sub>
</div>
