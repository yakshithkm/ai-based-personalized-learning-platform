/**
 * Demo account definitions for presentation / evaluation mode.
 *
 * Each profile drives the demo-data seeder (scripts/seedDemoAccounts.js).
 * `subjectProfile[subject].weight` values must sum to 1 for a given profile
 * (they control how much practice volume goes to each subject).
 * `baseAccuracy` is the target correctness percentage for that subject
 * before per-topic jitter and recency trend are applied.
 *
 * `tier` is the subscription tier the account is provisioned with (applied through the same
 * subscriptionService every real tier change uses - demo accounts get no special code path at
 * request time). The exam demos (neet/cet/jee) are PREMIUM so the original exam showcase keeps
 * every feature; the Free / Pro / Premium demos exist to demonstrate the tiers themselves.
 */

const DEMO_PROFILES = [
  {
    key: 'neet',
    tier: 'PREMIUM',
    email: 'neet@learning.com',
    password: 'neet@123',
    name: 'Aditi Rao',
    targetExam: 'NEET',
    volumeMultiplier: 1,
    subjectProfile: {
      Biology: { weight: 0.45, baseAccuracy: 83 },
      Chemistry: { weight: 0.32, baseAccuracy: 66 },
      Physics: { weight: 0.23, baseAccuracy: 47 },
    },
  },
  {
    key: 'cet',
    tier: 'PREMIUM',
    email: 'cet@learning.com',
    password: 'cet@123',
    name: 'Rohan Shetty',
    targetExam: 'CET',
    volumeMultiplier: 1.05,
    subjectProfile: {
      Mathematics: { weight: 0.32, baseAccuracy: 84 },
      Physics: { weight: 0.26, baseAccuracy: 63 },
      Biology: { weight: 0.22, baseAccuracy: 57 },
      Chemistry: { weight: 0.2, baseAccuracy: 43 },
    },
  },
  {
    key: 'jee',
    tier: 'PREMIUM',
    email: 'jee@learning.com',
    password: 'jee@123',
    name: 'Ishaan Verma',
    targetExam: 'JEE',
    volumeMultiplier: 1.1,
    subjectProfile: {
      Mathematics: { weight: 0.4, baseAccuracy: 81 },
      Physics: { weight: 0.33, baseAccuracy: 59 },
      Chemistry: { weight: 0.27, baseAccuracy: 41 },
    },
  },
];

// Tier showcase accounts: identical exam/subject mix (JEE) so the ONLY thing that differs on
// screen is what each tier is allowed to see and do.
const TIER_DEMO_SUBJECTS = {
  Mathematics: { weight: 0.4, baseAccuracy: 78 },
  Physics: { weight: 0.33, baseAccuracy: 58 },
  Chemistry: { weight: 0.27, baseAccuracy: 44 },
};

const TIER_DEMO_PROFILES = [
  {
    key: 'free-demo',
    tier: 'FREE',
    email: 'free.demo@learning.com',
    password: 'free@123',
    name: 'Free Demo',
    targetExam: 'JEE',
    volumeMultiplier: 1,
    subjectProfile: TIER_DEMO_SUBJECTS,
  },
  {
    key: 'pro-demo',
    tier: 'PRO',
    email: 'pro.demo@learning.com',
    password: 'pro@123',
    name: 'Pro Demo',
    targetExam: 'JEE',
    volumeMultiplier: 1.05,
    subjectProfile: TIER_DEMO_SUBJECTS,
  },
  {
    key: 'premium-demo',
    tier: 'PREMIUM',
    email: 'premium.demo@learning.com',
    password: 'premium@123',
    name: 'Premium Demo',
    targetExam: 'JEE',
    volumeMultiplier: 1.1,
    subjectProfile: TIER_DEMO_SUBJECTS,
  },
];

DEMO_PROFILES.push(...TIER_DEMO_PROFILES);

module.exports = { DEMO_PROFILES, TIER_DEMO_PROFILES };