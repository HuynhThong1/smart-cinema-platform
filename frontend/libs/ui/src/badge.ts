import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
@Component({
  selector: 'cinema-badge',
  imports: [TagModule],
  template: `<p-tag
    [severity]="severity()"
    [style]="{ background: 'inherit', color: 'inherit', padding: '0', font: 'inherit' }"
    ><ng-content
  /></p-tag>`,
  host: { class: 'tag' },
})
export class CinemaBadge {
  severity = input<'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'>('secondary');
}
@Component({
  selector: 'cinema-empty',
  template: '<ng-content />',
  host: { class: 'empty', role: 'status' },
})
export class CinemaEmpty {}
