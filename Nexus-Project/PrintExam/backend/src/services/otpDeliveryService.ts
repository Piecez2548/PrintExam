interface OtpDeliveryInput {
  email: string;
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
}

export interface OtpDeliveryResult {
  channel: 'console' | 'demo-log' | 'resend';
}

function getDeliveryMode(env: NodeJS.ProcessEnv): string {
  if (env.OTP_DELIVERY_MODE) return env.OTP_DELIVERY_MODE;
  if (env.NODE_ENV === 'production') {
    // Compatibility with the previous production configuration. This is a
    // demo-only fallback and remains opt-in through the legacy private flag.
    return env.ENABLE_PRIVATE_DEMO_OTP_LOG === 'true' ? 'demo-log' : 'resend';
  }
  return 'console';
}

/**
 * Deliver OTP without ever returning it to the browser. Development defaults
 * to the terminal; production requires an explicitly configured provider.
 */
export async function deliverOtp(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
  const mode = getDeliveryMode(process.env);

  if (mode === 'console') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OTP console delivery is disabled in production');
    }
    console.log(`[2FA OTP] ${input.email} | ${input.otpCode} | expires in ${input.expiresMinutes} minutes`);
    return { channel: 'console' };
  }

  if (mode === 'demo-log') {
    const newDemoOptIn = process.env.ENABLE_DEMO_OTP_LOGGING === 'true';
    const legacyProductionOptIn = process.env.NODE_ENV === 'production'
      && process.env.ENABLE_PRIVATE_DEMO_OTP_LOG === 'true';
    if (!newDemoOptIn && !legacyProductionOptIn) {
      throw new Error('An explicit demo OTP logging flag is required for demo-log OTP delivery');
    }
    console.warn(JSON.stringify({
      type: 'demo_otp',
      warning: 'DEMO ONLY - OTP is visible to backend log viewers',
      recipient: input.email,
      otp: input.otpCode,
      expiresInMinutes: input.expiresMinutes,
    }));
    return { channel: 'demo-log' };
  }

  if (mode !== 'resend') throw new Error(`Unsupported OTP_DELIVERY_MODE: ${mode}`);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OTP_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and OTP_FROM_EMAIL are required for OTP delivery');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: 'รหัสยืนยันการเข้าสู่ระบบ PrintExam',
      text: `สวัสดี ${input.fullName}\n\nรหัส OTP ของคุณคือ ${input.otpCode}\nรหัสนี้มีอายุ ${input.expiresMinutes} นาที หากคุณไม่ได้เข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OTP provider rejected the request (${response.status}): ${detail.slice(0, 200)}`);
  }
  return { channel: 'resend' };
}
