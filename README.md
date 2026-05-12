# Voltage Monitor Dashboard ⚡

A lightweight web dashboard for monitoring voltage levels from
Tuya-based smart relays with historical tracking, anomaly detection, and
mobile-first UI.

------------------------------------------------------------------------

## 🚀 Overview

This project collects voltage data from Tuya devices and visualizes it
in a modern dashboard.

    Tuya Devices → GitHub Actions (cron) → Supabase → Next.js UI

------------------------------------------------------------------------

## 🧱 Tech Stack

### Frontend

-   Next.js (React)
-   Tailwind CSS
-   Recharts

### Backend / Data

-   Supabase (Postgres)
-   GitHub Actions
-   Tuya Cloud API

------------------------------------------------------------------------

## ⚙️ Functionality

-   Real-time voltage display (auto-refresh every 10s)
-   Historical chart (6h / 24h / 7d)
-   Device switching (by location)
-   Daily summary (Min / Avg / Max)
-   Stability score
-   Trend vs 1-hour average

------------------------------------------------------------------------

## 🎯 Monitoring Features

-   Normal: 207--253 V
-   Low: \< 207 V
-   High: \> 253 V
-   Critical: \< 200 V

------------------------------------------------------------------------

## 🔄 Data Flow

1.  GitHub Action runs every 5 minutes\
2.  Fetches data via Tuya API\
3.  Stores in Supabase\
4.  UI reads from Supabase

------------------------------------------------------------------------

## ▶️ Running Locally

    npm install
    npm run dev

------------------------------------------------------------------------

## 🚀 Deployment

-   Vercel
-   Auto deploy via GitHub

------------------------------------------------------------------------

## 🏁 Status

MVP complete
