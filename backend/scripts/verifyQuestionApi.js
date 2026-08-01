require('dotenv').config();

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const connectDB = require('../src/config/db');

const makeEmail = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`;

const registerAndToken = async ({ name, email, targetExam }) => {
  const registerRes = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'pass1234',
    targetExam,
  });

  if (registerRes.status !== 201) {
    throw new Error(`Failed to register ${targetExam} user: ${registerRes.status}`);
  }

  return registerRes.body.token;
};

(async () => {
  try {
    await connectDB();

    const neetToken = await registerAndToken({
      name: 'NEET Verifier',
      email: makeEmail('neet'),
      targetExam: 'NEET',
    });

    const cetToken = await registerAndToken({
      name: 'CET Verifier',
      email: makeEmail('cet'),
      targetExam: 'CET',
    });

    const [
      neetSubjects,
      cetSubjects,
      neetBiologyQuestions,
      cetBiologyQuestions,
      cetAllQuestions,
      adminStats,
      examSubjects,
    ] = await Promise.all([
      request(app)
        .get('/api/questions/subjects-topics')
        .set('Authorization', `Bearer ${neetToken}`),
      request(app)
        .get('/api/questions/subjects-topics')
        .set('Authorization', `Bearer ${cetToken}`),
      request(app)
        .get('/api/questions')
        .query({ subject: 'Biology', limit: 15 })
        .set('Authorization', `Bearer ${neetToken}`),
      request(app)
        .get('/api/questions')
        .query({ subject: 'Biology', limit: 15 })
        .set('Authorization', `Bearer ${cetToken}`),
      request(app)
        .get('/api/questions')
        .query({ limit: 15 })
        .set('Authorization', `Bearer ${cetToken}`),
      request(app)
        .get('/api/admin/question-stats')
        .set('Authorization', `Bearer ${neetToken}`),
      request(app)
        .get('/api/admin/exam-subjects')
        .set('Authorization', `Bearer ${neetToken}`),
    ]);

    console.log(
      JSON.stringify(
        {
          neetSubjectsStatus: neetSubjects.status,
          cetSubjectsStatus: cetSubjects.status,
          neetSubjectNames: (neetSubjects.body.subjects || []).map((row) => row.subject),
          cetSubjectNames: (cetSubjects.body.subjects || []).map((row) => row.subject),
          neetBiologyCount: neetBiologyQuestions.body.count,
          cetBiologyCount: cetBiologyQuestions.body.count,
          cetBatchCount: cetAllQuestions.body.count,
          adminStatsStatus: adminStats.status,
          adminStats: adminStats.body,
          examSubjectsStatus: examSubjects.status,
          examSubjects: examSubjects.body,
        },
        null,
        2
      )
    );

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
