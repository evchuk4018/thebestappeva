import type { Request } from 'express';

export const canonicalOwnerId = 'owner-local-default';
export const legacyOwnerIds = ['local-user'] as const;

export function getCanonicalOwnerId() {
  return canonicalOwnerId;
}

export function isLegacyOwnerId(value: unknown): value is string {
  return typeof value === 'string' && legacyOwnerIds.includes(value as (typeof legacyOwnerIds)[number]);
}

export function getRequestOwnerId(_request: Request) {
  return canonicalOwnerId;
}
