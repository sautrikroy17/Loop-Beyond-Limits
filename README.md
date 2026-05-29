<div align="center">
  <img src="public/logo.png" alt="Loop Logo" width="100" height="100" />
  <h1>Loop — Feel the Waves 🎵</h1>
  <p><strong>A production-grade, mood-driven music streaming platform built for the next generation of listeners.</strong></p>

  [![TypeScript](https://img.shields.io/badge/TypeScript-99%25-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
  [![TanStack](https://img.shields.io/badge/TanStack_Start-SSR-FF4154?style=for-the-badge&logo=react-query&logoColor=white)](https://tanstack.com/start)
  [![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_DB-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Vercel](https://img.shields.io/badge/Live_App-loop--feel--the--beat.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://loop-feel-the-beat.vercel.app)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

  <br />

  **[🚀 Open Live App](https://loop-feel-the-beat.vercel.app)** &nbsp;|&nbsp; **[👤 Portfolio](https://sautrikroy.me)** &nbsp;|&nbsp; **[📂 GitHub](https://github.com/sautrikroy17/Loop-Feel-the-waves)**
</div>

---

## Table of Contents

- [What is Loop?](#-what-is-loop)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Security](#-security)
- [Author](#-author)
- [License](#-license)

---

## 🎵 What is Loop?

Loop is a beautifully crafted, full-stack music streaming platform designed to adapt to your mood and listening habits in real time. Stream millions of tracks with zero buffering, zero ads, and a UI that feels alive — whether you're deep in a late-night study session, chasing that night-drive feeling, or getting hyped before the gym.

> *Music that listens back.*

Loop is built to production standards: encrypted end-to-end via HTTPS/TLS, CSP-hardened, rate-limited, and running on a globally distributed edge network with real-time cloud sync across all your devices.

---

## ✨ Features

### 🎧 Playback & Streaming
- **Instant Music Streaming** — Stream millions of tracks instantly with no buffering, no ads, no interruptions
- **Full Playback Controls** — Play, pause, skip, seek, shuffle, repeat — all with silky smooth animations
- **Background Media Session** — Music keeps playing with lock-screen / notification-tray controls when you switch apps
- **Queue Management** — Build, reorder, and manage your listening queue on the fly with drag-and-drop
- **Volume & Seek Precision** — Smooth seekbar and volume control for granular playback

### 🧠 Mood Intelligence Engine
- **Vibe Detection** — Analyses your listening habits and automatically detects your current vibe: *Night Drive*, *Deep Focus*, *Hype Mode*, *Chill Wave*, and more
- **Smart Autoplay** — "Feel The Vibe" engine surfaces mood-matched music automatically when your queue runs out — never a dead silence
- **Mood-Seeded Recommendations** — Every recommendation is computed fresh on the server using your current track context, not cached or pre-canned results

### 🔍 Search & Discovery
- **Omni Search** — Search across tracks, albums, and playlists simultaneously in a single unified results view
- **Album Browsing** — View full album tracklists with gorgeous cover art and play any track instantly
- **Lyrics View** — Real-time synchronized lyrics panel, right inside the player
- **Editorial Charts** — Trending charts and curated editorial picks updated live

### 📚 Library
- **Liked Songs** — Your personal favourites collection, always one tap away
- **Custom Playlists** — Create, rename, reorder, and manage playlists with your own cover art
- **Saved Albums** — Save full albums and access them from your library anytime
- **Recently Played** — Jump back into your last 10 sessions instantly

### 🎨 Personalisation & Themes
- **5 Dynamic Themes** — *Midnight*, *Neon*, *Aurora*, *Solar*, *Ocean* — transforms the entire interface colour palette
- **Animated Reactive Background** — The app background subtly shifts colour to match the energy of the playing track
- **Custom Avatar & Profile** — Upload a profile picture, set a display name, view your listening stats

### 🔐 Account & Cross-Device Sync
- **Google Sign-In** — One-click authentication via Google OAuth — no passwords required
- **Real-Time Cloud Sync** — Playlists, liked tracks, queue, and settings sync across all devices the moment you make a change via Supabase Realtime
- **Spotify Connect™ Mode** — Multi-device awareness: when you start playing on one device, others gracefully pause
- **Offline-Ready State** — Playback state (current track, queue, volume, shuffle) is persisted locally so sessions restore instantly on refresh

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) (SSR + Server Functions) |
| **UI** | [React 19](https://react.dev/) + [Framer Motion](https://www.framer.com/motion/) |
| **Styling** | Tailwind CSS v4 |
| **State** | [Zustand](https://zustand-demo.pmnd.rs/) (persisted) + [TanStack Query](https://tanstack.com/query) |
| **Auth & Database** | [Supabase](https://supabase.com/) (OAuth, Postgres, Realtime) |
| **Build** | [Vite](https://vitejs.dev/) + [Nitro](https://nitro.build/) |
| **Deployment** | [Vercel](https://vercel.com/) (edge, global CDN) |
| **Language** | TypeScript (strict mode, 99%+ coverage) |

---

## 🔒 Security

Loop is hardened to production standards:

| Protection | Implementation |
|---|---|
| **Transport Security** | HTTPS/TLS enforced via HSTS (`max-age=63072000; preload`) |
| **Content Security Policy** | Strict CSP header — blocks XSS, inline scripts, and unauthorized origins |
| **Clickjacking** | `X-Frame-Options: DENY` + `Cross-Origin-Opener-Policy: same-origin` |
| **MIME Sniffing** | `X-Content-Type-Options: nosniff` |
| **Cross-Origin Isolation** | `COEP: require-corp` + `CORP: same-origin` |
| **CORS Lockdown** | API endpoints restricted to `loop-feel.vercel.app` only |
| **Rate Limiting** | In-memory sliding-window limiter (60 req/min) on all server functions |
| **Input Sanitisation** | All user-supplied strings stripped of HTML/script tags and control characters before reaching any backend service |
| **Source Map Removal** | Production bundles built with `sourcemap: false` — compiled code is fully minified and unreadable in DevTools |
| **Permissions Policy** | Camera, microphone, geolocation, and payment APIs all blocked at header level |

---

## 🌐 Live App

**[https://loop-feel-the-beat.vercel.app](https://loop-feel-the-beat.vercel.app)**

---

## 👤 Author

**Sautrik Roy**
- 🌐 Portfolio: [sautrikroy.me](https://sautrikroy.me)
- 🐙 GitHub: [@sautrikroy17](https://github.com/sautrikroy17)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ and too many late nights — Sautrik Roy © 2026</sub>
</div>
