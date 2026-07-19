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
  fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@oxtore.com',
  fromName: process.env.MAIL_FROM_NAME || 'Oxtore',
}));
