# Gestion de commandes de matériel — Poulina

Application professionnelle Angular + API Node.js : demandes de matériel, rôles, **Centre Sécurité** (mailing / audit) et **chatbot** d’assistance.

## Fonctionnalités

- Login sécurisé (2 rôles : Administrateur / Utilisateur)
- Utilisateurs, Matériel, Demandes (statuts : En attente / Acceptée / Refusée)
- **Mailing sécurité** : alerte e-mail à la connexion, échecs, création de compte, changement de statut
- **Verrouillage** après 5 tentatives échouées (15 min)
- **Journal d’audit** + boîte d’envoi (admin)
- **Chatbot** assistant métier (bouton Aide)
- Identité visuelle Poulina (bleu foncé + logo officiel)

## Démarrage

```bash
# Terminal 1 — API
cd backend
npm install
npm start

# Terminal 2 — Angular
cd frontend
npm install
npm start
```

- Front : http://localhost:4200  
- API : http://localhost:3000  

## Comptes démo

| Rôle | Login | Mot de passe |
|------|-------|--------------|
| Administrateur | `admin` | `admin123` |
| Utilisateur | `sami` | `user123` |

## Mailing & géolocalisation

À chaque **connexion** :
- e-mail à l’utilisateur (date/heure, ville/pays, IP, navigateur)
- **copie aux administrateurs**

Sans fichier `.env` SMTP → mails **simulés** visibles dans **Centre Sécurité → Boîte d’envoi**.

Pour Gmail réel : copier `backend/.env.example` vers `backend/.env`, remplir le mot de passe d’application, puis relancer l’API.

## Chatbot

Widget flottant **Aide** : questions sur demandes, statuts, rôles, sécurité / mails.
