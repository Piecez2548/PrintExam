import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrivateDemoOtpLoggingEnabled } from '../../src/config/otp';

test('private demo OTP logging is disabled by default', () => {
  assert.equal(isPrivateDemoOtpLoggingEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(isPrivateDemoOtpLoggingEnabled({}), false);
});

test('private demo OTP logging requires production and explicit opt-in', () => {
  assert.equal(isPrivateDemoOtpLoggingEnabled({ NODE_ENV: 'production', ENABLE_PRIVATE_DEMO_OTP_LOG: 'false' }), false);
  assert.equal(isPrivateDemoOtpLoggingEnabled({ NODE_ENV: 'production', ENABLE_PRIVATE_DEMO_OTP_LOG: 'true' }), true);
  assert.equal(isPrivateDemoOtpLoggingEnabled({ NODE_ENV: 'development', ENABLE_PRIVATE_DEMO_OTP_LOG: 'true' }), false);
});
