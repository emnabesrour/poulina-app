import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  ChatbotResponse,
  Demande,
  MailRecord,
  Materiel,
  Role,
  SecurityLog,
  SecurityResume,
  StatutDemande,
  Utilisateur
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getUtilisateurs() {
    return this.http.get<Utilisateur[]>(`${environment.apiUrl}/utilisateurs`);
  }

  createUtilisateur(payload: {
    nom: string;
    prenom: string;
    email: string;
    login: string;
    password: string;
    role: Role;
  }) {
    return this.http.post<Utilisateur>(`${environment.apiUrl}/utilisateurs`, payload);
  }

  updateUtilisateur(
    id: string,
    payload: Partial<{
      nom: string;
      prenom: string;
      email: string;
      login: string;
      password: string;
      role: Role;
    }>
  ) {
    return this.http.put<Utilisateur>(`${environment.apiUrl}/utilisateurs/${id}`, payload);
  }

  deleteUtilisateur(id: string) {
    return this.http.delete(`${environment.apiUrl}/utilisateurs/${id}`);
  }

  getMateriels() {
    return this.http.get<Materiel[]>(`${environment.apiUrl}/materiels`);
  }

  createMateriel(payload: { libelle: string; descriptif: string }) {
    return this.http.post<Materiel>(`${environment.apiUrl}/materiels`, payload);
  }

  updateMateriel(id: string, payload: { libelle: string; descriptif: string }) {
    return this.http.put<Materiel>(`${environment.apiUrl}/materiels/${id}`, payload);
  }

  deleteMateriel(id: string) {
    return this.http.delete(`${environment.apiUrl}/materiels/${id}`);
  }

  getDemandes() {
    return this.http.get<Demande[]>(`${environment.apiUrl}/demandes`);
  }

  createDemande(payload: { materielId: string; quantite: number; commentaire: string }) {
    return this.http.post<Demande>(`${environment.apiUrl}/demandes`, payload);
  }

  updateStatutDemande(id: string, statut: StatutDemande) {
    return this.http.patch<Demande>(`${environment.apiUrl}/demandes/${id}/statut`, { statut });
  }

  getSecurityResume() {
    return this.http.get<SecurityResume>(`${environment.apiUrl}/securite/resume`);
  }

  getSecurityLogs() {
    return this.http.get<SecurityLog[]>(`${environment.apiUrl}/securite/logs`);
  }

  getSecurityMails() {
    return this.http.get<MailRecord[]>(`${environment.apiUrl}/securite/mails`);
  }

  askChatbot(message: string) {
    return this.http.post<ChatbotResponse>(`${environment.apiUrl}/chatbot`, { message });
  }
}
