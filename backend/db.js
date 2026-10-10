const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const userHash = bcrypt.hashSync('user123', 10);
    const seed = {
      utilisateurs: [
        {
          id: uuidv4(),
          nom: 'Ben Ali',
          prenom: 'Admin',
          email: 'admin@poulina.tn',
          login: 'admin',
          password: adminHash,
          role: 'ADMINISTRATEUR'
        },
        {
          id: uuidv4(),
          nom: 'Trabelsi',
          prenom: 'Sami',
          email: 'sami@poulina.tn',
          login: 'sami',
          password: userHash,
          role: 'UTILISATEUR'
        }
      ],
      materiels: [
        {
          id: uuidv4(),
          libelle: 'Ordinateur portable',
          descriptif: 'Laptop professionnel 16 Go RAM, SSD 512 Go'
        },
        {
          id: uuidv4(),
          libelle: 'Écran 24"',
          descriptif: 'Moniteur Full HD pour poste de travail'
        },
        {
          id: uuidv4(),
          libelle: 'Clavier / Souris',
          descriptif: 'Kit périphériques sans fil'
        }
      ],
      demandes: [],
      securityLogs: [],
      mails: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
  } else {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let changed = false;
    if (!db.securityLogs) {
      db.securityLogs = [];
      changed = true;
    }
    if (!db.mails) {
      db.mails = [];
      changed = true;
    }
    if (changed) fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

module.exports = { readDb, writeDb, ensureDb };
