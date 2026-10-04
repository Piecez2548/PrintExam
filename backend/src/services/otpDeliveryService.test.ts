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
      /ENABLE_DEMO_OTP_LOGGING/
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
