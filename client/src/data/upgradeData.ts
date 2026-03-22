import { UpgradeId } from "@shared/types";

/**
 * Client-side upgrade metadata.
 * Purely cosmetic/UI — the server applies the real effect.
 * Add new upgrades to UPGRADE_DATA to expand the pool.
 */
export interface UpgradeDefinition {
  id:          UpgradeId;
  name:        string;
  description: string;
  icon:        string;   // emoji or icon key for later sprite swap
}

export const UPGRADE_DATA: Record<UpgradeId, UpgradeDefinition> = {
  orbitCount: {
    id:          "orbitCount",
    name:        "+1 Orbit Weapon",
    description: "Add another orbiting projectile around you",
    icon:        "⚡",
  },
  speed: {
    id:          "speed",
    name:        "Swift Feet",
    description: "Increase movement speed by 10%",
    icon:        "💨",
  },
  orbitSpeed: {
    id:          "orbitSpeed",
    name:        "Faster Orbit",
    description: "Orbit weapons rotate 15% faster",
    icon:        "🌀",
  },
  orbitRadius: {
    id:          "orbitRadius",
    name:        "Wide Orbit",
    description: "Orbit radius increased — cover more area",
    icon:        "🔵",
  },
  pickupRadius: {
    id:          "pickupRadius",
    name:        "Magnetism",
    description: "Attract XP orbs from further away",
    icon:        "🧲",
  },
};
