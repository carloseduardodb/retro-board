import { SnapshotCard } from "@/lib/types/database"

/**
 * Calculates the reference date for a snapshot.
 * The reference date is the day BEFORE the current date in Brasilia time (America/Sao_Paulo).
 * For example, if it's midnight BRT on Jan 15, the reference date is Jan 14.
 *
 * @param now - Optional Date to use as the current time (defaults to new Date())
 * @returns The reference date in YYYY-MM-DD format
 */
export function calculateReferenceDate(now?: Date): string {
  const current = now ?? new Date()

  // Use Intl.DateTimeFormat to get date parts in Brasilia time
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  // Get the current date in Brasilia time (en-CA gives YYYY-MM-DD format)
  const brasiliaDateStr = formatter.format(current)

  // Parse the Brasilia date and subtract one day
  const [year, month, day] = brasiliaDateStr.split("-").map(Number)
  const brasiliaDate = new Date(year, month - 1, day)
  brasiliaDate.setDate(brasiliaDate.getDate() - 1)

  // Format back to YYYY-MM-DD
  const refYear = brasiliaDate.getFullYear()
  const refMonth = String(brasiliaDate.getMonth() + 1).padStart(2, "0")
  const refDay = String(brasiliaDate.getDate()).padStart(2, "0")

  return `${refYear}-${refMonth}-${refDay}`
}

/**
 * Converts an ISO date string (YYYY-MM-DD) to DD/MM/AAAA format in America/Sao_Paulo timezone.
 * The conversion ensures the date displayed is always in Brasilia time,
 * regardless of the runtime environment's timezone.
 *
 * @param isoDate - Date string in YYYY-MM-DD format
 * @returns Date string in DD/MM/AAAA format
 */
export function formatDateBrasilia(isoDate: string): string {
  // Parse the ISO date parts directly to avoid timezone offset issues
  const [year, month, day] = isoDate.split("-").map(Number)

  const formattedDay = String(day).padStart(2, "0")
  const formattedMonth = String(month).padStart(2, "0")
  const formattedYear = String(year).padStart(4, "0")

  return `${formattedDay}/${formattedMonth}/${formattedYear}`
}

/**
 * Sorts snapshot cards by votes descending, then by created_at descending (newer first on tie).
 *
 * @param cards - Array of SnapshotCard to sort
 * @returns A new sorted array (does not mutate the original)
 */
export function sortSnapshotCards(cards: SnapshotCard[]): SnapshotCard[] {
  return [...cards].sort((a, b) => {
    // First: sort by votes descending
    if (b.votes !== a.votes) {
      return b.votes - a.votes
    }
    // Second: sort by created_at descending (newer first)
    return b.created_at.localeCompare(a.created_at)
  })
}
