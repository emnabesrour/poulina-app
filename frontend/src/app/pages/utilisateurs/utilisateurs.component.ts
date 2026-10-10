import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Role, Utilisateur } from '../../core/models';

@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './utilisateurs.component.html',
  styleUrl: './utilisateurs.component.scss'
})
export class UtilisateursComponent implements OnInit {
  utilisateurs = signal<Utilisateur[]>([]);
  error = signal('');
  success = signal('');
  editingId: string | null = null;

  form = {
    nom: '',
    prenom: '',
    email: '',
    login: '',
    password: '',
    role: 'UTILISATEUR' as Role
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getUtilisateurs().subscribe({
      next: (list) => this.utilisateurs.set(list),
      error: (err) => this.error.set(err?.error?.message || 'Erreur de chargement')
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form = {
      nom: '',
      prenom: '',
      email: '',
      login: '',
      password: '',
      role: 'UTILISATEUR'
    };
  }

  edit(u: Utilisateur): void {
    this.editingId = u.id;
    this.form = {
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      login: u.login,
      password: '',
      role: u.role
    };
  }

  save(): void {
    this.error.set('');
    this.success.set('');
    if (this.editingId) {
      const payload: Record<string, string> = {
        nom: this.form.nom,
        prenom: this.form.prenom,
        email: this.form.email,
        login: this.form.login,
        role: this.form.role
      };
      if (this.form.password) payload['password'] = this.form.password;
      this.api.updateUtilisateur(this.editingId, payload as never).subscribe({
        next: () => {
          this.success.set('Utilisateur mis à jour');
          this.resetForm();
          this.load();
        },
        error: (err) => this.error.set(err?.error?.message || 'Échec de la mise à jour')
      });
      return;
    }

    this.api.createUtilisateur(this.form).subscribe({
      next: () => {
        this.success.set('Utilisateur ajouté');
        this.resetForm();
        this.load();
      },
      error: (err) => this.error.set(err?.error?.message || 'Échec de la création')
    });
  }

  remove(u: Utilisateur): void {
    if (!confirm(`Supprimer ${u.prenom} ${u.nom} ?`)) return;
    this.api.deleteUtilisateur(u.id).subscribe({
      next: () => {
        this.success.set('Utilisateur supprimé');
        this.load();
      },
      error: (err) => this.error.set(err?.error?.message || 'Suppression impossible')
    });
  }
}
