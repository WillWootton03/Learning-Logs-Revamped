const nodemailer = require('nodemailer');

/**
 * Outbound email for the app. Config comes from SMTP_* env vars (Gmail app
 * password is the expected setup). When SMTP is not configured — e.g. local
 * development before credentials are added — emails are logged to the console
 * instead, so verification flows still work end to end.
 */

const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;

const transporter = smtpHost && smtpUser
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const MAIL_FROM = process.env.MAIL_FROM || `LearnBoard <${smtpUser || 'noreply@learnboard.app'}>`;

/**
 * Email a verification code (a stateless JWT) to the user. The body carries
 * both a clickable "Verify email" link and the raw code, so it works whether
 * the client renders HTML links or the user pastes the code manually.
 * Never throws on delivery failure — the token itself needs no server state,
 * and a failed send is recoverable through POST /auth/resend-verification.
 * @param {string} to - Recipient email.
 * @param {{code: string}} opts - The signed verification token.
 * @returns {Promise<void>}
 */
async function sendVerificationEmail(to, { code }) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/verify?token=${encodeURIComponent(code)}`;
  const subject = 'Verify your Learning Logs email';
  const text = [
    `Hi!`,
    ``,
    `Welcome to Learning Logs. Verify your email to start learning:`,
    ``,
    verifyUrl,
    ``,
    `Or paste this code into the verification box: ${code}`,
    ``,
    `This code expires in 24 hours. If you didn't create a Learning Logs account, you can safely ignore this email.`,
  ].join('\n');

  if (!transporter) {
    console.log(`[mailer:dev] verification code for ${to}: ${code}`);
    return;
  }

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text });
  } catch (err) {
    console.error('[mailer] failed to send verification email:', err.message);
  }
}

/**
 * Email a password-reset link to the user. The token is a random hex string
 * stored in the password_resets table; the link points at the frontend
 * reset-password page, which swaps it for a new password.
 * @param {string} to - Recipient email.
 * @param {{token: string}} opts - The stored reset token.
 * @returns {Promise<void>}
 */
async function sendPasswordResetEmail(to, { token }) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your Learning Logs password';
  const text = [
    `Hi!`,
    ``,
    `We received a request to reset your Learning Logs password. Click the link below to choose a new one:`,
    ``,
    resetUrl,
    ``,
    `This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.`,
  ].join('\n');

  if (!transporter) {
    console.log(`[mailer:dev] password reset token for ${to}: ${token}`);
    return;
  }

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text });
  } catch (err) {
    console.error('[mailer] failed to send password reset email:', err.message);
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
