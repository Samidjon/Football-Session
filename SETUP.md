# MOTM — quick setup

1. Install Node.js LTS.
2. Run `npm install`.
3. Create a Supabase project and configure `.env.local` using `.env.example`.
4. For a fresh database, run `supabase/schema.sql` in Supabase SQL Editor. For an existing database, apply only the relevant scripts in `supabase/migrations/`.
5. Add Stripe test keys to `.env.local` while developing.
6. Run `npm run dev` and open `http://localhost:3000`.

## Make an account an Organizer

Register normally, copy the account's UUID from **Supabase → Authentication → Users**, and run:

```sql
update public.profiles
set role = 'organizer'
where id = 'YOUR_USER_UUID';
```

## Vercel deployment

Add the required environment variables in **Project Settings → Environment Variables**, select Production, then redeploy. Set the Vercel domain in **Supabase → Authentication → URL Configuration**.

Before taking real payments, switch Stripe to Live only after testing payment flows and confirming the webhook, refunds/cancellations, and payout bank details are ready.


## New Individuals feature migration

For an existing Supabase project, run this migration in SQL Editor:

`supabase/migrations/20261009_individuals_and_theme.sql`

This creates the public Individuals directory, a default RM50 deposit (editable by an Organizer), team rosters limited to 30 players, and database access rules. After deployment, test public browsing while logged out and team creation and individual payment while logged in.


## Session per-person payments update

For a fresh database, use `supabase/schema.sql`.

For an existing database, apply migrations in order if they have not already been run:

1. `supabase/migrations/20261013_individual_session_payments.sql`
2. `supabase/migrations/20261013_prevent_session_slot_overbooking.sql`

The first migration changes the session model to regular users with per-person payments. The second prevents teams from taking the final slot while another checkout is actively reserving it. Do not rerun a migration that has already succeeded.

## Animation dependencies

No extra animation package is needed. The interactive transitions and entrance animations use CSS, respect `prefers-reduced-motion`, and work with the current Next.js/Tailwind setup.


## Organizer permissions recovery and free team creation

For an existing database, apply only migrations that have not already succeeded. If the earlier role-type change failed with `cannot alter type of a column used in a policy definition`, run `20261013_00_role_policy_preflight.sql` first, then:

1. `20261013_individual_session_payments.sql`
2. `20261014_team_capacity_and_individual_join.sql`
3. `20261015_restore_organizer_and_join_policies.sql`

The last migration restores Organizer session-management policies and public read access to open sessions, teams, and paid rosters. It does not delete user/team/payment data.
