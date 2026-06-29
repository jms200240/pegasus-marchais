# Plan d'implémentation — Sprint 1 : Foundation

Ce plan décrit les étapes pour poser les fondations de l'application Pegasus : une PWA mobile-first pour l'élevage équin.

---

## User Review Required

> [!IMPORTANT]
> - **Configuration npm** : Afin de contourner les erreurs SSL `UNABLE_TO_VERIFY_LEAF_SIGNATURE` rencontrées sur l'environnement, le paramètre `strict-ssl` de npm a été configuré sur `false`.
> - **Initialisation non-destructive** : L'initialisation du projet se fera dans un dossier temporaire `c:\Projets\Pegasus\temp-vite`, puis les fichiers seront déplacés à la racine afin d'éviter tout écrasement ou suppression du fichier de contexte `AGENTS.md.txt`.
> - Nous devons installer les dépendances de base : `react`, `react-dom`, `vite`, `typescript`, `@types/react`, `@types/react-dom`, `tailwindcss`, `postcss`, `autoprefixer`, `@supabase/supabase-js`, et éventuellement une bibliothèque d'icônes légère comme `lucide-react` pour la bottom navigation.
> - Les clés Supabase définies dans `AGENTS.md.txt` seront configurées via un fichier `.env.local` pour le développement local et à configurer sur Vercel.

---

## Proposed Changes

Le projet sera découpé en 5 étapes successives. **Chaque étape nécessitera votre validation explicite avant de passer à la suivante.**

### Étape 1 : Initialisation React + TypeScript + Tailwind CSS avec Vite
Initialisation propre de l'application dans la racine du workspace.
- Configuration de Vite, TypeScript, Tailwind CSS, et PostCSS.
- Création de la structure de dossiers : `src/pages`, `src/components`, `src/lib`.

#### [NEW] [package.json](file:///c:/Projets/Pegasus/package.json)
#### [NEW] [vite.config.ts](file:///c:/Projets/Pegasus/vite.config.ts)
#### [NEW] [tsconfig.json](file:///c:/Projets/Pegasus/tsconfig.json)
#### [NEW] [tailwind.config.js](file:///c:/Projets/Pegasus/tailwind.config.js)
#### [NEW] [postcss.config.js](file:///c:/Projets/Pegasus/postcss.config.js)
#### [NEW] [index.html](file:///c:/Projets/Pegasus/index.html)
#### [NEW] [src/main.tsx](file:///c:/Projets/Pegasus/src/main.tsx)
#### [NEW] [src/index.css](file:///c:/Projets/Pegasus/src/index.css)
#### [NEW] [src/App.tsx](file:///c:/Projets/Pegasus/src/App.tsx)

### Étape 2 : Installation et configuration du client Supabase
Configuration du client Supabase avec les variables d'environnement.
- Création du fichier `.env.local`.
- Initialisation du client dans `src/lib/supabase.ts`.

#### [NEW] [.env.local](file:///c:/Projets/Pegasus/.env.local)
#### [NEW] [src/lib/supabase.ts](file:///c:/Projets/Pegasus/src/lib/supabase.ts)

### Étape 3 : Système d'authentification Email/Password
- Page de connexion soignée et ergonomique (Mobile-first, fond crème `#F6F2EC`, boutons verts `#2f6b3f`).
- Gestion de l'état de session dans `src/App.tsx`.
- Redirection automatique vers l'application après une connexion réussie.

#### [NEW] [src/pages/Login.tsx](file:///c:/Projets/Pegasus/src/pages/Login.tsx)

### Étape 4 : Navigation principale (Bottom Bar) et Pages Vides
- Création des 4 pages vides : `Accueil`, `Soins`, `Chevaux`, `Finances`.
- Création du composant `BottomNav` avec la couleur active `#2f6b3f` et un design épuré et premium (icônes modernes, micro-interactions).
- Intégration de la navigation par onglets dans l'application principale.

#### [NEW] [src/components/BottomNav.tsx](file:///c:/Projets/Pegasus/src/components/BottomNav.tsx)
#### [NEW] [src/pages/Accueil.tsx](file:///c:/Projets/Pegasus/src/pages/Accueil.tsx)
#### [NEW] [src/pages/Soins.tsx](file:///c:/Projets/Pegasus/src/pages/Soins.tsx)
#### [NEW] [src/pages/Chevaux.tsx](file:///c:/Projets/Pegasus/src/pages/Chevaux.tsx)
#### [NEW] [src/pages/Finances.tsx](file:///c:/Projets/Pegasus/src/pages/Finances.tsx)

### Étape 5 : Configuration Vercel
- Création de `vercel.json` pour la configuration du déploiement (notamment pour gérer le routage Single Page Application si besoin).

#### [NEW] [vercel.json](file:///c:/Projets/Pegasus/vercel.json)

---

## Verification Plan

### Automated Verification
- Validation de la compilation TypeScript : `npm run build` ou `npx tsc`.
- Validation de la configuration Tailwind et du bon chargement des styles.

### Manual Verification
- Test local du flux d'authentification avec Supabase Auth (inscription/connexion).
- Test du changement d'onglet dans le navigateur en mode responsive mobile (390px).
