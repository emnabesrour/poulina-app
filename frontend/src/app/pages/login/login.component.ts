import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  login = '';
  password = '';
  error = signal('');
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate([this.auth.isAdmin() ? '/utilisateurs' : '/demandes']);
    }
  }

  submit(): void {
    this.error.set('');
    this.loading.set(true);
    this.auth.login(this.login.trim(), this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigate([res.user.role === 'ADMINISTRATEUR' ? '/utilisateurs' : '/demandes']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Connexion impossible');
      }
    });
  }
}
