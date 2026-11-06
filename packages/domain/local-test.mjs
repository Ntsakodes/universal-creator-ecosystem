import { DomainError } from './policy.mjs';

export const LOCAL_IDENTITY_PREFIX = 'local-test:';
export const LOCAL_TEST_NOTICE = 'LOCAL TEST ONLY — synthetic accounts and dummy files. No payments, cloud storage or live AI.';
export const LOCAL_DATABASE = 'postgresql://uce:local-development-only@127.0.0.1:5433/uce_local_test?schema=public';
export const LOCAL_APP_URL = 'http://127.0.0.1:3000';

const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);

export function assertLocalTestEnvironment({ nodeEnv, databaseUrl, appUrl, bindAddress = '127.0.0.1' }) {
  if (!['development', 'test'].includes(nodeEnv)) throw new DomainError('Local testing cannot run in production.', 503);
  const database = new URL(databaseUrl);
  const app = new URL(appUrl);
  if (database.protocol !== 'postgresql:' || !loopback(database.hostname) || database.pathname !== '/uce_local_test') {
    throw new DomainError('Local tests require a loopback PostgreSQL database named uce_local_test.', 503);
  }
  if (app.protocol !== 'http:' || !loopback(app.hostname) || app.username || app.password || app.pathname !== '/' || app.search || app.hash) {
    throw new DomainError('Local testing requires a plain loopback application URL.', 503);
  }
  if (bindAddress !== '127.0.0.1') throw new DomainError('The local test API must bind to 127.0.0.1.', 503);
}

export function isLocalIdentity(subject) {
  return typeof subject === 'string' && subject.startsWith(LOCAL_IDENTITY_PREFIX);
}
