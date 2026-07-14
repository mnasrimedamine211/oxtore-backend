import { registerAs } from '@nestjs/config';

export default registerAs('swagger', () => ({
  title: 'Oxtore API',
  description: 'Mobile Marketplace Backend API',
  version: '1.0.0',
  path: process.env.SWAGGER_PATH || 'api',
}));
