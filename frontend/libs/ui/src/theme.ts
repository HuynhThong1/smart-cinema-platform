import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
const Galaxy = definePreset(Aura, {
  primitive: { borderRadius: { none: '0', xs: '1px', sm: '2px', md: '2px', lg: '4px', xl: '4px' } },
  semantic: {
    primary: {
      50: '#fff5ed',
      100: '#fee8d6',
      200: '#fccca9',
      300: '#f9a471',
      400: '#f7834a',
      500: '#f26b38',
      600: '#e95d29',
      700: '#d94f20',
      800: '#ad3e1c',
      900: '#8c351b',
      950: '#4b170b',
    },
    focusRing: { width: '2px', style: 'solid', color: '#034ea2', offset: '2px' },
  },
});
export function provideCinemaUI() {
  return providePrimeNG({
    theme: {
      preset: Galaxy,
      options: {
        darkModeSelector: '[data-theme="dark"]',
        cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
      },
    },
  });
}
