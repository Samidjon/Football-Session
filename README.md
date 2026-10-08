# ⚽ Football Session

Football Session is a full-stack web platform for organizing football sessions, registering teams, managing player rosters, and handling team deposits.

The platform is designed for football organizers and team captains. Organizers can create and manage football sessions, while captains can register their teams, pay the required deposit, and manage their player lists.

Visitors can also browse available football sessions and view registered teams and their player rosters without creating an account.

---

## ✨ Features

### 👤 Authentication

- Captain account registration and login
- Organizer accounts
- Secure authentication with Supabase Auth
- Automatic profile creation after registration
- Protected captain and organizer actions
- Logout functionality

### ⚽ Football Sessions

Organizers can create football sessions with:

- Session name
- Match date
- Start and end time
- Venue
- Match format
- Number of teams
- Players per team
- Registration deposit
- Session status
- Description

Supported formats include:

- 7-a-side
- 11-a-side

Organizers can also:

- Edit sessions
- Delete sessions
- Change session status
- Update team limits
- Change player limits
- Change the required deposit

---

## 🏆 Team Registration

Captains can:

- Browse available football sessions
- Register a team
- Choose a team name
- Pay the required deposit
- View their team
- Edit their team
- Delete their team
- Manage their player list

A team initially starts with:

> 🟡 Pending Payment

After a successful payment:

> 🟢 Confirmed

Only confirmed teams are treated as fully registered.

---

## 👥 Player Management

Players do not need to create accounts.

The team captain simply enters their names.

For example:

```text
FC Tigers

1. Ahmad
2. Faris
3. Zulkifli
4. Amir
5. Hakim
6. Danial
7. Syafiq
8. Iman
