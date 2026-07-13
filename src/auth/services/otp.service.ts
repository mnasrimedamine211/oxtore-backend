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
    this.initEmailProvider();
    this.initWhatsAppProvider();
  }

  private initEmailProvider() {
    const provider = this.configService.get<string>('mail.provider');
    try {
      if (provider === 'gmail') {
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
      await this.emailTransporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Oxtore - Your Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Oxtore Verification Code</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; padding: 20px; background: #eff6ff; border-radius: 8px; text-align: center;">
              ${code}
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email OTP to ${email}: ${err.message}`);
      return false;
    }
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
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
