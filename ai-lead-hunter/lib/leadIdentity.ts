import type { RawBusiness } from "./types";
export function businessKey(
  b: Pick<RawBusiness, "sourcePlaceId" | "name" | "address">,
): string {
  return b.sourcePlaceId
    ? `place:${b.sourcePlaceId}`
    : `name:${b.name.trim().toLowerCase()}|${b.address.trim().toLowerCase()}`;
}
