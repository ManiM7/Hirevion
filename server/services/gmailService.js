const { google } = require('googleapis');
const { google: googleConfig } = require('../config/env');

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

/**
 * Sends real mail via the Gmail API (HTTPS) instead of raw SMTP. Uses the
 * same OAuth client/refresh token as googleMeetService — one Google
 * account, one consent grant covering both Calendar and Gmail send scopes
 * (see utils/googleAuthSetup.js). Works on hosts that block outbound SMTP
 * ports (Render's free tier among them), since it's a normal HTTPS call.
 */
function isConfigured() {
  return Boolean(
    googleConfig.clientId && googleConfig.clientSecret && googleConfig.refreshToken && googleConfig.gmailSenderEmail
  );
}

function getOAuthClient() {
  const client = new google.auth.OAuth2(googleConfig.clientId, googleConfig.clientSecret, googleConfig.redirectUri);
  client.setCredentials({ refresh_token: googleConfig.refreshToken });
  return client;
}

function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
}

/** Builds a base64url-encoded multipart/alternative RFC 2822 message, as the Gmail API's `raw` field requires. */
function buildRawMessage({ from, to, subject, html, text }) {
  const boundary = `hirevion_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text || '',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html || '',
    '',
    `--${boundary}--`,
  ];
  const message = lines.join('\r\n');
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    const err = new Error(
      'Gmail API is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN and GMAIL_SENDER_EMAIL in the server .env file.'
    );
    err.code = 'GMAIL_NOT_CONFIGURED';
    throw err;
  }

  const auth = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = buildRawMessage({ from: googleConfig.gmailSenderEmail, to, subject, html, text });
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

module.exports = { isConfigured, sendMail, GMAIL_SEND_SCOPE };
