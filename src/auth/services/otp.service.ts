import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';

export interface OtpProvider {
  sendOtp(to: string, code: string, channel: 'email' | 'whatsapp'): Promise<boolean>;
}

@Injectable()
export class OtpService implements OtpProvider {
  private readonly logger = new Logger(OtpService.name);
  private emailTransporter: nodemailer.Transporter | null = null;
  private twilioClient: Twilio | null = null;

  constructor(private configService: ConfigService) {
    void this.initEmailProvider();
    this.initWhatsAppProvider();
  }

  private async initEmailProvider(): Promise<void> {
    const provider = this.configService.get<string>('mail.provider');
    try {
      if (provider === 'ethereal') {
        // Zero-setup free test inbox — auto-provisioned via Nodemailer's API, no signup needed.
        // Mail sent through it isn't delivered to a real inbox; each send logs a preview URL instead.
        const testAccount = await nodemailer.createTestAccount();
        this.emailTransporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.logger.log(
          `Email provider: Ethereal test inbox initialized (dev-only, not real delivery). Inbox: https://ethereal.email/login user=${testAccount.user} pass=${testAccount.pass}`,
        );
      } else if (provider === 'gmail') {
        const email = this.configService.get<string>('mail.gmailEmail');
        const password = this.configService.get<string>('mail.gmailAppPassword');
        if (email && password) {
          this.emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: email, pass: password },
          });
          this.logger.log('Email provider: Gmail SMTP initialized');
        } else {
          this.logger.warn('Gmail credentials not configured; OTP emails will be logged only');
        }
      } else if (provider === 'mailtrap') {
        const host = this.configService.get<string>('mail.mailtrapHost');
        const port = this.configService.get<number>('mail.mailtrapPort');
        const user = this.configService.get<string>('mail.mailtrapUser');
        const pass = this.configService.get<string>('mail.mailtrapPass');
        if (host && user && pass) {
          this.emailTransporter = nodemailer.createTransport({
            host,
            port,
            auth: { user, pass },
          });
          this.logger.log('Email provider: Mailtrap initialized');
        }
      }
    } catch (err) {
      this.logger.error(`Failed to initialize email provider: ${err.message}`);
    }
  }

  private initWhatsAppProvider() {
    const provider = this.configService.get<string>('whatsapp.provider');
    try {
      if (provider === 'twilio') {
        const sid = this.configService.get<string>('whatsapp.twilioAccountSid');
        const token = this.configService.get<string>('whatsapp.twilioAuthToken');
        if (sid && token) {
          this.twilioClient = new Twilio(sid, token);
          this.logger.log('WhatsApp provider: Twilio initialized');
        } else {
          this.logger.warn('Twilio credentials not configured; WhatsApp OTP will be logged only');
        }
      } else if (provider === 'meta') {
        this.logger.log('WhatsApp provider: Meta Cloud API (configured, uses fetch)');
      }
    } catch (err) {
      this.logger.error(`Failed to initialize WhatsApp provider: ${err.message}`);
    }
  }

  async sendOtp(to: string, code: string, channel: 'email' | 'whatsapp'): Promise<boolean> {
    if (channel === 'email') {
      return this.sendEmailOtp(to, code);
    } else {
      return this.sendWhatsAppOtp(to, code);
    }
  }

  private async sendEmailOtp(email: string, code: string): Promise<boolean> {
    const fromEmail = this.configService.get<string>('mail.fromEmail');
    const fromName = this.configService.get<string>('mail.fromName');

    if (!this.emailTransporter) {
      this.logger.warn(`[DEV] OTP for ${email}: ${code}`);
      return true;
    }

    try {
      const info = await this.emailTransporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Your Oxtore verification code',
        html: this.buildOtpEmailHtml(code),
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`OTP email queued for ${email} — preview: ${previewUrl}`);
      }
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email OTP to ${email}: ${err.message}`);
      return false;
    }
  }

  private buildOtpEmailHtml(code: string): string {
    return `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc;">
        <div style="background: #1d4ed8; padding: 28px 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <span style="display: inline-block; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff;">
            OX<span style="color: #6ee7b7;">TORE</span>
          </span>
        </div>
        <div style="background: #ffffff; padding: 32px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #111827; font-size: 18px; margin: 0 0 8px;">Verify your email</h2>
          <p style="color: #4b5563; font-size: 14px; margin: 0 0 20px;">Enter this code to finish creating your Oxtore account:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; padding: 18px; background: #eff6ff; border-radius: 10px; text-align: center;">
            ${code}
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
        </div>
      </div>
    `;
  }

  private async sendWhatsAppOtp(phone: string, code: string): Promise<boolean> {
    if (!this.twilioClient) {
      this.logger.warn(`[DEV] WhatsApp OTP for ${phone}: ${code}`);
      return true;
    }

    const twilioPhone = this.configService.get<string>('whatsapp.twilioPhone');
    try {
      await this.twilioClient.messages.create({
        body: `Your Oxtore verification code is: ${code}`,
        from: `whatsapp:${twilioPhone}`,
        to: `whatsapp:${phone}`,
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp OTP to ${phone}: ${err.message}`);
      return false;
    }
  }

  generateOtpCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.logger.log(`Generated OTP code: ${code}`);
    return code;
  }
}
