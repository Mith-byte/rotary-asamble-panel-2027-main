import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInstallmentCount(pricingType: string): number {
  if (pricingType === "round_2") return 1;
  if (pricingType === "round_1") return 2;
  return 3; // early_bird
}
