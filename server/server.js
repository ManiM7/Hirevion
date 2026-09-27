// Some hosts (Render's containers among them) have no outbound IPv6 route,
// but Node's default DNS resolution can still prefer an IPv6 address when
// a host has both A and AAAA records (as smtp.gmail.com does) — causing
// every outbound connection to that host to fail with ENETUNREACH even
// though IPv4 works fine. Preferring IPv4 first avoids that for every
// outbound call this process makes (SMTP, the Google Calendar API, etc.),
// not just the one that happened to surface it.
require('dns').setDefaultResultOrder('ipv4first');

const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');

(async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`[server] Hirevion API listening on port ${port}`);
  });
})();

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
