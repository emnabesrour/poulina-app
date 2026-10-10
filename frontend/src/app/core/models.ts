export type Role = 'ADMINISTRATEUR' | 'UTILISATEUR';
export type StatutDemande = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';

export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  login: string;
  role: Role;
}

export interface Materiel {
  id: string;
  libelle: string;
  descriptif: string;
}

export interface Demande {
  id: string;
  reference: string;
  quantite: number;
  commentaire: string;
  statut: StatutDemande;
  utilisateurId: string;
  materielId: string;
  dateCreation: string;
  utilisateur?: Utilisateur | null;
  materiel?: Materiel | null;
}

export interface LoginResponse {
  token: string;
  user: Utilisateur;
}

export interface SecurityLog {
  id: string;
  type: string;
  severity: string;
  message: string;
  userId?: string | null;
  login?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface MailRecord {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: string;
  createdAt: string;
  error?: string | null;
  html?: string;
  text?: string;
}

export interface SecurityResume {
  totalLogs: number;
  failures24h: number;
  success24h: number;
  mailsEnoyes: number;
  mailsEchec: number;
  modeMail: string;
}

export interface ChatbotResponse {
  reply: string;
  suggestions: string[];
  bot: string;
  at: string;
}
