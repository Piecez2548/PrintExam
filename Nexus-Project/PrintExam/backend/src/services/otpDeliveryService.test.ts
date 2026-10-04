import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverOtp } from './otpDeliveryService';

test('production demo-log mode requires an explicit demo flag', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.OTP_DELIVERY_MODE;
  const previousFlag = process.env.ENABLE_DEMO_OTP_LOGGING;
  process.env.NODE_ENV = 'production';
  process.env.OTP_DELIVERY_MODE = 'demo-log';
  delete process.env.ENABLE_DEMO_OTP_LOGGING;
  try {
    await assert.rejects(
      deliverOtp({ email: 'demo@example.com', fullName: 'Demo', otpCode: '123456', expiresMinutes: 3 }),
      /explicit demo OTP logging flag/
    );
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.OTP_DELIVERY_MODE = previousMode;
    process.env.ENABLE_DEMO_OTP_LOGGING = previousFlag;
  }
});

test('explicit demo-log mode writes the OTP to the server log', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.OTP_DELIVERY_MODE;
  const previousFlag = process.env.ENABLE_DEMO_OTP_LOGGING;
  const originalWarn = console.warn;
  let logged = '';
  process.env.NODE_ENV = 'production';
  process.env.OTP_DELIVERY_MODE = 'demo-log';
  process.env.ENABLE_DEMO_OTP_LOGGING = 'true';
  console.warn = (message?: unknown) => { logged += String(message); };
  try {
    const result = await deliverOtp({ email: 'demo@example.com', fullName: 'Demo', otpCode: '654321', expiresMinutes: 3 });
    assert.equal(result.channel, 'demo-log');
    assert.match(logged, /654321/);
  } finally {
    console.warn = originalWarn;
    process.env.NODE_ENV = previousNodeEnv;
    process.env.OTP_DELIVERY_MODE = previousMode;
    process.env.ENABLE_DEMO_OTP_LOGGING = previousFlag;
  }
});

test('legacy private production flag restores the previous OTP log delivery when mode is unset', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.OTP_DELIVERY_MODE;
  const previousLegacyFlag = process.env.ENABLE_PRIVATE_DEMO_OTP_LOG;
  const previousFlag = process.env.ENABLE_DEMO_OTP_LOGGING;
  const originalWarn = console.warn;
  let logged = '';
  process.env.NODE_ENV = 'production';
  delete process.env.OTP_DELIVERY_MODE;
  process.env.ENABLE_PRIVATE_DEMO_OTP_LOG = 'true';
  delete process.env.ENABLE_DEMO_OTP_LOGGING;
  console.warn = (message?: unknown) => { logged += String(message); };
  try {
    const result = await deliverOtp({ email: 'demo@example.com', fullName: 'Demo', otpCode: '123456', expiresMinutes: 3 });
    assert.equal(result.channel, 'demo-log');
    assert.match(logged, /123456/);
    assert.match(logged, /DEMO ONLY/);
  } finally {
    console.warn = originalWarn;
    process.env.NODE_ENV = previousNodeEnv;
    process.env.OTP_DELIVERY_MODE = previousMode;
    process.env.ENABLE_PRIVATE_DEMO_OTP_LOG = previousLegacyFlag;
    process.env.ENABLE_DEMO_OTP_LOGGING = previousFlag;
  }
});

test('legacy private OTP flag does not override an explicitly selected provider', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.OTP_DELIVERY_MODE;
  const previousLegacyFlag = process.env.ENABLE_PRIVATE_DEMO_OTP_LOG;
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.OTP_FROM_EMAIL;
  process.env.NODE_ENV = 'production';
  process.env.OTP_DELIVERY_MODE = 'resend';
  process.env.ENABLE_PRIVATE_DEMO_OTP_LOG = 'true';
  delete process.env.RESEND_API_KEY;
  delete process.env.OTP_FROM_EMAIL;
  try {
    await assert.rejects(
      deliverOtp({ email: 'demo@example.com', fullName: 'Demo', otpCode: '123456', expiresMinutes: 3 }),
      /RESEND_API_KEY and OTP_FROM_EMAIL/
    );
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.OTP_DELIVERY_MODE = previousMode;
    process.env.ENABLE_PRIVATE_DEMO_OTP_LOG = previousLegacyFlag;
    process.env.RESEND_API_KEY = previousApiKey;
    process.env.OTP_FROM_EMAIL = previousFrom;
  }
});
