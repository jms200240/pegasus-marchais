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
- **Vaccinations** : rappels calculés en temps réel depuis l'historique brut (pas pré-calculés) ; exclusions permanentes. `vaccinations.next_reminder_override` (nullable) permet de surcharger la date calculée sans casser ce principe — si absente, le calcul reste 100% dynamique.
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
- VisiteProSheet — Ostéopathe : OsteopathePicker (1 ostéopathe, Maëlys Bizet, photo bundlée), pas de section bobos, flux "Soin ostéopathe" en cascade (Séance complète → Palpation simple). `validateSoinStep`/le suffixe de note sont désormais génériques par métier (marechal/osteo/veterinaire), plus câblés en dur sur le maréchal
- Fiches Vaccins (contenu IFCE, 4 vaccins en accordéon) accessible depuis Rappels vaccins
- Échelle de gravité en dégradé couleur (vert→rouge, remplace les étoiles), lecture seule et sélection interactive
- BoboWizard — Localisation : seule "Zone" est obligatoire ; Membre concerné/Région/Face (zone Membre) ou Côté (autres zones) sont des sélections indépendantes et facultatives (`pathology.has_laterality` n'est plus utilisé pour bloquer la progression)
- Finances : menu réordonné (Suivi des coûts en premier), bloc "Total TTC payé" visible directement dans le menu
- VaccinSheet : aperçu "Prochain rappel" groupé par date de cadence (ex. Grippe+Tétanos+Rage vs Rhino), date modifiable → `next_reminder_override`
- Galerie : suppression de photo (Famille), partage/téléchargement corrigés (l'ancien téléchargement ignorait l'attribut `download` sur URL cross-origin), grille en miniatures + lazy-loading avec repli sur la photo pleine taille si pas de miniature
- VisiteSheet/VisiteProSheet : génération de miniature (`thumbnail_url`) à l'upload d'une photo d'ambiance, best-effort (n'empêche jamais l'upload de l'original en cas d'échec) — même pattern que la Galerie
- Fiches Chevaux (liste + fiche détail) : vignette photo réelle (`src/lib/horsePhotos.ts`, assets `src/assets/chevaux/`) à la place de l'initiale, avec repli sur `photo_url` puis initiale si aucune photo bundlée
- Soins → Rappels vaccins : liste détaillée triée par échéance croissante ("Vaccin(s) — chevaux concernés — avant le [date]", regroupe toutes les échéances connues même hors fenêtre d'alerte), date modifiable inline via `<input type="date">` gaté par une popup "Date validée avec le vétérinaire ?" avant écriture de `next_reminder_override`
- Accueil : photo d'ambiance tirée au hasard à chaque ouverture (plus la dernière uploadée), bouton "Démarrer une visite pro" repositionné sous la photo
- VisiteProSheet — Dentiste : DentistePicker (Loïc Hensmans, photo bundlée `src/assets/dentistes/`), flux "Soin dentiste" en cascade (Nivellement → Extraction), remplace le placeholder — table `dentistes` créée et confirmée
- VisiteProSheet — Vétérinaire : bouton "Soin véto" ouvre `SoinVetoSheet` (horodatage, soin en texte libre, chevaux concernés en tags colorés, commentaire, case "Rappel" optionnelle → date + texte, écrit dans `health_events` + `soin_reminders` si rappel coché) — table `soin_reminders` créée et confirmée
- Soins.tsx : nouvelle section "Rappels soins" (`SoinReminders`), affiche les rappels dont l'échéance est à ≤ 7 jours (ou dépassée), triés par date
- FicheCheval : "Historique médical" éclaté en 3 sections pliables avec compteur à droite du titre (Vaccins / Soins / Bobos, repliées par défaut) :
  - **Vaccins** : prochains rappels connus pour ce cheval + lien "Historique complet" ouvrant `VaccinHistorySheet` (ordre antéchronologique, filtres Tous/Grippe/Tétanos/Rhinopneumonie/Rage)
  - **Soins** (Véto/Maréchal/Ostéo/Dentiste) : `health_events` avec `pathology_id` null ET `type` dans l'énumération métier — exclut les bobos "Autre" à note libre (BoboWizard) qui n'ont pas de `type` métier
  - **Bobos** : le reste (liés à une pathologie, ou notes libres "Autre" sans type métier)
- FicheCheval : en-tête photo/nom en layout côte-à-côte (photo agrandie à gauche, nom/race/badge à droite) au lieu d'empilé centré — cadre coloré d'en-tête conservé à taille quasi identique (~1/3 écran) ; nom en police réduite au-delà de 10 caractères pour éviter la troncature
- VaccinHistorySheet : quand un vaccin précis est filtré (pas "Tous"), le nom du vaccin n'est plus répété sur chaque ligne (déjà induit par le filtre) — seulement Dr / lieu (normal) / date (gras)
- Généalogie complète : 29 individus en base (7 actifs + 22 "cavalerie historique", `horses.is_active=false`), importés depuis l'organigramme/fichier généalogique fournis par l'utilisateur. Chaîne multi-génération résolue via `pere_id`/`mere_id`/`pdm_id` chaque fois que l'ancêtre est aussi dans notre cavalerie (ex. Cerise 1977 → Pomme → Kwetsche → Échalote/Hakéa/Pamplemousse), sinon texte libre (ancêtres externes). Liens IFCE réels sur les 15 individus qui en ont une. FicheCheval : "Père de mère" est désormais cliquable comme Père/Mère (résolution via `pdm_id`) — la fiche existante sert de vue généalogie interactive (navigation de proche en proche), pas de nouvel écran dédié. `Chevaux.tsx` "Cavalerie historique" (déjà présente) affiche automatiquement les 22. `types.ts` `Horse`/`Genealogy` alignés sur le schéma réel (colonnes `sex`, `died_at`, `naisseur`, `adresse_elevage`, `generation`, `pdm_id`, `pere_url`/`mere_url`/`pdm_url` existaient déjà en base mais absentes du type)

Tables Supabase existantes : `health_events`, `health_event_visits`, `farm_alerts`, `ambiance_photos`, `photo_tags`, `vaccinations`, `vaccine_exclusions`, `veterinaires`, `marechaux`, `osteopathes`, `dentistes`, `soin_reminders`, `invoices`, `invoices_staging`, `expenses` (RLS confirmé : Famille = ALL, Groom = aucun accès). `invoices`/`expenses` utilisées par l'écran Finances ; `invoices_staging` toujours sans code applicatif (réservée au pipeline OCR).

## Roadmap

- S5 (suite) : pipeline OCR factures (n8n + Claude Vision → `invoices_staging`, relecture/validation avant écriture dans `invoices`/`expenses`)
- S6 : module Groom (paiement par visite, max 1 visite/jour, compteurs mensuels, workflow "marquer soldé")
- Notifications push via Firebase FCM
- Ingestion WhatsApp pour saisie terrain (phase 2)
- Migration logique rappels vaccins depuis Excel vers Supabase/app

## Outils

GitHub (édition web historique, migration possible vers édition directe via Claude Code) · Vercel (CI/CD auto) · Supabase SQL Editor (pas de CLI Supabase) · Lucide Icons + Tabler Icons · piexifjs (EXIF) · WeasyPrint / openpyxl (génération PDF/Excel de référence).
