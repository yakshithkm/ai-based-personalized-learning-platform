// Presentation accounts for the three subscription tiers. These are ordinary database users whose
// tier was provisioned server-side (npm run seed:demo); signing in with them goes through the
// normal login endpoint, so authorization, feature gating and usage limits are identical to a real
// user of that tier. Nothing here grants access on the client.
export const TIER_DEMO_ACCOUNTS = [
  { tier: 'FREE', labelKey: 'tier.demo.free', email: 'free.demo@learning.com', password: 'free@123' },
  { tier: 'PRO', labelKey: 'tier.demo.pro', email: 'pro.demo@learning.com', password: 'pro@123' },
  { tier: 'PREMIUM', labelKey: 'tier.demo.premium', email: 'premium.demo@learning.com', password: 'premium@123' },
];
