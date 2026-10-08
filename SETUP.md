# Quick setup

## 1. Install and run

```bash
npm install
npm run dev
```

## 2. Supabase

Create a Supabase project.

Then run:

`supabase/schema.sql`

## 3. Environment

Copy `.env.example` to `.env.local`.

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
```

Restart the dev server after changing env variables.

## 4. First captain

Open:

`http://localhost:3000/auth/register`

Create an account.

## 5. Make yourself an organizer

Copy your user UUID from Supabase Authentication -> Users.

Then run:

```sql
update public.profiles
set role = 'organizer'
where id = 'YOUR_UUID';
```

Now open:

`http://localhost:3000/organizer`

## 6. First test flow

1. Register captain account.
2. Create a separate organizer account or promote your account.
3. Create a session.
4. Open the session as a captain.
5. Register a team.
6. Open the team.
7. Add player names.

Payment verification and fixture automation are the next layer and are already represented in the database.


## Stripe setup

1. Create a Stripe account and use **Test mode** first.
2. Copy the test publishable key and test secret key into `.env.local`.
3. Install the new dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

After registering a team, the app opens:

`/teams/<team-id>/payment`

The checkout form uses Stripe.js Elements with a Stripe PaymentIntent. Do not build plain HTML card-number/CVC inputs and do not store card details in Supabase.

For a production release, add a Stripe webhook to mark the payment as paid and the team as confirmed after Stripe sends the successful payment event. The current return page verifies the PaymentIntent server-side as an MVP flow.

## Existing Supabase projects

After updating an existing project, run `supabase/migrations/20261008_team_delete.sql` in the Supabase SQL Editor to add the captain team-delete function.


## Public roster migration

If your Supabase database already exists, run `supabase/migrations/20261008_public_team_rosters.sql`. Visitors can then open team squad pages without signing in.
