// FORT UBA — shared design tokens
// Import this in all three apps so the brand stays consistent as the
// codebase grows. Values are pulled directly from the FORT UBA logo.

export const COLORS = {
  navy: "#1B2A6B",
  navyDark: "#121E4D",
  navyLight: "#2C3D8A",
  red: "#E8232A",
  redDark: "#C71E24",
  redBg: "#FDECEC",
  gold: "#F5A623",
  goldDark: "#C7860F",
  goldBg: "#FEF6E9",
  bg: "#F7F7F5",
  card: "#FFFFFF",
  text: "#1A1A1A",
  textSub: "#6B6B68",
  border: "#E7E5E0",
  green: "#3B6D11",
  greenBg: "#EAF3DE",
};

export const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// Pricing config — mirrors the Admin Dashboard "Settings" tab.
// This should eventually be fetched from the backend, not hardcoded,
// so ops staff can change pricing without a new app release.
export const PRICING = {
  boda: { baseFare: 1500, perKm: 450 },
  car: { baseFare: 3000, perKm: 900 },
  commissionRate: 0.18,
  subscriptionWeekly: 15000,
};

export function estimateFare(rideType, distanceKm) {
  const p = PRICING[rideType];
  if (!p) throw new Error(`Unknown ride type: ${rideType}`);
  return Math.round(p.baseFare + p.perKm * distanceKm);
}
