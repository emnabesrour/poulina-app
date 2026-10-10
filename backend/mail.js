const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');

const OUTBOX_DIR = path.join(__dirname, 'data', 'mails');

function ensureOutbox() {
  if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });
}

function getSmtpConfig() {
  const db = readDb();
  const fromDb = db.smtp || {};
  return {
    host: process.env.MAIL_HOST || fromDb.host || '',
    port: Number(process.env.MAIL_PORT || fromDb.port || 587),
    secure: String(process.env.MAIL_SECURE || fromDb.secure || 'false') === 'true',
    user: process.env.MAIL_USER || fromDb.user || '',
    pass: process.env.MAIL_PASS || fromDb.pass || '',
    from: process.env.MAIL_FROM || fromDb.from || 'Gestion Materiel Poulina <noreply@poulina.tn>'
  };
}

function smtpReady() {
  const c = getSmtpConfig();
  return !!(c.host && c.user && c.pass);
}

/**
 * Envoi mail :
 * - si SMTP configuré (.env ou Centre Sécurité) → vrai envoi Gmail
 * - sinon → SIMULE (toujours enregistré en boîte)
 */
async function sendMail({ to, subject, html, text, type = 'SYSTEME' }) {
  ensureOutbox();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const record = {
    id,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' '),
    type,
    status: 'EN_ATTENTE',
    createdAt,
    error: null,
    read: false
  };

  const db = readDb();
  if (!db.mails) db.mails = [];
  db.mails.unshift(record);
  db.mails = db.mails.slice(0, 300);
  writeDb(db);

  const smtp = getSmtpConfig();
  if (smtp.host && smtp.user && smtp.pass) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass }
      });
      await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        html,
        text: record.text
      });
      record.status = 'ENVOYE';
    } catch (err) {
      record.status = 'ECHEC';
      record.error = err.message;
      console.error('Envoi mail échoué:', err.message);
    }
  } else {
    record.status = 'SIMULE';
    const file = path.join(OUTBOX_DIR, `${id}.html`);
    fs.writeFileSync(
      file,
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif">
        <p><strong>À:</strong> ${to}</p>
        <p><strong>Sujet:</strong> ${subject}</p>
        <hr/>${html}</body></html>`,
      'utf8'
    );
  }

  const db2 = readDb();
  const idx = (db2.mails || []).findIndex((m) => m.id === id);
  if (idx !== -1) {
    db2.mails[idx] = record;
    writeDb(db2);
  }
  return record;
}

function mailTemplate({ title, body, footer }) {
  return `
  <div style="background:#f4f6f9;padding:24px;font-family:Segoe UI,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dbe3ef">
      <div style="background:#0B2C5F;color:#fff;padding:18px 22px">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Poulina Group Holding</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">${title}</div>
      </div>
      <div style="padding:22px;color:#1e293b;line-height:1.55;font-size:15px">${body}</div>
      <div style="padding:14px 22px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">
        ${footer || 'Message automatique — Système de gestion de matériel Poulina. Ne pas répondre.'}
      </div>
    </div>
  </div>`;
}

module.exports = { sendMail, mailTemplate, getSmtpConfig, smtpReady };
