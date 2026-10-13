# ⚽ MOTM — Football Sessions

MOTM is a football session and team management platform for regular users and organizers. Visitors can browse public sessions and view team lineups. Any registered user can create a team in a session for free and choose its capacity. Every participant—including the creator—uses Join and pay to reserve a place and pays individually before appearing in the public roster.

**Brand:** MOTM  
**Instagram:** [@maluohtapimahu](https://www.instagram.com/maluohtapimahu/)

## Features

- Public browsing of open football sessions
- Public team and player-roster pages; no account required to view
- User account registration and login with Supabase Auth
- Organizer dashboard for creating, editing, and deleting sessions
- Session details including date, time, venue, match format, player limit, team slots, and deposit
- Free user-created teams with configurable capacity, individual Join and pay, and team-name editing
- Every registered participant pays their own fee; only paid participants appear on session rosters
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

For a new database, run `supabase/schema.sql` in Supabase SQL Editor and then apply migrations in timestamp order. For an existing database, never rerun the whole schema. If the old role conversion failed due to a policy dependency, run `20261013_00_role_policy_preflight.sql` first, then `20261013_individual_session_payments.sql`, `20261014_team_capacity_and_individual_join.sql`, and `20261015_restore_organizer_and_join_policies.sql`. If earlier migrations already succeeded, run only the new migrations that have not succeeded yet.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Organizer setup

New accounts are created as regular users by default. To grant organizer access, find the account UUID in **Supabase → Authentication → Users** and run:

```sql
update public.profiles
set role = 'organizer'
where id = 'YOUR_USER_UUID';
```

Then visit `/organizer` while logged into that account.

## User flows

### Visitor

Browse sessions → open a session → view registered teams → view a public squad roster.

### User

Create account → sign in → create a team in a session → every participant pays individually → paid participants appear in the public roster.

### Organizer

Sign in → create a session → edit or cancel a session → monitor team registrations and payments.

## Deployment notes

For Vercel, add all required environment variables in **Project Settings → Environment Variables**, at least for Production, then redeploy. Configure the production URL and permitted redirect URLs in Supabase Auth.

Use Stripe test keys until payment handling has been tested end-to-end. Before accepting real deposits, configure Stripe live credentials and implement/verify a Stripe webhook as the server-side source of truth for payment completion. Also verify Supabase RLS policies, email delivery settings, refund/cancellation rules, and payout bank details before opening the service to the public.

## License

MOTM project. Add a license file before distributing the source under an open-source license.


## Individuals

The **Individuals** area lets a user create a public squad with up to 30 players without attaching it to a particular session. Visitors can view the team roster without logging in. The user who created the team can add, rename, and remove players. A new team is public immediately but remains **Not counted** until its deposit is successfully paid through Stripe; after payment it changes to **Counted**. The team creator can pay later from the team page. Organizers can configure the deposit from `/organizer/individuals`.

## Appearance

The navigation includes a light/dark theme toggle. The selected theme is remembered in the browser.


## Language support

The interface defaults to Bahasa Melayu (BM). Users can switch to English (EN) from the top navigation; their preference is saved in the browser.


## Session registration model

Every account is a regular user unless explicitly assigned the Organizer role. Users can create public teams in sessions. Every participant pays their own per-person fee; only successful paid registrations are shown in the public roster. Session places are counted after the first participant payment activates the team.

## Animations

The interface uses lightweight CSS animations and transitions, including reduced-motion support. No additional animation library is required.


### Existing database migration for per-person checkout

If `20261013_individual_session_payments.sql` was already applied, run `supabase/migrations/20261013_prevent_session_slot_overbooking.sql` once in Supabase SQL Editor. It keeps team-slot reservations consistent while Stripe checkout is in progress.


## Session membership model

Any registered user can create a team for a session, then join a team by paying the per-person fee. A created team is public immediately, while only successful paid memberships are shown in its public roster. Organizers are the only separate account role.


## Organizer permissions recovery

If an Organizer cannot create or edit sessions, apply `supabase/migrations/20261015_restore_organizer_and_join_policies.sql` after the team-capacity migration. Check that the intended profile still has `role = 'organizer'`; normal user accounts should have role `user`.
