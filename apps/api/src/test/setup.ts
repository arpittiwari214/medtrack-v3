/**
 * Test harness.
 *
 * Runs against a real MongoDB (in-memory) rather than mocks, because most of
 * what is worth testing here *is* the database behaviour: unique indexes,
 * partial filters, upsert idempotency. A mocked Mongoose would only assert that
 * the code calls the functions it calls, which proves nothing.
 *
 * Import order matters. This file must not import `config/env.ts`, directly or
 * transitively, before the environment below is set — `env.ts` validates at
 * module load and calls `process.exit(1)` on a bad config. The model imports
 * are safe because none of them read configuration.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Registering the models here means `mongoose.models` is populated by the time
// `beforeAll` builds indexes, rather than only once a test imports the app.
import '../models/Alert.js';
import '../models/Appointment.js';
import '../models/CareLink.js';
import '../models/Device.js';
import '../models/DoseEvent.js';
import '../models/Medicine.js';
import '../models/PasswordReset.js';
import '../models/Session.js';
import '../models/SyncMutation.js';
import '../models/User.js';

// Set before any module that reads configuration is loaded.
process.env['NODE_ENV'] = 'test';
process.env['MONGODB_URI'] ??= 'mongodb://placeholder/medtrack-test';
process.env['JWT_ACCESS_SECRET'] ??= 'test-access-secret-that-is-at-least-32-chars-long';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-secret-that-is-at-least-32-chars-long';
process.env['SCHEDULER_ENABLED'] = 'false';
process.env['LOG_LEVEL'] = 'silent';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { autoIndex: false });

  // Build indexes explicitly, exactly as the server does at boot — several
  // tests depend on unique and partial indexes actually existing.
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
});

afterEach(async () => {
  // Clear data between tests but keep indexes, so each test starts clean
  // without paying to rebuild them.
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  // Guarded: if `beforeAll` failed or timed out, `mongo` was never assigned and
  // an unguarded call here masks the real failure with a TypeError.
  await mongo?.stop();
});
