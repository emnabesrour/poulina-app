import { Component } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ChatbotComponent } from '../../components/chatbot/chatbot.component';

registerLocaleData(localeFr);

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ChatbotComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  today = new Date();

  constructor(public auth: AuthService) {
    setInterval(() => {
      this.today = new Date();
    }, 30000);
  }
}
