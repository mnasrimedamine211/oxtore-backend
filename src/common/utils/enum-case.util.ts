// The DB stores these two enums lowercase (see prisma/schema.prisma); the frontend
// API contract expects uppercase status values. These maps translate at the API
// boundary only — Prisma columns/enum values are never touched.

const BOUTIQUE_REQUEST_STATUS_TO_API: Record<string, string> = {
  pending: 'PENDING',
  approved: 'ACCEPTED',
  rejected: 'REJECTED',
};

const BOUTIQUE_REQUEST_STATUS_FROM_API: Record<string, string> = {
  PENDING: 'pending',
  ACCEPTED: 'approved',
  REJECTED: 'rejected',
  // CANCELLED has no equivalent DB state yet (no cancel action exists for
  // boutique requests) — intentionally left unmapped; callers must handle
  // an undefined result rather than guessing at a DB value.
};

const STOCK_REQUEST_STATUS_TO_API: Record<string, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  fulfilled: 'FULFILLED',
  cancelled: 'CANCELLED',
};

const STOCK_REQUEST_STATUS_FROM_API: Record<string, string> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
};

export function boutiqueRequestStatusToApi(status: string): string {
  return BOUTIQUE_REQUEST_STATUS_TO_API[status] ?? status.toUpperCase();
}

/** Returns undefined if `status` has no corresponding DB value (e.g. 'CANCELLED'). */
export function boutiqueRequestStatusFromApi(status?: string | null): string | undefined {
  if (!status) return undefined;
  return BOUTIQUE_REQUEST_STATUS_FROM_API[status.toUpperCase()];
}

export function stockRequestStatusToApi(status: string): string {
  return STOCK_REQUEST_STATUS_TO_API[status] ?? status.toUpperCase();
}

export function stockRequestStatusFromApi(status?: string | null): string | undefined {
  if (!status) return undefined;
  return STOCK_REQUEST_STATUS_FROM_API[status.toUpperCase()];
}
