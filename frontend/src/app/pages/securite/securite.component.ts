import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../core/api.service';
import { MailRecord, SecurityLog, SecurityResume } from '../../core/models';

@Component({
  selector: 'app-securite',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './securite.component.html',
  styleUrl: './securite.component.scss'
})
export class SecuriteComponent implements OnInit {
  tab = signal<'logs' | 'mails'>('logs');
  resume = signal<SecurityResume | null>(null);
  logs = signal<SecurityLog[]>([]);
  mails = signal<MailRecord[]>([]);
  error = signal('');
  selectedMail = signal<MailRecord | null>(null);
  selectedHtml = signal<SafeHtml | null>(null);

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.error.set('');
    this.api.getSecurityResume().subscribe({
      next: (r) => this.resume.set(r),
      error: (e) => this.error.set(e?.error?.message || 'Impossible de charger le résumé')
    });
    this.api.getSecurityLogs().subscribe({
      next: (l) => this.logs.set(l),
      error: () => {}
    });
    this.api.getSecurityMails().subscribe({
      next: (m) => this.mails.set(m),
      error: () => {}
    });
  }

  openMail(m: MailRecord): void {
    this.selectedMail.set(m);
    this.selectedHtml.set(
      this.sanitizer.bypassSecurityTrustHtml(m.html || m.text || '<p>Aucun contenu</p>')
    );
  }
}
