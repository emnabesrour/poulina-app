const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { readDb, writeDb, ensureDb } = require('./db');
const chatbot = require('./chatbot');
const { smtpReady, getSmtpConfig } = require('./mail');
const {
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
} = require('./security');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'poulina-gestion-materiel-secret-change-me';

ensureDb();

app.use(cors());
app.use(express.json({ limit: '256kb' }));

function sanitizeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMINISTRATEUR') {
    return res.status(403).json({ message: "Accès réservé à l'administrateur" });
  }
  next();
}

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body || {};
  const ip = clientIp(req);
  const userAgent = clientAgent(req);

  if (!login || !password) {
    return res.status(400).json({ message: 'Login et mot de passe requis' });
  }

  if (isLocked(login, ip)) {
    await notifyLoginFailure(login, ip, 'Compte temporairement verrouillé', userAgent);
    return res.status(429).json({
      message: 'Trop de tentatives. Compte verrouillé 15 minutes pour cette adresse.'
    });
  }

  const db = readDb();
  const user = db.utilisateurs.find((u) => u.login === login);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    const state = registerFailedLogin(login, ip);
    await notifyLoginFailure(login, ip, 'Identifiants incorrects', userAgent);
    const left = Math.max(0, 5 - state.count);
    return res.status(401).json({
      message:
        state.count >= 5
          ? 'Compte verrouillé 15 minutes après 5 échecs.'
          : `Identifiants incorrects. Tentatives restantes : ${left}`
    });
  }

  clearFailedLogin(login, ip);
  const token = jwt.sign(
    { id: user.id, login: user.login, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  notifyLoginSuccess(user, ip, userAgent).catch((err) => {
    console.error('Mailing connexion:', err.message);
  });

  res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const db = readDb();
  const user = db.utilisateurs.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(sanitizeUser(user));
});

// Utilisateurs (admin)
app.get('/api/utilisateurs', auth, requireAdmin, (req, res) => {
  const db = readDb();
  res.json(db.utilisateurs.map(sanitizeUser));
});

app.post('/api/utilisateurs', auth, requireAdmin, async (req, res) => {
  const { nom, prenom, email, login, password, role } = req.body || {};
  if (!nom || !prenom || !email || !login || !password || !role) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }
  if (!['ADMINISTRATEUR', 'UTILISATEUR'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  const db = readDb();
  if (db.utilisateurs.some((u) => u.login === login)) {
    return res.status(409).json({ message: 'Ce login existe déjà' });
  }
  const user = {
    id: uuidv4(),
    nom,
    prenom,
    email,
    login,
    password: bcrypt.hashSync(password, 10),
    role
  };
  db.utilisateurs.push(user);
  writeDb(db);
  addSecurityLog({
    type: 'USER_CREATED',
    severity: 'INFO',
    message: `Compte créé : ${login} (${role})`,
    userId: req.user.id,
    login: req.user.login,
    ip: clientIp(req)
  });

  let mail = null;
  try {
    mail = await notifyAccountCreated(user, password);
  } catch (err) {
    console.error('Mail bienvenue:', err.message);
  }

  res.status(201).json({
    ...sanitizeUser(user),
    mail: mail
      ? { status: mail.status, to: mail.to, subject: mail.subject, error: mail.error }
      : null
  });
});

app.post('/api/utilisateurs/:id/renvoyer-mail', auth, requireAdmin, async (req, res) => {
  const db = readDb();
  const user = db.utilisateurs.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const tempPassword = req.body?.password || '(mot de passe déjà défini — contactez l\'admin)';
  try {
    const mail = await notifyAccountCreated(user, tempPassword);
    res.json({
      message:
        mail.status === 'ENVOYE'
          ? `E-mail renvoyé avec succès à ${user.email}`
          : mail.status === 'SIMULE'
            ? `E-mail enregistré (mode simulation). Configurez SMTP Gmail pour un envoi réel.`
            : `Échec d'envoi : ${mail.error || 'erreur inconnue'}`,
      mail: { status: mail.status, to: mail.to, error: mail.error }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/utilisateurs/:id', auth, requireAdmin, (req, res) => {
  const db = readDb();
  const idx = db.utilisateurs.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const { nom, prenom, email, login, password, role } = req.body || {};
  if (login && db.utilisateurs.some((u, i) => u.login === login && i !== idx)) {
    return res.status(409).json({ message: 'Ce login existe déjà' });
  }
  if (role && !['ADMINISTRATEUR', 'UTILISATEUR'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }

  const current = db.utilisateurs[idx];
  db.utilisateurs[idx] = {
    ...current,
    nom: nom ?? current.nom,
    prenom: prenom ?? current.prenom,
    email: email ?? current.email,
    login: login ?? current.login,
    role: role ?? current.role,
    password: password ? bcrypt.hashSync(password, 10) : current.password
  };
  writeDb(db);
  addSecurityLog({
    type: 'USER_UPDATED',
    severity: 'INFO',
    message: `Utilisateur modifié : ${db.utilisateurs[idx].login}`,
    userId: req.user.id,
    login: req.user.login,
    ip: clientIp(req)
  });
  res.json(sanitizeUser(db.utilisateurs[idx]));
});

app.delete('/api/utilisateurs/:id', auth, requireAdmin, (req, res) => {
  const db = readDb();
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  const target = db.utilisateurs.find((u) => u.id === req.params.id);
  const before = db.utilisateurs.length;
  db.utilisateurs = db.utilisateurs.filter((u) => u.id !== req.params.id);
  if (db.utilisateurs.length === before) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }
  writeDb(db);
  addSecurityLog({
    type: 'USER_DELETED',
    severity: 'WARNING',
    message: `Utilisateur supprimé : ${target?.login || req.params.id}`,
    userId: req.user.id,
    login: req.user.login,
    ip: clientIp(req)
  });
  res.status(204).send();
});

// Matériels
app.get('/api/materiels', auth, (req, res) => {
  res.json(readDb().materiels);
});

app.post('/api/materiels', auth, requireAdmin, (req, res) => {
  const { libelle, descriptif } = req.body || {};
  if (!libelle || !descriptif) {
    return res.status(400).json({ message: 'Libellé et descriptif requis' });
  }
  const db = readDb();
  const materiel = { id: uuidv4(), libelle, descriptif };
  db.materiels.push(materiel);
  writeDb(db);
  res.status(201).json(materiel);
});

app.put('/api/materiels/:id', auth, requireAdmin, (req, res) => {
  const db = readDb();
  const idx = db.materiels.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Matériel introuvable' });
  const { libelle, descriptif } = req.body || {};
  db.materiels[idx] = {
    ...db.materiels[idx],
    libelle: libelle ?? db.materiels[idx].libelle,
    descriptif: descriptif ?? db.materiels[idx].descriptif
  };
  writeDb(db);
  res.json(db.materiels[idx]);
});

app.delete('/api/materiels/:id', auth, requireAdmin, (req, res) => {
  const db = readDb();
  const before = db.materiels.length;
  db.materiels = db.materiels.filter((m) => m.id !== req.params.id);
  if (db.materiels.length === before) {
    return res.status(404).json({ message: 'Matériel introuvable' });
  }
  writeDb(db);
  res.status(204).send();
});

// Demandes
app.get('/api/demandes', auth, (req, res) => {
  const db = readDb();
  let list = db.demandes;
  if (req.user.role !== 'ADMINISTRATEUR') {
    list = list.filter((d) => d.utilisateurId === req.user.id);
  }
  const enriched = list.map((d) => {
    const user = db.utilisateurs.find((u) => u.id === d.utilisateurId);
    const materiel = db.materiels.find((m) => m.id === d.materielId);
    return {
      ...d,
      utilisateur: user ? sanitizeUser(user) : null,
      materiel: materiel || null
    };
  });
  res.json(enriched);
});

app.post('/api/demandes', auth, (req, res) => {
  const { materielId, quantite, commentaire } = req.body || {};
  if (!materielId || !quantite) {
    return res.status(400).json({ message: 'Matériel et quantité requis' });
  }
  const qte = Number(quantite);
  if (!Number.isFinite(qte) || qte <= 0) {
    return res.status(400).json({ message: 'Quantité invalide' });
  }
  const db = readDb();
  const materiel = db.materiels.find((m) => m.id === materielId);
  if (!materiel) return res.status(404).json({ message: 'Matériel introuvable' });

  const demande = {
    id: uuidv4(),
    reference: `DEM-${Date.now().toString().slice(-8)}`,
    quantite: qte,
    commentaire: commentaire || '',
    statut: 'EN_ATTENTE',
    utilisateurId: req.user.id,
    materielId,
    dateCreation: new Date().toISOString()
  };
  db.demandes.push(demande);
  writeDb(db);
  res.status(201).json({
    ...demande,
    utilisateur: sanitizeUser(db.utilisateurs.find((u) => u.id === req.user.id)),
    materiel
  });
});

app.patch('/api/demandes/:id/statut', auth, requireAdmin, async (req, res) => {
  const { statut } = req.body || {};
  if (!['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE'].includes(statut)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }
  const db = readDb();
  const idx = db.demandes.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Demande introuvable' });
  db.demandes[idx].statut = statut;
  writeDb(db);
  const d = db.demandes[idx];
  const user = db.utilisateurs.find((u) => u.id === d.utilisateurId);
  const materiel = db.materiels.find((m) => m.id === d.materielId) || null;
  if (user) notifyDemandeStatut(d, user, materiel, statut).catch(() => {});
  res.json({
    ...d,
    utilisateur: user ? sanitizeUser(user) : null,
    materiel
  });
});

// Centre Sécurité
app.get('/api/securite/logs', auth, requireAdmin, (req, res) => {
  res.json(readDb().securityLogs || []);
});

app.get('/api/securite/mails', auth, requireAdmin, (req, res) => {
  res.json(readDb().mails || []);
});

app.get('/api/securite/resume', auth, requireAdmin, (req, res) => {
  const db = readDb();
  const logs = db.securityLogs || [];
  const mails = db.mails || [];
  const last24h = Date.now() - 24 * 60 * 60 * 1000;
  res.json({
    totalLogs: logs.length,
    failures24h: logs.filter(
      (l) => l.type === 'LOGIN_FAILURE' && new Date(l.createdAt).getTime() >= last24h
    ).length,
    success24h: logs.filter(
      (l) => l.type === 'LOGIN_SUCCESS' && new Date(l.createdAt).getTime() >= last24h
    ).length,
    mailsEnoyes: mails.filter((m) => m.status === 'ENVOYE' || m.status === 'SIMULE').length,
    mailsEchec: mails.filter((m) => m.status === 'ECHEC').length,
    modeMail: smtpReady() ? 'SMTP Gmail ACTIF' : 'SIMULE (configurez Gmail ci-dessous)'
  });
});

app.get('/api/securite/smtp', auth, requireAdmin, (req, res) => {
  const c = getSmtpConfig();
  res.json({
    host: c.host || 'smtp.gmail.com',
    port: c.port || 587,
    secure: c.secure,
    user: c.user || '',
    from: c.from || '',
    configured: smtpReady(),
    passSet: !!(c.pass)
  });
});

app.put('/api/securite/smtp', auth, requireAdmin, (req, res) => {
  const { host, port, secure, user, pass, from } = req.body || {};
  const db = readDb();
  const prev = db.smtp || {};
  db.smtp = {
    host: host || prev.host || 'smtp.gmail.com',
    port: Number(port || prev.port || 587),
    secure: !!secure,
    user: user || prev.user || '',
    pass: pass !== undefined && pass !== '' ? pass : prev.pass || '',
    from: from || prev.from || (user ? `Gestion Materiel Poulina <${user}>` : prev.from || '')
  };
  writeDb(db);
  addSecurityLog({
    type: 'SMTP_UPDATED',
    severity: 'INFO',
    message: `Configuration SMTP mise à jour (${db.smtp.user || 'sans user'})`,
    userId: req.user.id,
    login: req.user.login,
    ip: clientIp(req)
  });
  res.json({
    message: smtpReady()
      ? 'SMTP configuré. Les prochains mails partiront sur Gmail.'
      : 'SMTP incomplet. Indiquez Gmail + mot de passe d’application.',
    configured: smtpReady()
  });
});

// Messagerie personnelle (chaque utilisateur voit SES mails)
app.get('/api/messages', auth, (req, res) => {
  const db = readDb();
  const me = db.utilisateurs.find((u) => u.id === req.user.id);
  if (!me) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const list = (db.mails || [])
    .filter((m) => String(m.to).toLowerCase() === String(me.email).toLowerCase())
    .map(({ html, text, ...rest }) => ({
      ...rest,
      preview: (text || '').replace(/\s+/g, ' ').trim().slice(0, 140),
      html
    }));
  res.json(list);
});

app.patch('/api/messages/:id/lu', auth, (req, res) => {
  const db = readDb();
  const me = db.utilisateurs.find((u) => u.id === req.user.id);
  const idx = (db.mails || []).findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Message introuvable' });
  if (String(db.mails[idx].to).toLowerCase() !== String(me.email).toLowerCase()) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  db.mails[idx].read = true;
  writeDb(db);
  res.json(db.mails[idx]);
});

// Chatbot
app.post('/api/chatbot', auth, (req, res) => {
  const { message } = req.body || {};
  const result = chatbot.reply(message, { role: req.user.role, login: req.user.login });
  res.json({
    ...result,
    bot: 'Assistant Poulina',
    at: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`API démarrée sur http://localhost:${PORT}`);
  console.log('Comptes démo: admin/admin123  |  sami/user123');
  console.log(`Mailing: ${smtpReady() ? 'SMTP Gmail ACTIF' : 'mode SIMULÉ — configurez Centre Sécurité'}`);
});
