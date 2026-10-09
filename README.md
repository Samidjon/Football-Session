# ⚽ MOTM — Football Sessions

MOTM is a football session and team management platform for organizers and team captains. Visitors can browse public sessions and view team lineups; captains can register a team, manage player names, and pay a session deposit.

**Brand:** MOTM  
**Instagram:** [@maluohtapimahu](https://www.instagram.com/maluohtapimahu/)

## Features

- Public browsing of open football sessions
- Public team and player-roster pages; no account required to view
- Captain account registration and login with Supabase Auth
- Organizer dashboard for creating, editing, and deleting sessions
- Session details including date, time, venue, match format, player limit, team slots, and deposit
- Captain team registration and team-name editing
- Add, rename, and remove player names without creating player accounts
- Enforced player limits
- Team deletion controls with server-side authorization
- Stripe card payment integration for session deposits
- Payment status and team registration status tracking
- Supabase PostgreSQL with Row Level Security (RLS)
- Responsive dark interface styled around the MOTM blue-and-yellow identity

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Next.js Route Handlers and server-side logic
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth with `@supabase/ssr`
- **Security:** Supabase Row Level Security
- **Payments:** Stripe Elements and PaymentIntents
- **Deployment:** Vercel

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_supabase_secret
```

Never expose `STRIPE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to client code or commit them to GitHub. Use test keys while developing.

### 3. Configure Supabase

For a new database, run `supabase/schema.sql` in the Supabase SQL Editor. If the database already exists, review and run the required migration scripts inside `supabase/migrations/` individually; do not rerun the entire schema over existing tables.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Organizer setup

New accounts are created as captains by default. To grant organizer access, find the account UUID in **Supabase → Authentication → Users** and run:

```sql
update public.profiles
set role = 'organizer'
where id = 'YOUR_USER_UUID';
```

Then visit `/organizer` while logged into that account.

## User flows

### Visitor

Browse sessions → open a session → view registered teams → view a public squad roster.

### Captain

Create account → sign in → register a team → pay the required deposit → manage team and player names.

### Organizer

Sign in → create a session → edit or cancel a session → monitor team registrations and payments.

## Deployment notes

For Vercel, add all required environment variables in **Project Settings → Environment Variables**, at least for Production, then redeploy. Configure the production URL and permitted redirect URLs in Supabase Auth.

Use Stripe test keys until payment handling has been tested end-to-end. Before accepting real deposits, configure Stripe live credentials and implement/verify a Stripe webhook as the server-side source of truth for payment completion. Also verify Supabase RLS policies, email delivery settings, refund/cancellation rules, and payout bank details before opening the service to the public.

## License

MOTM project. Add a license file before distributing the source under an open-source license.


## Individuals

The **Individuals** area lets captains create a public squad with up to 30 players without attaching it to a particular session. Visitors can view the team roster without logging in. Captains can add, rename, and remove players. A new team is public immediately but remains **Not counted** until its deposit is successfully paid through Stripe; after payment it changes to **Counted**. Captains can pay later from the team page. Organizers can configure the deposit from `/organizer/individuals`.

## Appearance

The navigation includes a light/dark theme toggle. The selected theme is remembered in the browser.


## Language support

The interface defaults to Bahasa Melayu (BM). Users can switch to English (EN) from the top navigation; their preference is saved in the browser.
