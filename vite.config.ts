import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // L'application se met à jour seule : le nouveau service worker prend la
      // main dès qu'il est prêt, sans intervention ni réinstallation.
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Budget Couple',
        short_name: 'Budget',
        description: 'Gestion de budget en couple : revenus, dépenses, factures, épargne.',
        lang: 'fr',
        dir: 'ltr',
        // `standalone` retire la barre d'adresse : l'application s'ouvre
        // comme une application native depuis l'écran d'accueil.
        display: 'standalone',
        // `any` et non `portrait-primary` : les tableaux et les graphiques
        // gagnent beaucoup à la largeur du paysage. L'application suit
        // désormais la rotation du téléphone.
        orientation: 'any',
        start_url: '/',
        scope: '/',
        theme_color: '#013e37',
        background_color: '#fdf7e4',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            // Android rogne l'icône selon le lanceur : la variante maskable
            // garde le motif dans la zone de sécurité.
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        // Le chunk des graphiques dépasse la limite par défaut de 2 Mio.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Routage côté client : toute navigation inconnue retombe sur la
        // coquille de l'application, qui décide ensuite quoi afficher.
        navigateFallback: 'index.html',
        // Les données financières et l'authentification ne sont JAMAIS mises
        // en cache : un solde périmé serait pire qu'une erreur réseau, et une
        // session en cache poserait un problème de confidentialité.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Désactivé en développement : un service worker qui sert du cache
        // rend le rechargement à chaud imprévisible.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
    // Écoute sur toutes les interfaces réseau et non sur la seule boucle
    // locale : c'est ce qui rend le serveur joignable depuis un téléphone
    // connecté au même Wi-Fi, via http://<ip-du-pc>:5173.
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts et Supabase pèsent l'essentiel du bundle et changent
        // rarement : les isoler les rend cachables indépendamment du code
        // applicatif, et allège le premier chargement de l'écran de connexion.
        manualChunks(id) {
          if (/node_modules[\\/](recharts|d3-|victory-)/.test(id)) return 'charts';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          return undefined;
        },
      },
    },
  },
});
