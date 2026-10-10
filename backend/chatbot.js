/**
 * Assistant virtuel Poulina — chatbot métier (FAQ intelligente)
 */
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const KNOWLEDGE = [
  {
    keys: ['bonjour', 'salut', 'hello', 'bonsoir', 'hey'],
    answer:
      'Bonjour ! Je suis l’assistant virtuel Poulina. Je peux vous aider sur les demandes de matériel, les statuts, la sécurité du compte et la navigation dans l’application.'
  },
  {
    keys: ['demande', 'commander', 'nouvelle demande', 'creer demande', 'créer'],
    answer:
      'Pour créer une demande : menu **Demandes** → choisissez le matériel → indiquez la quantité → ajoutez un commentaire si besoin → cliquez sur **Envoyer**. La demande démarre au statut **En attente**.'
  },
  {
    keys: ['statut', 'attente', 'acceptee', 'refusee', 'acceptée', 'refusée'],
    answer:
      'Les statuts possibles sont :\n• **En attente** — en cours de validation\n• **Acceptée** — validée par l’administrateur\n• **Refusée** — non validée\nVous recevez un e-mail de sécurité à chaque changement de statut.'
  },
  {
    keys: ['role', 'admin', 'administrateur', 'utilisateur', 'droit'],
    answer:
      'Deux rôles :\n• **Administrateur** — gère utilisateurs, matériel, et valide/refuse les demandes\n• **Utilisateur** — consulte le matériel et crée ses propres demandes'
  },
  {
    keys: ['materiel', 'catalogue', 'ajouter materiel'],
    answer:
      'Le catalogue se trouve dans **Matériel**. Les utilisateurs consultent la liste ; seuls les administrateurs peuvent ajouter, modifier ou supprimer un article (libellé + descriptif).'
  },
  {
    keys: ['mot de passe', 'password', 'securite', 'sécurité', 'connexion', 'mail', 'email', 'alerte'],
    answer:
      'Sécurité active :\n• Alerte e-mail à chaque connexion réussie\n• Alerte e-mail en cas d’échec de connexion\n• Verrouillage temporaire après 5 tentatives échouées (15 min)\n• Journal d’audit consultable par l’admin (Centre Sécurité)\n• Notification e-mail lors du changement de statut d’une demande'
  },
  {
    keys: ['aide', 'help', 'comment', 'fonctionne'],
    answer:
      'Je peux vous expliquer : création de demande, statuts, rôles, matériel, et sécurité / mailing. Posez votre question en français.'
  },
  {
    keys: ['contact', 'support', 'it', 'assistance'],
    answer:
      'Pour un problème critique (compte bloqué, accès perdu), contactez l’administrateur IT Poulina via le Centre Sécurité ou votre responsable hiérarchique.'
  }
];

function reply(message, context = {}) {
  const q = normalize(message);
  if (!q) {
    return {
      reply:
        'Je n’ai pas reçu votre message. Essayez par exemple : « Comment créer une demande ? » ou « Quels sont les statuts ? »',
      suggestions: ['Créer une demande', 'Statuts', 'Sécurité & e-mails', 'Rôles']
    };
  }

  let best = null;
  let score = 0;
  for (const item of KNOWLEDGE) {
    const s = item.keys.reduce((acc, k) => (q.includes(normalize(k)) ? acc + normalize(k).length : acc), 0);
    if (s > score) {
      score = s;
      best = item;
    }
  }

  if (!best || score === 0) {
    const roleHint =
      context.role === 'ADMINISTRATEUR'
        ? ' En tant qu’admin, vous avez aussi accès au **Centre Sécurité** (logs + mails).'
        : '';
    return {
      reply:
        `Je n’ai pas trouvé une réponse précise.${roleHint}\nEssayez : « créer une demande », « statut », « rôle admin », « alerte mail ».`,
      suggestions: ['Créer une demande', 'Statuts', 'Sécurité & e-mails', 'Rôles']
    };
  }

  return {
    reply: best.answer,
    suggestions: ['Créer une demande', 'Statuts', 'Sécurité & e-mails', 'Catalogue matériel']
  };
}

module.exports = { reply };
