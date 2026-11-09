import { boot } from './core/app.js';
boot().catch((e) => {
    console.error('[boot]', e);
    const s = document.getElementById('splash');
    if (s)
        s.innerHTML = '<p style="padding:24px;font:16px system-ui">No se pudo iniciar la app. <button onclick="location.reload()">Reintentar</button></p>';
});
