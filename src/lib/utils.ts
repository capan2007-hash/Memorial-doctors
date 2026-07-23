import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn/ui yardımcı: koşullu sınıfları birleştirir + Tailwind çakışmalarını çözer. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
