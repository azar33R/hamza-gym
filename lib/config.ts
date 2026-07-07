// ============================================================================
//  Business content — edit these placeholder values with your real info.
//  Plans are NO LONGER stored here — they are admin-managed in the `plans`
//  table (see lib/plans.ts). This file holds only static gym/coach details.
// ============================================================================

export const config = {
  coach: {
    name: "[Coach Name]",
    // Displayed in the Vodafone Cash payment modal.
    vodafoneCashWallet: "[Insert Coach Number Here]",
  },
  gym: {
    name: "[Gym Name]",
    address: "[Gym Address — street, city]",
    hours: "[Opening Hours — e.g. Sat–Thu, 6am–11pm]",
    // Google Maps deep link.
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=[Gym+Address]",
  },
} as const;
