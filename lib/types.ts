export type Role = "organizer" | "captain";

export type SessionStatus =
  | "open"
  | "full"
  | "ongoing"
  | "completed"
  | "cancelled";

export type RegistrationStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "rejected"
  | "refunded";

export type Session = {
  id: string;
  title: string;
  description: string | null;
  match_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  format: string;
  players_per_team: number;
  max_teams: number;
  deposit_amount: number;
  registration_deadline: string | null;
  status: SessionStatus;
  created_by: string;
  created_at: string;
};

export type Team = {
  id: string;
  session_id: string;
  captain_id: string;
  team_name: string;
  team_logo_url: string | null;
  registration_status: RegistrationStatus;
  created_at: string;
};
