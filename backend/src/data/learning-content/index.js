const { getAllowedExamsForSubject } = require('./examsForSubject');
const physicsChemistry = require('./physics-chemistry');
const mathematicsBiology = require('./mathematics-biology');

const SEED_SOURCE = 'tutormind-curated-v1';

// Every seed entry gets the exams that actually include its subject (NEET: PCB, JEE: PCM,
// CET: all four) and a marker so the seeder can update/remove only its own rows.
const learningContentSeeds = [...physicsChemistry, ...mathematicsBiology].map((entry) => ({
  provider: 'TutorMind',
  language: 'en',
  qualityScore: 80,
  subtopic: 'General',
  ...entry,
  examTypes: getAllowedExamsForSubject(entry.subject),
  isActive: true,
  metadata: { seedSource: SEED_SOURCE },
}));

module.exports = { learningContentSeeds, SEED_SOURCE };