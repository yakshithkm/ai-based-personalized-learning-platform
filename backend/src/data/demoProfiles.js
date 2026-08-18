/**
 * Demo account definitions for presentation / evaluation mode.
 *
 * Each profile drives the demo-data seeder (scripts/seedDemoAccounts.js).
 * `subjectProfile[subject].weight` values must sum to 1 for a given profile
 * (they control how much practice volume goes to each subject).
 * `baseAccuracy` is the target correctness percentage for that subject
 * before per-topic jitter and recency trend are applied.
 */

const DEMO_PROFILES = [
  {
    key: 'neet',
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

module.exports = { DEMO_PROFILES };