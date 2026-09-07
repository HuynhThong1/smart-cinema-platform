import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Theme {
  dark = signal(document.documentElement.dataset['theme'] === 'dark');

  toggle() {
    const dark = !this.dark();
    this.dark.set(dark);
    document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('cinema-admin-theme', dark ? 'dark' : 'light');
    } catch {
      // The switch still works when browser storage is unavailable.
    }
  }
}
