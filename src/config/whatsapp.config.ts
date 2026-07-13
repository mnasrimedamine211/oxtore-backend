export default () => ({
  provider: process.env.WHATSAPP_PROVIDER || 'twilio',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhone: process.env.TWILIO_PHONE || '',
  metaToken: process.env.META_WHATSAPP_TOKEN || '',
  metaPhoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
});
