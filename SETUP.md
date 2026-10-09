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
