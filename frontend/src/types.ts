export type Role = "Admin" | "NGO" | "Volunteer" | "Donor" | "Household";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended" | "pending_verification" | "pending_approval";
  phone: string;
  district: string;
  organization_id: string | null;
  email_verified: boolean;
  created_at: string;
}
export interface UserPage {
  items: User[];
  total: number;
  page: number;
  page_size: number;
}
