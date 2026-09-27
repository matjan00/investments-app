# Our Investments

A small private web app for two people: one shared view of an XTB ETF portfolio and Polish treasury bonds, plus a house down-payment forecast. Works on phones (add it to the home screen) and computers.

- **Overview** – total value, gain, today's change, allocation, every holding per account
- **Home goal** – how long until the down payment, with sliders for the monthly amount and expected return, a scenario table, and "how much per month to reach it by date X"
- **History** – value over time (one point saved every weekday evening)
- **Activity** – log purchases and sales, add new ETFs or bond series, update bond rates

## How it works

| Part | Where | Cost |
|---|---|---|
| Website (`docs/`) | GitHub Pages | free |
| Data + logins | Supabase (free tier) | free |
| Daily price update (`scripts/update-prices.js`) | GitHub Actions, Mon–Fri ~19:30 | free |

Prices come from Yahoo Finance and are converted to zł with Yahoo's exchange rates. XTB uses its own rates, so values can differ from XTB by around 0.5–1%.

Nobody can see the data without logging in: every table is protected by Row Level Security and new sign-ups are disabled in Supabase. The key in `docs/config.js` is Supabase's *publishable* key, which is designed to be public.

## Everyday use

**Bought something?** Activity → *Add purchase or sale*. Enter the units and the total amount in zł that left your account (XTB's transaction history shows it). If it came out of the cash savings, leave the tick box on and the cash amount goes down automatically.

**New ETF?** Activity → *Add ETF*. Find its symbol on finance.yahoo.com (e.g. `VWCE.DE`; `.DE` Xetra, `.WA` Warsaw, `.L` London). The price appears after the next evening update.

**New bonds?** Activity → *Add bond series* (e.g. `EDO1036`, year-1 rate and margin from obligacjeskarbowe.pl), then add the purchase.

**Once a year per bond series:** when a series passes its anniversary, the app shows a yellow notice. Tap *Enter rate* and add the new year's rate (margin + inflation, shown in your bond account). Until then it uses last year's rate.

**Cash / goal settings:** Home goal → *Edit* (home price, down-payment %, cash waiting to invest).

## If something goes wrong

- **Prices stopped updating:** GitHub → this repository → *Actions* → *Update prices*. A red ✗ means it failed; open it to see which ETF failed. *Run workflow* runs it immediately. The Yahoo symbol may need changing (Activity → ETFs).
- **App says "Could not load data":** Supabase pauses free projects after a week without use. The daily job normally prevents that; if it happens, open supabase.com → the project → *Restore*.
- **Forgot a password:** Supabase → Authentication → Users → the user → *Send password recovery* (or set a new one).

## For developers

```
npm install
npm test                      # checks bond math, average cost and the forecast
```

`supabase/schema.sql` creates the tables. The daily job needs the repository secret `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys → secret key).
