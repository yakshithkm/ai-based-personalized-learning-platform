require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const Question = require('./src/models/Question');
const LearningContent = require('./src/models/LearningContent');
const LearningContentProgress = require('./src/models/LearningContentProgress');
const LearningRecommendation = require('./src/models/LearningRecommendation');
const { learningContentSeeds, SEED_SOURCE } = require('./src/data/learning-content');

// Usage:
//   npm run seed:content            upsert the curated internal study material (idempotent)
//   npm run seed:content -- --dry-run   validate against the question bank only, write nothing
//   npm run seed:content -- --reset     first remove previously seeded rows that no student uses
const dryRun = process.argv.includes('--dry-run');
const shouldReset = process.argv.includes('--reset');

const run = async () => {
  await connectDB();

  // Validate against what the recommendation engine will actually join on: the real
  // (subject, topic) pairs in the question bank.
  const pairs = await Question.aggregate([{ $group: { _id: { subject: '$subject', topic: '$topic' }, questions: { $sum: 1 } } }]);
  const questionCounts = new Map(pairs.map((p) => [`${p._id.subject}::${p._id.topic}`, p.questions]));

  const orphaned = [];
  const coverage = new Map();
  learningContentSeeds.forEach((seed) => {
    const key = `${seed.subject}::${seed.topic}`;
    if (!questionCounts.has(key)) orphaned.push(`${seed.subject} / ${seed.topic} - "${seed.title}"`);
    coverage.set(key, (coverage.get(key) || 0) + 1);
  });

  console.log(`Seed set: ${learningContentSeeds.length} resources across ${coverage.size} topics.`);
  if (orphaned.length) {
    console.warn(`\n${orphaned.length} resource(s) reference a topic with NO questions in the database yet:`);
    orphaned.forEach((line) => console.warn(`  - ${line}`));
    console.warn('They will still be stored, but practice sets for those topics will be empty until questions are seeded (npm run seed:questions).\n');
  }

  if (dryRun) {
    console.log('Dry run: nothing written.');
    return;
  }

  if (shouldReset) {
    const seeded = await LearningContent.find({ 'metadata.seedSource': SEED_SOURCE }).select('_id').lean();
    let removed = 0;
    let kept = 0;
    for (const row of seeded) {
      const used =
        (await LearningContentProgress.countDocuments({ content: row._id })) +
        (await LearningRecommendation.countDocuments({ content: row._id }));
      if (used) kept += 1;
      else {
        await LearningContent.deleteOne({ _id: row._id });
        removed += 1;
      }
    }
    console.log(`Reset: removed ${removed} unused seeded resources, kept ${kept} that students already interacted with.`);
  }

  let created = 0;
  let updated = 0;
  for (const seed of learningContentSeeds) {
    const filter = { provider: seed.provider, title: seed.title, subject: seed.subject, topic: seed.topic };
    const existing = await LearningContent.findOne(filter);
    if (existing) {
      existing.set(seed);
      await existing.save();
      updated += 1;
    } else {
      await LearningContent.create(seed);
      created += 1;
    }
  }
  console.log(`Learning content seeded: ${created} created, ${updated} updated.`);
};

run()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });