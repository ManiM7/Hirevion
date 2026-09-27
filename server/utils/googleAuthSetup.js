/**
 * One-time interactive setup for Google Calendar/Meet AND Gmail-API
 * sending — a single consent grant covers both, since they share one
 * OAuth client and refresh token.
 *
 * Prerequisite: create an OAuth 2.0 Client ID (type "Desktop app") in the
 * Google Cloud Console for a project with the Google Calendar API AND the
 * Gmail API enabled, and put its Client ID/Secret in server/.env as
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET first.
 *
 * Usage:
 *   npm run google:auth
 *
 * This starts a temporary local server, opens (or prints) a Google consent
 * URL — sign in with the Google account that should organize interview
 * meetings and send registration emails, and approve access. Google
 * redirects back to this local server automatically with the
 * authorization code (no manual copy-paste; the old "oob" copy-paste flow
 * is deprecated by Google for OAuth clients created after Feb 2022 and
 * will fail for a newly created client). The script exchanges that code
 * for a refresh token and prints it — copy it into server/.env as
 * GOOGLE_REFRESH_TOKEN (replacing any earlier one — it now needs to cover
 * both scopes). Nothing is written to the database; the token only ever
 * lives in your .env file.
 */
require('dotenv').config();
const http = require('http');
const { URL } = require('url');
const googleMeetService = require('../services/googleMeetService');
const gmailService = require('../services/gmailService');
const { google } = require('../config/env');

async function main() {
  if (!google.clientId || !google.clientSecret) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env before running this script.');
    process.exit(1);
  }

  // Start the loopback server first so we know which port to put in the
  // redirect URI before generating the consent URL.
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const codePromise = new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        error
          ? `<h2>Authorization failed: ${error}</h2><p>Close this tab and check the terminal.</p>`
          : '<h2>Hirevion: Google account connected — you can close this tab.</h2>'
      );
      if (error) reject(new Error(error));
      else if (code) resolve(code);
      else reject(new Error('No authorization code received'));
    });
  });

  const authUrl = googleMeetService.getAuthUrl(redirectUri, [googleMeetService.CALENDAR_SCOPE, gmailService.GMAIL_SEND_SCOPE]);
  console.log('\nOpen this URL in your browser and approve access with the Google account\nthat should organize interview meetings and send registration emails:\n');
  console.log(authUrl);
  console.log('\nWaiting for you to approve access...');

  try {
    const code = await codePromise;
    const tokens = await googleMeetService.exchangeCodeForTokens(code, redirectUri);
    server.close();

    if (!tokens.refresh_token) {
      console.error(
        '\nNo refresh_token was returned. This usually means this Google account already granted access before — revoke it at https://myaccount.google.com/permissions and run this script again.'
      );
      process.exit(1);
    }

    console.log('\nSuccess! Update these lines in server/.env:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('GMAIL_SENDER_EMAIL=<the Gmail address you just signed in with>');
    console.log('\nThen restart the server. Interview scheduling will create real Google Meet links, and registration/reset emails will send via the Gmail API.');
    process.exit(0);
  } catch (err) {
    server.close();
    console.error('\nFailed to complete Google authorization:', err.message);
    process.exit(1);
  }
}

main();
