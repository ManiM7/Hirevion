const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const gmailService = require('./gmailService');
const { smtp, sendgrid, clientUrl, nodeEnv } = require('../config/env');

let transporter = null;
let sendgridConfigured = false;

function getTransporter() {
  if (transporter) return transporter;
  if (!smtp.host || !smtp.user || !smtp.pass) return null;
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return transporter;
}

/** SendGrid sends over HTTPS, so it works on hosts that block outbound
 * SMTP ports (Render's free tier among them) — preferred over SMTP
 * whenever it's configured. */
function getSendgrid() {
  if (!sendgrid.apiKey || !sendgrid.from) return null;
  if (!sendgridConfigured) {
    sgMail.setApiKey(sendgrid.apiKey);
    sendgridConfigured = true;
  }
  return sgMail;
}

/**
 * Sends an email via the Gmail API, then SendGrid, then SMTP — whichever
 * is configured first. Throws if none are configured or the send fails —
 * callers must not pretend an email was sent when it wasn't (see spec
 * section 40).
 */
async function sendMail({ to, subject, html, text }) {
  if (gmailService.isConfigured()) {
    await gmailService.sendMail({ to, subject, html, text });
    return;
  }

  const sg = getSendgrid();
  if (sg) {
    await sg.send({ to, from: sendgrid.from, subject, html, text });
    return;
  }

  const t = getTransporter();
  if (!t) {
    const err = new Error(
      'Email delivery is not configured. Set up Gmail API (GOOGLE_CLIENT_ID/SECRET, GOOGLE_REFRESH_TOKEN, GMAIL_SENDER_EMAIL), or SENDGRID_API_KEY + SENDGRID_FROM, or SMTP_HOST + SMTP_USER + SMTP_PASS, in the server .env file.'
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  await t.sendMail({ from: smtp.from, to, subject, html, text });
}

async function sendTemporaryPasswordEmail({ to, fullName, temporaryPassword }) {
  const loginUrl = `${clientUrl}/login`;
  const subject = 'Your Hirevion account has been created';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2>Welcome to Hirevion, ${fullName}</h2>
      <p>Your account has been created successfully.</p>
      <p><strong>Temporary password:</strong></p>
      <p style="font-size: 18px; font-family: monospace; background: #f3f4f6; padding: 12px; border-radius: 6px;">${temporaryPassword}</p>
      <p><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
      <p>You must change this temporary password after your first login.</p>
    </div>
  `;
  const text = `Welcome to Hirevion, ${fullName}.\n\nYour temporary password: ${temporaryPassword}\nLogin: ${loginUrl}\n\nYou must change this temporary password after your first login.`;
  await sendMail({ to, subject, html, text });
}

async function sendPasswordChangedEmail({ to, fullName }) {
  const subject = 'Your Hirevion password was changed';
  const html = `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2>Hi ${fullName},</h2>
      <p>Your Hirevion account password was changed successfully. If this wasn't you, contact support immediately.</p>
    </div>`;
  await sendMail({ to, subject, html, text: `Hi ${fullName}, your Hirevion password was changed successfully.` });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const subject = 'Reset your Hirevion password';
  const html = `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2>Password reset requested</h2>
      <p>Click the link below to set a new password. This link expires in 15 minutes.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  await sendMail({ to, subject, html, text: `Reset your password: ${resetUrl} (expires in 15 minutes)` });
}

module.exports = {
  sendMail,
  sendTemporaryPasswordEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  isConfigured: () => !!(gmailService.isConfigured() || getSendgrid() || getTransporter()),
};

if (nodeEnv !== 'production' && !gmailService.isConfigured() && !getSendgrid() && !getTransporter()) {
  console.warn('[email] Not configured — emails will fail to send until Gmail API, SendGrid, or SMTP is set up in .env');
}
