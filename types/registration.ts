/**
 * Rotary 2440 Bölge Asamblesi - Kayıt ve Oda Yönetimi Ortak Tipleri
 */

export const DONOR_TYPES = [
  "Paul Harris Dostu",
  "Benefactor",
  "Major Donor",
] as const;

export type DonorType = (typeof DONOR_TYPES)[number];

export type RoomRegistrationType = "individual" | "room";

export interface AdultGuest {
  firstName: string;
  lastName: string;
  tcKimlik: string;
  birthDate: string;
  email: string;
  phone: string;
  gender: "Erkek" | "Kadın";
  club?: string;
  gorev?: string;
  donorTypes?: string[];
}

export interface ChildGuest {
  firstName: string;
  lastName: string;
  tcKimlik: string;
  birthDate: string;
  gender: "Erkek" | "Kadın";
}

export interface RoommatePreferences {
  roommate1?: string;
  roommate2?: string;
}
