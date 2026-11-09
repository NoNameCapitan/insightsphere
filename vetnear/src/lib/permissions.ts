// Role/permission model (Module 12). Pure, framework-agnostic.
import type { Permission, UserRole } from "@/lib/types";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  guest: ["search"],
  user: ["search", "create_pet"],
  partner: ["search", "create_pet", "submit_place", "manage_own_place"],
  moderator: ["search", "create_pet", "submit_place", "manage_own_place", "moderate"],
  admin: [
    "search",
    "create_pet",
    "submit_place",
    "manage_own_place",
    "moderate",
    "manage_all",
  ],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
