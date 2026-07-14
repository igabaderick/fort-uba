/**
 * FORT UBA — Base Design System (Uber-inspired)
 * 
 * Mirrors Uber's Base design language:
 * - Pure black/white/grey palette
 * - Map-first layout with floating bottom sheet
 * - 56px primary buttons, full-width, black
 * - Clean typography, Inter font
 * - Bottom sheet with snap points (400ms quintic ease)
 * - Minimal chrome — let content breathe
 */

export const T = {
  // ── Colors (Uber Base semantic tokens) ───────────────────────
  black:         "#000000",
  white:         "#FFFFFF",
  
  // Content
  primary:       "#000000",   // contentPrimary
  secondary:     "#545454",   // contentSecondary  
  tertiary:      "#8D8D8D",   // contentTertiary
  disabled:      "#B8B8B8",   // contentDisabled
  inverse:       "#FFFFFF",   // contentInverse (on dark bg)
  negative:      "#C0392B",   // contentNegative (errors)
  positive:      "#057A55",   // contentPositive (success)
  warning:       "#B45309",   // contentWarning

  // Backgrounds
  bgPrimary:     "#FFFFFF",   // backgroundPrimary
  bgSecondary:   "#F6F6F6",   // backgroundSecondary
  bgTertiary:    "#EEEEEE",   // backgroundTertiary
  bgInverse:     "#000000",   // backgroundInverse
  bgNegative:    "#C0392B",   // backgroundNegative
  bgPositive:    "#057A55",   // backgroundPositive

  // Borders
  border:        "#E2E2E2",   // borderOpaque
  borderSelected:"#000000",

  // Brand accent (FORT UBA specific — used very sparingly)
  brand:         "#1B2A6B",   // navy, only for map elements
  brandAccent:   "#F5A623",   // gold, only for driver earnings highlight

  // ── Typography ────────────────────────────────────────────────
  font: "'Inter', 'UberMove', -apple-system, BlinkMacSystemFont, sans-serif",

  // ── Sizing ────────────────────────────────────────────────────
  // Touch targets min 48px (Uber spec)
  btnHeightLg:   56,   // large primary button
  btnHeightMd:   48,   // medium
  btnHeightSm:   36,   // small
  
  // Corner radius
  radiusSm:      8,
  radiusMd:      12,
  radiusLg:      16,
  radiusPill:    999,
  
  // Spacing
  sp2:   2,  sp4:  4,  sp6:  6,   sp8:  8,
  sp12: 12, sp16: 16, sp20: 20,  sp24: 24,
  sp32: 32, sp40: 40, sp48: 48,  sp56: 56,

  // ── Motion (Uber Base spec) ───────────────────────────────────
  easeOut:   "cubic-bezier(0.23, 1, 0.32, 1)",     // entry
  easeInOut:  "cubic-bezier(0.86, 0, 0.07, 1)",    // exit
  duration:  "400ms",
};
