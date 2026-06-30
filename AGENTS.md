# PEGASUS — Contexte projet pour l'agent

## Application
PWA mobile-first de gestion santé équin pour l'élevage Scalbert (Les Marchais).
7 chevaux actifs. 2 rôles : Famille (accès complet) et Groom (accès limité).
5 modules : Accueil, Chevaux, Soins/Bobos, Finances, Groom.

## Stack OBLIGATOIRE
- Frontend : React + TypeScript + Tailwind CSS
- Backend : Supabase (PostgreSQL + Auth + RLS + Storage)
- Déploiement : Vercel
- NE PAS utiliser Firebase, NE PAS utiliser Google Cloud

## Supabase
- Project URL : https://kldrsldtvymvbxwszdch.supabase.co/rest/v1/
- Anon key : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZHJzbGR0dnltdmJ4d3N6ZGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTg0MzcsImV4cCI6MjA5ODI3NDQzN30.hNiAhSYLwr34nF3KaVUSVvVdIX7SEqPChT0p_wCpl2k
- 11 tables déjà créées : horses, genealogy, health_events, pathologies,
  care_sessions, scheduled_cares, expenses, invoices, invoices_staging,
  groom_visits, users
- RLS activé sur toutes les tables

## Design
- Couleur principale : #2f6b3f (vert élevage)
- Fond crème : #F6F2EC
- Mobile-first, viewport 390px
- Bottom nav : 4 onglets (Accueil / Soins / Chevaux / Finances)

## Chevaux actifs (ordre canonique)
1. Échalote — #C0392B
2. Hakéa — #27AE60
3. Romarin — #1A1A1A
4. Cerise — #8B1A2A
5. Fraise — #1A3A6B
6. Pistache — #82C341
7. Pamplemousse — #E88080

## Règles absolues
- Tout en TTC, pas de gestion TVA
- occurred_at = horodatage terrain éditable (calendrier + HH:MM)
- Gravité bobos : 1 à 5 étoiles
- Groom : 7,00€ TTC par jour calendaire
- Dans chaque prompt touchant `types.ts` ou les fiches, il faut relire d'abord `types.ts` existant comme référence et ne jamais renommer un champ vers de l'anglais.