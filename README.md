# LifeOps Dashboard

A personal command center to capture, organize, and track everything in your life. Built with React, Vite, and Tailwind CSS. Works offline as a PWA — installable on iPhone.

## Features

- **Quick Capture** — Type or speak tasks in natural language. The parser extracts title, category, due date, priority, and type automatically.
- **Voice Input** — Tap the microphone for real-time speech-to-text (Web Speech API).
- **Smart Organization** — Tasks auto-sort into Today, This Week, Upcoming, and Overdue sections.
- **9 Categories** — Work, Personal, Money, Car, House, Shopping, Side Hustle, People, Ideas — each color-coded.
- **Search & Filter** — Find tasks by text, filter by category or status (All / Active / Completed).
- **Insights Panel** — Live stats: tasks today, overdue count, completion percentage.
- **Offline PWA** — Install on your home screen. Works without internet.
- **Dark Theme** — Gradient dark UI, mobile-first, touch-friendly.

## Example Inputs

| Input | Category | Due Date | Priority |
|-------|----------|----------|----------|
| Buy milk tomorrow | Shopping | Tomorrow | Medium |
| Call mom Friday urgent | People | Friday | High |
| Fix bathroom light | House | — | Medium |
| YouTube video side hustle | Side Hustle | — | Medium |
| Pay rent in 2 weeks | Money | 2 weeks | Medium |
| Dentist appointment next Tuesday | Personal | Next Tuesday | Medium |
| Brainstorm app idea | Ideas | — | Medium |

## Tech Stack

- React 18 + Hooks
- Vite 6
- Tailwind CSS 3
- Lucide React icons
- Web Speech API
- localStorage (no backend)
- Service Worker for offline support

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy to GitHub

```bash
git init
git add -A
git commit -m "Initial commit: LifeOps Dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lifeops-dashboard.git
git push -u origin main
```

## Deploy to Vercel

1. Push your code to GitHub (see above).
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **"Add New Project"** and import your `lifeops-dashboard` repo.
4. Vercel auto-detects Vite. Click **Deploy**.
5. Your app is live at `https://your-project.vercel.app`.

## Install on iPhone

1. Open your Vercel URL in **Safari** on iPhone.
2. Tap the **Share** button (square with arrow).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"**.
5. LifeOps now opens as a standalone app from your home screen.

## Project Structure

```
├── index.html              HTML entry point
├── package.json            Dependencies
├── vite.config.js          Vite configuration
├── tailwind.config.js      Tailwind configuration
├── vercel.json             Vercel routing
├── public/
│   ├── manifest.json       PWA manifest
│   ├── sw.js               Service worker
│   ├── icon-192.png        App icon (192x192)
│   └── icon-512.png        App icon (512x512)
└── src/
    ├── main.jsx            React entry
    ├── index.css            Tailwind + animations
    └── App.jsx              Complete application
```

## License

MIT
