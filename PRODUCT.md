# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A married couple in Poland saving for their first home. Neither has a finance or tech background. Both use the app on their phones, mostly weekly or right after buying something, to add the purchase and see when they can afford the down payment. Either of them adds purchases and updates bond rates, so every task must be doable by both without help.

## Product Purpose

One shared, synced app that answers "when can we buy our home?" It tracks their portfolio (XTB ETFs and Polish EDO treasury bonds held at Pekao) and projects when it reaches the down payment: 30% of a 1,000,000 zł home (300,000 zł, editable). Success means they trust the date, keep it up to date without effort, and feel calm and motivated rather than anxious about daily market moves.

## Positioning

Not a trading or net-worth tracker: a home-savings planner built around their real Polish instruments. It models EDO bonds to the grosz (yearly capitalised interest, margin + inflation rates), the 19% Belka tax on gains, and XTB-specific entry, and turns everything into one answer: a month and year.

## Operating Context

- Purchases happen in XTB (accounts "Główne" and "Poboczne") and as EDO bonds at Pekao; the user copies the total zł amount from XTB's transaction history.
- Once a year per bond series a new interest rate applies (margin + GUS inflation); the app warns, and one of them enters it.
- ETF prices and FX update automatically every weekday evening (GitHub Actions → Supabase), which also saves a history point.
- Sliders on the Home goal page change a shared plan both of them see.

## Capabilities and Constraints

- Static site on GitHub Pages (public repo, no personal data in it), vanilla JS, Supabase for auth and data, Chart.js; free tools only.
- Login only (sign-ups disabled); two users.
- IKE and cash are deliberately excluded from the app; everything tracked counts toward the home goal.
- Language: Polish (switched 2026-10-12), matching XTB, Pekao and bond terminology; English names stored in the database are shown in Polish.

## Evidence on Hand

Real holdings live only in Supabase and the gitignored supabase/seed.sql. No testimonials, users or claims beyond the two of them.

## Product Principles

1. The home date is the headline; portfolio value and daily moves are supporting detail.
2. Calm over thrill: long-term savers should not be nudged into daily worry.
3. Either partner can do every task alone, in plain Polish, without finance jargon.
4. Mistakes are recoverable: shared data must be hard to destroy by accident.
5. Exact where it matters: bond and tax maths stay precise and are never simplified for looks.
