import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  // 'ethereal' needs zero setup (auto-provisions a free throwaway test inbox at boot,
  // logs a preview link per email) — good default until real Gmail/Mailtrap creds are supplied.
  provider: process.env.MAIL_PROVIDER || 'ethereal',
  gmailEmail: process.env.GMAIL_EMAIL || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  mailtrapHost: process.env.MAILTRAP_HOST || '',
  mailtrapPort: parseInt(process.env.MAILTRAP_PORT || '587', 10),
  mailtrapUser: process.env.MAILTRAP_USER || '',
  mailtrapPass: process.env.MAILTRAP_PASS || '',
  // Resend sends over HTTPS (not SMTP), so it works on hosts that block outbound SMTP (e.g. Railway).
  // 'onboarding@resend.dev' is Resend's shared sender for unverified accounts — works with any
  // recipient with zero setup; switch to a verified domain's address once you have one.
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  // SendGrid also sends over HTTPS. Unlike Resend, its "Single Sender Verification" lets a plain
  // email address (no owned domain required) send to ANY recipient once that address is verified
  // in the SendGrid dashboard — the from address below must match that verified sender exactly.
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'oxtore.noreply@gmail.com',
  fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@oxtore.com',
  fromName: process.env.MAIL_FROM_NAME || 'Oxtore',
}));
