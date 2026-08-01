require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../src/models/Question');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const total = await Question.countDocuments({});
    const byExamSubject = await Question.aggregate([
      {
        $group: {
          _id: { examType: '$examType', subject: '$subject' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.examType': 1, '_id.subject': 1 } },
    ]);

    const byExamTopic = await Question.aggregate([
      {
        $group: {
          _id: { examType: '$examType', subject: '$subject', topic: '$topic' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.examType': 1, '_id.subject': 1, '_id.topic': 1 } },
    ]);

    console.log(JSON.stringify({ total, byExamSubject, byExamTopic }, null, 2));
    await mongoose.disconnect();
  } catch (error) {
    console.error(error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // ignore
    }
    process.exit(1);
  }
})();
