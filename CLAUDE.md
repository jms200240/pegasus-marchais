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
- **Finances — HT/taux TVA** : jamais écrits en base, affichés uniquement pour vérification contre la facture papier ; seul le TTC calculé (arrondi 2 décimales) est stocké.
- **intervenant_type** (`invoices`/`expenses`) réutilise l'énumération de `HealthEvent.type` (`veterinaire`/`marechal`/`dentiste`/`osteo`/`groom`) — pas de nouvelle nomenclature.
- **health_events.source** : colonne texte libre (Famille/Groom/Vétérinaire/etc.) traçant qui a enregistré l'entrée — pas de contrainte stricte, ouverte pour usages futurs.

## Workflow de livraison (à respecter strictement)

- Une étape à la fois, fichier complet, attente du "ok" avant l'étape suivante — sauf en Claude Code où l'édition directe des fichiers remplace le copier-coller (mais garder le principe : petites étapes validées, pas de gros commit monolithique surprise).
- Chaque instruction d'action commence par l'outil concerné.
- Vérifier le schema Supabase avant tout code touchant les données.
- Style de communication : direct, concis, en français. Pas d'explications ligne à ligne non demandées.
- Décisions d'architecture : recommander directement la meilleure option plutôt que présenter des alternatives à arbitrer.

## État actuel (à mettre à jour à chaque sprint)

Sprints livrés : S1 (fondation), S2 (module Chevaux), S3 (Soins/Bobos — BoboWizard 5 étapes, BoboCard journal), S4 (route /visite — VisiteSheet, galerie photos filtrée par tags), S5 partiel (module Finances — menu Saisie de facture / Suivi des coûts, ventilation multi-chevaux ou 1 seul cheval, bar charts drill-down cheval↔prestataire, fiche facture consultable/modifiable ; pipeline OCR/staging non démarré).

Opérationnel en production (`pegasus-marchais.vercel.app`) :
- VeterinairePicker (10 vétérinaires, photos statiques bundlées, rang 1–10)
- VisiteProSheet (sélecteur métier : Vétérinaire, Maréchal-ferrant, Ostéopathe, Dentiste)
- VaccineReminders (regroupement collapsible, exclusions permanentes, calcul temps réel)
- 121 lignes d'historique de vaccination importées en Supabase
- Finances : Saisie de facture (multi-chevaux ou 1 seul cheval, bucket "Autre" hors suivi) + Suivi des coûts (total annuel, ventilation cheval/prestataire en bar charts avec drill-down, factures via InvoiceDetailSheet — ouverture en lecture seule, bouton "Modifier" pour éditer)
- VisiteProSheet — Maréchal-ferrant : MarechalPicker (2 maréchaux, photos bundlées), bobos actifs filtrés sur pathologies pied/fourbure (Seime, Abcès du pied, Fourbure, Pourriture de fourchette, Fourmilière), flux "Soin maréchal" en cascade (Parage 4 pieds → Ferrure antérieurs → Ferrure 4 pieds) écrivant dans `health_events`
- Fiches Vaccins (contenu IFCE, 4 vaccins en accordéon) accessible depuis Rappels vaccins
- Échelle de gravité en dégradé couleur (vert→rouge, remplace les étoiles), lecture seule et sélection interactive
- BoboWizard — Localisation : seule "Zone" est obligatoire ; Membre concerné/Région/Face (zone Membre) ou Côté (autres zones) sont des sélections indépendantes et facultatives (`pathology.has_laterality` n'est plus utilisé pour bloquer la progression)

Tables Supabase existantes : `health_events`, `health_event_visits`, `farm_alerts`, `ambiance_photos`, `photo_tags`, `vaccinations`, `vaccine_exclusions`, `veterinaires`, `marechaux`, `invoices`, `invoices_staging`, `expenses` (RLS confirmé : Famille = ALL, Groom = aucun accès). `invoices`/`expenses` utilisées par l'écran Finances ; `invoices_staging` toujours sans code applicatif (réservée au pipeline OCR).

Restant à faire sur les workflows Visite pro : Soin véto, placeholders Ostéopathe/Dentiste (pathologies dentiste déjà identifiées : Troubles dentaires/surdents, à câbler quand ce workflow sera construit).

## Roadmap

- S5 (suite) : pipeline OCR factures (n8n + Claude Vision → `invoices_staging`, relecture/validation avant écriture dans `invoices`/`expenses`)
- S6 : module Groom (paiement par visite, max 1 visite/jour, compteurs mensuels, workflow "marquer soldé")
- Notifications push via Firebase FCM
- Ingestion WhatsApp pour saisie terrain (phase 2)
- Arbre généalogique interactif (structure TREE_SEED, 5 générations)
- Migration logique rappels vaccins depuis Excel vers Supabase/app

## Outils

GitHub (édition web historique, migration possible vers édition directe via Claude Code) · Vercel (CI/CD auto) · Supabase SQL Editor (pas de CLI Supabase) · Lucide Icons + Tabler Icons · piexifjs (EXIF) · WeasyPrint / openpyxl (génération PDF/Excel de référence).
