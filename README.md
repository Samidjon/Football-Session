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


## Teams and Individuals

- **Teams** (`/teams`) is the public football-session directory. Users can open a session, create a squad for that session, and choose a private invite code (4–12 letters, numbers, or hyphens). Players enter the code on the Teams page to find the captain's squad. Each player reserves and pays for their own place; only successfully paid players appear in the roster.
- **Individuals** (`/individuals`) is a separate directory of open teams. Any signed-in user can create a team for free, choose its capacity, and invite people using its public team page. Each player pays their own fee before being added to the roster.
- Team invite codes live in the private `team_invite_codes` table. Only the team captain can retrieve or change their code; the public lookup function returns the team ID, not the code itself.
- The per-player fee for Individuals is controlled by the organizer through the existing `individual_settings` record.

Each session detail page includes a MOTM social-sharing illustration. Organizers can add direct image URLs and optional captions from the session edit page; regular visitors can view the images but cannot add or remove them.

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

### Teams directory and room-code join gate

- `/teams` lists only teams created from the Teams section. Each team is linked to a published football session and also appears on that session's team board.
- A captain can create a team, choose its session and capacity, and set a private room code. The team roster is visible on **View Team**. **Join Team** opens the room-code form; the code is verified before the player can continue to Stripe checkout.
- To deploy this flow, apply `supabase/migrations/20261022_team_invite_codes.sql` first, then `supabase/migrations/20261022_teams_directory_join_code_gate.sql`. The latter adds the `creation_source` discriminator and makes the server-side membership reservation require the room code.
- Existing teams are backfilled into the `session` source and remain visible from their session pages, but aren't placed in the new Teams directory unless they were created through the Teams section.

### Team invite codes migration

Before deploying the Teams invite-code update, apply `supabase/migrations/20261022_team_invite_codes.sql` in the Supabase SQL Editor. It creates private invite-code storage, assigns codes to existing session teams, and adds the protected lookup and captain-management functions. Apply it after the existing migrations through `20261015_restore_organizer_and_join_policies.sql`. Do not expose `team_invite_codes` directly to client queries; the application uses the restricted RPC functions instead.
