export default () => ({
  secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
  expiresIn: process.env.JWT_EXPIRES || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
});
