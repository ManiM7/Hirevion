require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/jobbridge'),

  jwtSecret: process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'jb_token',

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'Hirevion <no-reply@hirevion.local>',
  },

  // Many cloud hosts (Render's containers among them) block outbound SMTP
  // ports entirely, so raw SMTP works locally but hangs/times out in
  // production. SendGrid sends over HTTPS instead and is used in
  // preference to SMTP whenever it's configured — see emailService.js.
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    from: process.env.SENDGRID_FROM || process.env.SMTP_FROM || '',
  },

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxResumeSize: parseInt(process.env.MAX_RESUME_SIZE || process.env.MAX_FILE_SIZE || '5242880', 10),
  maxPhotoSize: parseInt(process.env.MAX_PHOTO_SIZE || '2097152', 10),

  aiProvider: process.env.AI_PROVIDER || '',
  aiApiKey: process.env.AI_API_KEY || '',

  loginRateLimitMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
  loginRateLimitWindowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    // The Gmail address the refresh token above was granted for — used as
    // the "From" address when sending real mail via the Gmail API instead
    // of SMTP (see services/gmailService.js). Sends over HTTPS, so it
    // works on hosts that block outbound SMTP ports (e.g. Render).
    gmailSenderEmail: process.env.GMAIL_SENDER_EMAIL || '',
  },
};
