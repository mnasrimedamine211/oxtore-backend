import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  provider: process.env.MAIL_PROVIDER || 'gmail',
  gmailEmail: process.env.GMAIL_EMAIL || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  mailtrapHost: process.env.MAILTRAP_HOST || '',
  mailtrapPort: parseInt(process.env.MAILTRAP_PORT || '587', 10),
  mailtrapUser: process.env.MAILTRAP_USER || '',
  mailtrapPass: process.env.MAILTRAP_PASS || '',
  fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@oxtore.com',
  fromName: process.env.MAIL_FROM_NAME || 'Oxtore',
}));
