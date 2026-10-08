# Football Session

Football Session is a full-stack football session and team registration app built with:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security

## Features included

- Captain account registration/login
- Organizer role
- Football session listing
- Session details
- Team registration
- Deposit/payment status
- Team player name management
- Organizer session creation
- Organizer payment verification
- Basic round-robin fixture generator
- RLS policies and database constraints

## Setup

1. Install Node.js LTS.
2. Create a Supabase project.
3. Open Supabase SQL Editor.
4. Run `supabase/schema.sql`.
5. Copy `.env.example` to `.env.local`.
6. Put your Supabase URL and publishable key into `.env.local`.
7. Run:

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Making an Organizer

New accounts are created as `captain` by default.

After registering, run this in Supabase SQL Editor:

```sql
update public.profiles
set role = 'organizer'
where id = 'YOUR_USER_UUID';
```

## Important

Do not put a Supabase service role key into `.env.local` for browser use.
Use the publishable key and keep RLS enabled.


## Stripe payment setup

The project now includes a secure card checkout using Stripe PaymentIntents + Stripe Elements.

Stripe's Payment Element renders the card number, expiry, and CVC fields inside Stripe's secure UI; the Football Session server does not receive the raw card number. The app uses Stripe.js Elements with a PaymentIntent so the card fields are handled by Stripe and the server receives only the payment result. See:
- https://docs.stripe.com/payments/payment-element
- https://docs.stripe.com/payments/quickstart

Add these variables to `.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

The deposit amount is taken from the session's `deposit_amount` in Supabase and converted to MYR cents for Stripe.

## Payment flow

Captain registers a team
→ Pending Payment
→ Pay Deposit
→ Stripe card form
→ Successful payment
→ team becomes Confirmed

For production, use a Stripe webhook as the authoritative payment confirmation mechanism rather than relying only on the browser return page. The included return page uses the server-only Supabase service-role key to finalize a paid checkout, so that key must never be exposed to the browser.


### Management permissions

- Organizers can edit and delete sessions they created.
- Captains can edit their own team name.
- Captains can rename players, remove players, and add new players up to the session limit.
- RLS prevents users from changing other users' sessions or teams.


### Team roster visibility

Authenticated users can open any registered team from a session and view its current player list. Only the captain can edit the team or its players.


### Public team rosters

Visitors do not need an account to view registered teams and player lists. Sign-in is only required for captain actions such as registering a team, editing a team, adding/removing players, and making payments.
