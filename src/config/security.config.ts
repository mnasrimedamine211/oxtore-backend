export default () => ({
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
});
