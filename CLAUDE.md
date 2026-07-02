# Pegasus — Élevage Scalbert - Les Marchais

## Quoi
PWA mobile-first de gestion équestre (santé, soins, finances, généalogie, groom) pour un usage familial privé. 7 chevaux actifs : Échalote (Échalote du Val d'Été), Hakéa (Hakea du Val d'Été), Romarin (Roi d'Ys), Cerise (Cervoise de Champfort), Fraise (Faveur de Champfort), Pistache (Pistache des Marchais), Pamplemousse (Pamplemousse du Val).

## Qui / Pourquoi
Propriétaire : Jean-Max Scalbert, CFO de formation, **sans compétences en codage**. Toute décision de code doit rester pilotable par lui : livraisons complètes, pas de fragments à chercher-remplacer, explications minimales sauf demande explicite. Logique CFO : traçabilité, coût par cheval, réconciliation.

Deux rôles utilisateurs : Famille (accès complet) et Groom (lecture seule bobos actifs, identité chevaux, calendrier — **aucun accès finances**).

## Stack
React + TypeScript + Tailwind CSS + Vite (PWA) · Supabase (PostgreSQL + Auth + RLS + Storage) · GitHub `jms200240/pegasus-marchais` · Vercel (CI/CD auto depuis main).

## Règles absolues (à ne jamais casser)

- **Schema Supabase = source de vérité.** Toujours vérifier `information_schema.columns` avant d'écrire une requête ou un composant. Noms réels : `born_at`, `pere_name`, `mere_name`, `note`, `opened_at`, `pere_id`, `mere_id` (jamais les équivalents anglais génériques).
- **package.json** : ne jamais éditer via un éditeur rich text/Word (quotes typographiques → JSON cassé).
- **BottomNav** : toute overlay plein écran doit avoir un padding bas ≥ `calc(1rem + 64px + env(safe-area-inset-bottom))`.
- **Photos vétérinaires** : bundlées comme assets Vite statiques (pas Supabase Storage).
- **Vaccinations** : rappels calculés en temps réel depuis l'historique brut (pas pré-calculés) ; exclusions permanentes.
- **Contexte visite pro** : stocké en suffixe texte dans `note` (pas de colonne dédiée sur `health_event_visits`).
- **UNRESOLVED_IMPORT** sur une image = toujours un fichier manquant/non commité, jamais un bug logique.
- **Icônes manquantes** : sourcer depuis Tabler Icons ou dériver mathématiquement, pas de dessin main levée.

## Workflow de livraison (à respecter strictement)

- Une étape à la fois, fichier complet, attente du "ok" avant l'étape suivante — sauf en Claude Code où l'édition directe des fichiers remplace le copier-coller (mais garder le principe : petites étapes validées, pas de gros commit monolithique surprise).
- Chaque instruction d'action commence par l'outil concerné.
- Vérifier le schema Supabase avant tout code touchant les données.
- Style de communication : direct, concis, en français. Pas d'explications ligne à ligne non demandées.
- Décisions d'architecture : recommander directement la meilleure option plutôt que présenter des alternatives à arbitrer.

## État actuel (à mettre à jour à chaque sprint)

Sprints livrés : S1 (fondation), S2 (module Chevaux), S3 (Soins/Bobos — BoboWizard 5 étapes, BoboCard journal), S4 (route /visite — VisiteSheet, galerie photos filtrée par tags).

Opérationnel en production (`pegasus-marchais.vercel.app`) :
- VeterinairePicker (10 vétérinaires, photos statiques bundlées, rang 1–10)
- VisiteProSheet (sélecteur métier : Vétérinaire, Maréchal-ferrant, Ostéopathe, Dentiste)
- VaccineReminders (regroupement collapsible, exclusions permanentes, calcul temps réel)
- 121 lignes d'historique de vaccination importées en Supabase

Tables Supabase existantes : `health_events`, `health_event_visits`, `farm_alerts`, `ambiance_photos`, `photo_tags`, `vaccinations`, `vaccine_exclusions`, `veterinaires`, `invoices`, `invoices_staging`, `expenses` (schema créé en amont, aucun code applicatif ne les utilise encore — RLS confirmé (policy Famille = ALL, pas d'accès Groom)).

Restant à faire sur les workflows Visite pro : Vaccin, Soin véto, placeholders Maréchal-ferrant/Ostéopathe/Dentiste.

## Roadmap

- S5 : module Finances/OCR (pipeline n8n + Claude Vision pour factures, réconciliation par cheval)
- S6 : module Groom (paiement par visite, max 1 visite/jour, compteurs mensuels, workflow "marquer soldé")
- Notifications push via Firebase FCM
- Ingestion WhatsApp pour saisie terrain (phase 2)
- Arbre généalogique interactif (structure TREE_SEED, 5 générations)
- Migration logique rappels vaccins depuis Excel vers Supabase/app

## Outils

GitHub (édition web historique, migration possible vers édition directe via Claude Code) · Vercel (CI/CD auto) · Supabase SQL Editor (pas de CLI Supabase) · Lucide Icons + Tabler Icons · piexifjs (EXIF) · WeasyPrint / openpyxl (génération PDF/Excel de référence).
