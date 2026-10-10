const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');
const { sendMail, mailTemplate } = require('./mail');
const { locateIp } = require('./geo');

const loginAttempts = new Map();

function clientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function clientAgent(req) {
  return (req.headers['user-agent'] || 'Inconnu').toString().slice(0, 220);
}

function addSecurityLog({ type, severity = 'INFO', message, userId = null, login = null, ip = null, meta = {} }) {
  const db = readDb();
  if (!db.securityLogs) db.securityLogs = [];
  const entry = {
    id: uuidv4(),
    type,
    severity,
    message,
    userId,
    login,
    ip,
    meta,
    createdAt: new Date().toISOString()
  };
  db.securityLogs.unshift(entry);
  db.securityLogs = db.securityLogs.slice(0, 500);
  writeDb(db);
  return entry;
}

function isLocked(login, ip) {
  const key = `${ip}|${login}`;
  const state = loginAttempts.get(key);
  if (!state) return false;
  if (state.lockedUntil && Date.now() < state.lockedUntil) return true;
  if (state.lockedUntil && Date.now() >= state.lockedUntil) {
    loginAttempts.delete(key);
    return false;
  }
  return false;
}

function registerFailedLogin(login, ip) {
  const key = `${ip}|${login}`;
  const state = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  state.count += 1;
  if (state.count >= 5) {
    state.lockedUntil = Date.now() + 15 * 60 * 1000;
  }
  loginAttempts.set(key, state);
  return state;
}

function clearFailedLogin(login, ip) {
  loginAttempts.delete(`${ip}|${login}`);
}

function formatWhen(geo) {
  const opts = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  try {
    return new Date().toLocaleString('fr-FR', {
      ...opts,
      timeZone: geo.timezone || undefined
    });
  } catch {
    return new Date().toLocaleString('fr-FR', opts);
  }
}

function sessionDetailsHtml(geo, ip, userAgent) {
  return `
    <ul>
      <li><strong>Date & heure d'ouverture :</strong> ${formatWhen(geo)}</li>
      <li><strong>Localisation :</strong> ${geo.display || 'Non déterminée'}</li>
      <li><strong>Pays / ville :</strong> ${[geo.city, geo.country].filter(Boolean).join(' · ') || '—'}</li>
      <li><strong>Fuseau horaire :</strong> ${geo.timezone || '—'}</li>
      <li><strong>FAI / réseau :</strong> ${geo.isp || '—'}</li>
      <li><strong>IP :</strong> ${geo.ip || ip}${geo.localOrigin ? ` (origine locale ${geo.localOrigin})` : ''}</li>
      <li><strong>Navigateur :</strong> ${userAgent}</li>
    </ul>
  `;
}

function adminEmails() {
  const db = readDb();
  const fromDb = (db.utilisateurs || [])
    .filter((u) => u.role === 'ADMINISTRATEUR' && u.email)
    .map((u) => u.email);
  const extra = (process.env.MAIL_ADMIN_COPY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...fromDb, ...extra])];
}

async function notifyLoginSuccess(user, ip, userAgent = 'Inconnu') {
  const geo = await locateIp(ip);

  addSecurityLog({
    type: 'LOGIN_SUCCESS',
    severity: 'INFO',
    message: `Connexion réussie pour ${user.login} — ${geo.display}`,
    userId: user.id,
    login: user.login,
    ip: geo.ip || ip,
    meta: { geo, userAgent }
  });

  const body = `
    <p>Bonjour <strong>${user.prenom} ${user.nom}</strong>,</p>
    <p>Une connexion à votre compte <strong>${user.login}</strong> vient d'être détectée.</p>
    ${sessionDetailsHtml(geo, ip, userAgent)}
    <p>Si ce n'était pas vous, changez immédiatement votre mot de passe et contactez l'IT Poulina.</p>
  `;

  await sendMail({
    to: user.email,
    subject: `[Sécurité Poulina] Connexion — ${geo.city || geo.country || 'nouvelle session'} · ${new Date().toLocaleTimeString('fr-FR')}`,
    type: 'SECURITE',
    html: mailTemplate({ title: 'Alerte de connexion', body })
  });

  // Copie aux administrateurs (sauf si c'est déjà le même e-mail)
  for (const adminTo of adminEmails()) {
    if (adminTo.toLowerCase() === String(user.email).toLowerCase()) continue;
    await sendMail({
      to: adminTo,
      subject: `[Admin Sécurité] Connexion de ${user.login} — ${geo.display}`,
      type: 'SECURITE_ADMIN',
      html: mailTemplate({
        title: 'Supervision — connexion utilisateur',
        body: `
          <p>L'utilisateur <strong>${user.prenom} ${user.nom}</strong> (${user.login}, ${user.role}) s'est connecté.</p>
          ${sessionDetailsHtml(geo, ip, userAgent)}
        `
      })
    });
  }
}

async function notifyLoginFailure(login, ip, reason, userAgent = 'Inconnu') {
  const geo = await locateIp(ip);

  addSecurityLog({
    type: 'LOGIN_FAILURE',
    severity: 'WARNING',
    message: `Échec (${reason}) — ${login || '—'} — ${geo.display}`,
    login: login || null,
    ip: geo.ip || ip,
    meta: { geo, userAgent, reason }
  });

  const db = readDb();
  const user = db.utilisateurs.find((u) => u.login === login);
  if (user) {
    await sendMail({
      to: user.email,
      subject: '[Sécurité Poulina] Tentative de connexion échouée',
      type: 'SECURITE',
      html: mailTemplate({
        title: 'Tentative suspecte',
        body: `
          <p>Bonjour <strong>${user.prenom}</strong>,</p>
          <p>Une tentative de connexion échouée a été détectée (${reason}).</p>
          ${sessionDetailsHtml(geo, ip, userAgent)}
        `
      })
    });
  }

  for (const adminTo of adminEmails()) {
    await sendMail({
      to: adminTo,
      subject: `[Admin Sécurité] Échec login — ${login || 'inconnu'}`,
      type: 'SECURITE_ADMIN',
      html: mailTemplate({
        title: 'Supervision — échec de connexion',
        body: `
          <p>Tentative échouée pour <strong>${login || 'inconnu'}</strong> — ${reason}</p>
          ${sessionDetailsHtml(geo, ip, userAgent)}
        `
      })
    });
  }
}

async function notifyDemandeStatut(demande, user, materiel, statut) {
  const labels = { EN_ATTENTE: 'En attente', ACCEPTEE: 'Acceptée', REFUSEE: 'Refusée' };
  await sendMail({
    to: user.email,
    subject: `[Demande ${demande.reference}] Statut : ${labels[statut] || statut}`,
    type: 'DEMANDE',
    html: mailTemplate({
      title: 'Mise à jour de demande',
      body: `
        <p>Bonjour <strong>${user.prenom}</strong>,</p>
        <p>Votre demande <strong>${demande.reference}</strong> (${materiel?.libelle || 'matériel'}) est passée au statut :</p>
        <p style="font-size:18px;font-weight:700;color:#0B2C5F">${labels[statut] || statut}</p>
        <p>Quantité : ${demande.quantite}</p>
        <p><strong>Heure de notification :</strong> ${new Date().toLocaleString('fr-FR')}</p>
      `
    })
  });
}

async function notifyAccountCreated(user, tempPassword) {
  return sendMail({
    to: user.email,
    subject: '[Poulina] Votre compte Gestion Matériel',
    type: 'COMPTE',
    html: mailTemplate({
      title: 'Bienvenue',
      body: `
        <p>Bonjour <strong>${user.prenom} ${user.nom}</strong>,</p>
        <p>Votre compte a été créé sur le système de gestion de matériel Poulina.</p>
        <ul>
          <li><strong>Login :</strong> ${user.login}</li>
          <li><strong>Mot de passe temporaire :</strong> ${tempPassword}</li>
          <li><strong>Rôle :</strong> ${user.role}</li>
        </ul>
        <p>Connectez-vous puis changez votre mot de passe dès que possible.</p>
      `
    })
  });
}

module.exports = {
  clientIp,
  clientAgent,
  addSecurityLog,
  isLocked,
  registerFailedLogin,
  clearFailedLogin,
  notifyLoginSuccess,
  notifyLoginFailure,
  notifyDemandeStatut,
  notifyAccountCreated
};
