/**
 * Outbound email.
 *
 * Two safety properties matter here, because every template interpolates
 * user-controlled text (a patient's name, a medicine name) into content that is
 * delivered to a third party:
 *
 *  1. **Header injection.** A name containing CR/LF could otherwise inject
 *     extra headers — a Bcc, a different Reply-To — into the message. Anything
 *     reaching a header is stripped of control characters and length-capped.
 *  2. **HTML injection.** Names go through `escapeHtml` before they reach the
 *     body, so `<script>` or a spoofed link renders as text.
 *
 * Email is optional. When SMTP is unconfigured, sends are skipped and reported
 * as `skipped` rather than throwing — the alert is still recorded in-app, so
 * the caregiver dashboard remains correct.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { emailEnabled, env } from '../config/env.js';
import { childLogger } from '../config/logger.js';

const log = childLogger('email');

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!emailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      // Bound the pool so a burst of alerts cannot open dozens of connections.
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
    });
  }
  return transporter;
}

/* ──────────────────────────── Sanitisation ──────────────────────────────── */

/**
 * Strip anything that could break out of a header value.
 *
 * Removes CR, LF and other control characters, then caps the length. Applied to
 * every interpolation that reaches a subject line or address display name.
 */
export function safeHeader(value: string, maxLength = 120): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Escape text destined for the HTML body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fromAddress(): string {
  const name = safeHeader(env.EMAIL_FROM_NAME, 60);
  const address = env.EMAIL_FROM_ADDRESS ?? env.SMTP_USER ?? 'no-reply@medtrack.app';
  return `"${name}" <${address}>`;
}

/* ──────────────────────────────── Sending ───────────────────────────────── */

export type SendResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send({ to, subject, html, text }: SendOptions): Promise<SendResult> {
  const mailer = getTransporter();
  if (!mailer) {
    log.debug({ to: '[redacted]' }, 'Email skipped — SMTP not configured');
    return { status: 'skipped', reason: 'SMTP not configured' };
  }

  try {
    await mailer.sendMail({
      from: fromAddress(),
      to,
      subject: safeHeader(subject, 200),
      html,
      text,
    });
    return { status: 'sent' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ err: message }, 'Email send failed');
    return { status: 'failed', error: message.slice(0, 500) };
  }
}

/* ──────────────────────────────── Layout ───────────────────────────────── */

const BRAND = '#1B2B4B';
const MUTED = '#64748B';

function layout(options: {
  heading: string;
  accent: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;">
    <tr><td style="padding:28px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${options.accent};">MedTrack</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${BRAND};">${options.heading}</h1>
      ${options.bodyHtml}
    </td></tr>
    <tr><td style="padding:0 28px 24px;">
      <hr style="border:none;border-top:1px solid #E2E8F0;margin:0 0 14px;" />
      <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
        ${options.footerNote ?? 'You are receiving this because you are listed as a caregiver in MedTrack.'}
        <br />MedTrack is a reminder tool, not a medical device. It does not provide medical advice.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

/* ──────────────────────────────── Templates ─────────────────────────────── */

export interface CaregiverAlertEmail {
  to: string;
  caregiverName: string;
  patientName: string;
  medicineName?: string;
  missCount?: number;
}

export async function sendConsecutiveMissEmail(input: CaregiverAlertEmail): Promise<SendResult> {
  const patient = escapeHtml(safeHeader(input.patientName));
  const medicine = escapeHtml(safeHeader(input.medicineName ?? 'their medicine'));
  const count = input.missCount ?? 2;

  return send({
    to: input.to,
    subject: `${safeHeader(input.patientName)} has missed ${medicine ? safeHeader(input.medicineName ?? '') : 'a medicine'} ${count} times`,
    text: `${input.patientName} has missed ${input.medicineName ?? 'a medicine'} ${count} times in a row. It may be worth checking in.`,
    html: layout({
      accent: '#B45309',
      heading: 'Repeated missed doses',
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BRAND};">
          <strong>${patient}</strong> has missed <strong>${medicine}</strong> <strong>${count} times in a row</strong>.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
          It may be worth checking in with them.
        </p>`,
    }),
  });
}

export async function sendCriticalMissEmail(input: CaregiverAlertEmail): Promise<SendResult> {
  const patient = escapeHtml(safeHeader(input.patientName));
  const medicine = escapeHtml(safeHeader(input.medicineName ?? 'a critical medicine'));

  return send({
    to: input.to,
    subject: `${safeHeader(input.patientName)} missed a critical dose`,
    text: `${input.patientName} has missed a dose of ${input.medicineName ?? 'a critical medicine'}, which is marked critical.`,
    html: layout({
      accent: '#DC2626',
      heading: 'Critical dose missed',
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BRAND};">
          <strong>${patient}</strong> has missed a dose of <strong>${medicine}</strong>, which is marked as critical.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
          Please check in with them as soon as you can.
        </p>`,
    }),
  });
}

export async function sendSosEmail(input: CaregiverAlertEmail & {
  timestamp: string;
  message?: string | null;
}): Promise<SendResult> {
  const patient = escapeHtml(safeHeader(input.patientName));
  const note = input.message ? escapeHtml(safeHeader(input.message, 500)) : null;

  return send({
    to: input.to,
    subject: `Emergency: ${safeHeader(input.patientName)} triggered an SOS`,
    text: `${input.patientName} triggered an emergency SOS at ${input.timestamp}.${input.message ? ` Message: ${input.message}` : ''}`,
    html: layout({
      accent: '#DC2626',
      heading: 'Emergency SOS',
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:${BRAND};">
          <strong>${patient}</strong> triggered an emergency SOS.
        </p>
        ${note ? `<p style="margin:0 0 12px;padding:12px;background:#FEF2F2;border-radius:8px;font-size:14px;color:#7F1D1D;">${note}</p>` : ''}
        <p style="margin:0;font-size:14px;color:${MUTED};">Time: ${escapeHtml(safeHeader(input.timestamp))}</p>`,
    }),
  });
}

export async function sendLowStockEmail(input: CaregiverAlertEmail & {
  dosesRemaining: number;
}): Promise<SendResult> {
  const patient = escapeHtml(safeHeader(input.patientName));
  const medicine = escapeHtml(safeHeader(input.medicineName ?? 'a medicine'));

  return send({
    to: input.to,
    subject: `${safeHeader(input.patientName)} is running low on ${safeHeader(input.medicineName ?? 'a medicine')}`,
    text: `${input.patientName} has about ${input.dosesRemaining} doses of ${input.medicineName ?? 'a medicine'} left.`,
    html: layout({
      accent: '#B45309',
      heading: 'Running low on a medicine',
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND};">
          <strong>${patient}</strong> has about <strong>${input.dosesRemaining} doses</strong> of <strong>${medicine}</strong> left.
        </p>`,
    }),
  });
}

export async function sendCaregiverInviteEmail(input: {
  to: string;
  patientName: string;
  relation: string;
  acceptUrl: string;
}): Promise<SendResult> {
  const patient = escapeHtml(safeHeader(input.patientName));
  const relation = escapeHtml(safeHeader(input.relation, 60));
  const url = encodeURI(input.acceptUrl);

  return send({
    to: input.to,
    subject: `${safeHeader(input.patientName)} would like you as their caregiver on MedTrack`,
    text: `${input.patientName} has invited you to be their caregiver (${input.relation}) on MedTrack. Accept: ${input.acceptUrl}`,
    html: layout({
      accent: BRAND,
      heading: 'A caregiver invitation',
      bodyHtml: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND};">
          <strong>${patient}</strong> has invited you to support them on MedTrack as their <strong>${relation}</strong>.
        </p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${MUTED};">
          You will be able to see what they have chosen to share, and you will be notified if they miss important doses.
          They can change or withdraw your access at any time.
        </p>
        <a href="${url}" style="display:inline-block;padding:12px 20px;background:${BRAND};color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Review the invitation</a>
        <p style="margin:16px 0 0;font-size:12px;color:${MUTED};">This invitation expires in 14 days.</p>`,
      footerNote: 'You received this because someone entered your email address as a caregiver. If that was not expected, you can ignore this message.',
    }),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<SendResult> {
  const url = encodeURI(input.resetUrl);

  return send({
    to: input.to,
    subject: 'Reset your MedTrack password',
    text: `Reset your MedTrack password: ${input.resetUrl}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
    html: layout({
      accent: BRAND,
      heading: 'Reset your password',
      bodyHtml: `
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND};">
          Use the button below to choose a new password.
        </p>
        <a href="${url}" style="display:inline-block;padding:12px 20px;background:${BRAND};color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Choose a new password</a>
        <p style="margin:16px 0 0;font-size:12px;color:${MUTED};">This link expires in 1 hour. If you did not ask to reset your password, you can ignore this email — nothing has changed.</p>`,
      footerNote: 'You received this because a password reset was requested for your MedTrack account.',
    }),
  });
}

/** Probe SMTP at boot so misconfiguration is visible immediately, not at 3am. */
export async function verifyEmailConnection(): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) {
    log.warn('Email is not configured — caregiver alerts will be recorded in-app only');
    return false;
  }
  try {
    await mailer.verify();
    log.info('Email transport ready');
    return true;
  } catch (error) {
    log.error({ err: (error as Error).message }, 'Email transport failed verification');
    return false;
  }
}
