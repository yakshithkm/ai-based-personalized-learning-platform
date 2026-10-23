const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

jest.setTimeout(30000);

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  // Wait for every model's indexes (e.g. the unique GamificationEvent dedupe index) to exist
  // before any test runs; otherwise a cold first run can race the index build.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}, 30000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  const cleanupPromises = Object.keys(collections).map((key) => collections[key].deleteMany({}));
  await Promise.all(cleanupPromises);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);
