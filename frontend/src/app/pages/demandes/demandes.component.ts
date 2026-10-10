import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Demande, Materiel, StatutDemande } from '../../core/models';

@Component({
  selector: 'app-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './demandes.component.html',
  styleUrl: './demandes.component.scss'
})
export class DemandesComponent implements OnInit {
  demandes = signal<Demande[]>([]);
  materiels = signal<Materiel[]>([]);
  error = signal('');
  success = signal('');

  form = {
    materielId: '',
    quantite: 1,
    commentaire: ''
  };

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit(): void {
    this.load();
    this.api.getMateriels().subscribe({
      next: (list) => {
        this.materiels.set(list);
        if (list.length && !this.form.materielId) {
          this.form.materielId = list[0].id;
        }
      }
    });
  }

  load(): void {
    this.api.getDemandes().subscribe({
      next: (list) => this.demandes.set(list),
      error: (err) => this.error.set(err?.error?.message || 'Erreur de chargement')
    });
  }

  create(): void {
    this.error.set('');
    this.success.set('');
    this.api
      .createDemande({
        materielId: this.form.materielId,
        quantite: Number(this.form.quantite),
        commentaire: this.form.commentaire
      })
      .subscribe({
        next: () => {
          this.success.set('Demande créée (statut: en attente)');
          this.form.quantite = 1;
          this.form.commentaire = '';
          this.load();
        },
        error: (err) => this.error.set(err?.error?.message || 'Création impossible')
      });
  }

  setStatut(d: Demande, statut: StatutDemande): void {
    this.api.updateStatutDemande(d.id, statut).subscribe({
      next: () => {
        this.success.set(`Demande ${d.reference} → ${statut}`);
        this.load();
      },
      error: (err) => this.error.set(err?.error?.message || 'Mise à jour impossible')
    });
  }

  labelStatut(s: StatutDemande): string {
    switch (s) {
      case 'ACCEPTEE':
        return 'Acceptée';
      case 'REFUSEE':
        return 'Refusée';
      default:
        return 'En attente';
    }
  }
}
