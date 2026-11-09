import './styles/design-tokens.css';
import './styles/themes.css';
import './styles/global.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/screens.css';
import './styles/responsive.css';
import './styles/animations.css';
import './styles/utilities.css';
import { boot } from './core/app';

boot().catch((e) => {
  console.error('[boot]', e);
  const s = document.getElementById('splash');
  if (s) s.innerHTML = '<p style="padding:24px;font:16px system-ui">No se pudo iniciar la app. <button onclick="location.reload()">Reintentar</button></p>';
});
