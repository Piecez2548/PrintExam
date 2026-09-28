export function isPrivateDemoOtpLoggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' && env.ENABLE_PRIVATE_DEMO_OTP_LOG === 'true';
}
