import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Materiel } from '../../core/models';

@Component({
  selector: 'app-materiels',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './materiels.component.html',
  styleUrl: './materiels.component.scss'
})
export class MaterielsComponent implements OnInit {
  materiels = signal<Materiel[]>([]);
  error = signal('');
  success = signal('');
  editingId: string | null = null;
  form = { libelle: '', descriptif: '' };

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getMateriels().subscribe({
      next: (list) => this.materiels.set(list),
      error: (err) => this.error.set(err?.error?.message || 'Erreur de chargement')
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { libelle: '', descriptif: '' };
  }

  edit(m: Materiel): void {
    this.editingId = m.id;
    this.form = { libelle: m.libelle, descriptif: m.descriptif };
  }

  save(): void {
    this.error.set('');
    this.success.set('');
    const req$ = this.editingId
      ? this.api.updateMateriel(this.editingId, this.form)
      : this.api.createMateriel(this.form);

    req$.subscribe({
      next: () => {
        this.success.set(this.editingId ? 'Matériel mis à jour' : 'Matériel ajouté');
        this.resetForm();
        this.load();
      },
      error: (err) => this.error.set(err?.error?.message || 'Opération impossible')
    });
  }

  remove(m: Materiel): void {
    if (!confirm(`Supprimer « ${m.libelle} » ?`)) return;
    this.api.deleteMateriel(m.id).subscribe({
      next: () => {
        this.success.set('Matériel supprimé');
        this.load();
      },
      error: (err) => this.error.set(err?.error?.message || 'Suppression impossible')
    });
  }
}
