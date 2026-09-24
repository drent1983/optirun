import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En GitHub Pages la app cuelga de /optirun/; en local se sirve desde la raíz.
// Las rutas del WASM y del modelo usan import.meta.env.BASE_URL, así que las respetan.
// Se usa un indicador booleano y no una ruta para evitar que el shell la reescriba.
const base = process.env.GITHUB_PAGES === 'true' ? '/optirun/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
});
