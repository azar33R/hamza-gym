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
    name: "Hamza Gym",
    address: "مدينة التل الكبير، الإسماعيلية، مصر",
    hours: "النادي الرياضي يفتح من السبت للخميس",
    // Google Maps deep link.
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=مدينة%20التل%20الكبير%D8%8C%20%D8%A7%D9%84%D8%A5%D8%B3%D9%85%D8%A7%D8%B9%D9%8A%D9%84%D9%8A%D8%A9%D8%8C%20%D9%85%D8%B5%D8%B1",
  },
} as const;
