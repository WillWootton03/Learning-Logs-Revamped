const nodemailer = require('nodemailer');

/**
 * Outbound email for the app. Config comes from SMTP_* env vars (Gmail app
 * password is the expected setup). When SMTP is not configured — e.g. local
 * development before credentials are added — emails are logged to the console
 * instead, so verification flows still work end to end.
 */

class Mailer {
  /**
   * @param {object} [config]
   * @param {string} [config.host] - SMTP host (SMTP_HOST).
   * @param {string} [config.user] - SMTP username (SMTP_USER).
   * @param {string} [config.pass] - SMTP password/app password (SMTP_PASS).
   * @param {string} [config.port] - SMTP port, default 587.
   * @param {string} [config.secure] - 'true' for implicit TLS (SMTP_SECURE).
   * @param {string} [config.from] - Sender address (MAIL_FROM).
   * @param {string} [config.frontendUrl] - Frontend origin for links.
   */
  constructor({
    host = process.env.SMTP_HOST,
    user = process.env.SMTP_USER,
    pass = process.env.SMTP_PASS,
    port = process.env.SMTP_PORT,
    secure = process.env.SMTP_SECURE,
    from = process.env.MAIL_FROM,
    frontendUrl = process.env.FRONTEND_URL,
  } = {}) {
    this.frontendUrl = frontendUrl || 'http://localhost:5173';
    this.from = from || `Learning Logs <${user || 'noreply@learninglogs.app'}>`;

    this.transporter =
      host && user
        ? nodemailer.createTransport({
            host,
            port: Number(port || 587),
            secure: secure === 'true',
            auth: { user, pass },
          })
        : null;
  }

  /** True when SMTP is configured (a transporter exists). */
  isConfigured() {
    return this.transporter !== null;
  }

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
  async sendVerificationEmail(to, { code }) {
    const verifyUrl = `${this.frontendUrl}/verify?token=${encodeURIComponent(code)}`;
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

    if (!this.transporter) {
      console.log(`[mailer:dev] verification code for ${to}: ${code}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
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
  async sendPasswordResetEmail(to, { token }) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
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

    if (!this.transporter) {
      console.log(`[mailer:dev] password reset token for ${to}: ${token}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      console.error('[mailer] failed to send password reset email:', err.message);
    }
  }
}

const mailer = new Mailer();

module.exports = { Mailer, mailer };
