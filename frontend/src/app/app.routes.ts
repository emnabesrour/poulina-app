import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { UtilisateursComponent } from './pages/utilisateurs/utilisateurs.component';
import { MaterielsComponent } from './pages/materiels/materiels.component';
import { DemandesComponent } from './pages/demandes/demandes.component';
import { SecuriteComponent } from './pages/securite/securite.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'demandes' },
      { path: 'utilisateurs', component: UtilisateursComponent, canActivate: [adminGuard] },
      { path: 'materiels', component: MaterielsComponent },
      { path: 'demandes', component: DemandesComponent },
      { path: 'securite', component: SecuriteComponent, canActivate: [adminGuard] }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
