import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface ChatMsg {
  from: 'bot' | 'user';
  text: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss'
})
export class ChatbotComponent {
  @ViewChild('scrollBox') scrollBox?: ElementRef<HTMLDivElement>;

  open = signal(false);
  loading = signal(false);
  draft = '';
  suggestions = signal<string[]>([
    'Créer une demande',
    'Statuts',
    'Sécurité & e-mails',
    'Rôles'
  ]);
  messages = signal<ChatMsg[]>([
    {
      from: 'bot',
      text: 'Bonjour, je suis l’assistant Poulina. Comment puis-je vous aider ?'
    }
  ]);

  constructor(private api: ApiService) {}

  toggle(): void {
    this.open.update((v) => !v);
  }

  sendSuggestion(s: string): void {
    this.draft = s;
    this.send();
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.loading()) return;
    this.messages.update((m) => [...m, { from: 'user', text }]);
    this.draft = '';
    this.loading.set(true);
    this.scrollSoon();

    this.api.askChatbot(text).subscribe({
      next: (res) => {
        this.messages.update((m) => [...m, { from: 'bot', text: res.reply }]);
        if (res.suggestions?.length) this.suggestions.set(res.suggestions);
        this.loading.set(false);
        this.scrollSoon();
      },
      error: () => {
        this.messages.update((m) => [
          ...m,
          { from: 'bot', text: 'Service temporairement indisponible. Réessayez dans un instant.' }
        ]);
        this.loading.set(false);
        this.scrollSoon();
      }
    });
  }

  private scrollSoon(): void {
    setTimeout(() => {
      const el = this.scrollBox?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
  }
}
