-- ============================================================
-- Pegasus — Module Groom (S6)
-- La table public.groom_visits existait déjà (posée à la fondation
-- du projet, cf. AGENTS.md, jamais exploitée côté application) avec
-- les colonnes : id, user_id, visit_date, amount_ttc (défaut 7.00),
-- paid_month, is_paid, paid_at, notes, created_at — et une RLS déjà
-- correcte (has_role('famille'/'groom')).
--
-- Seul ajustement nécessaire : la contrainte UNIQUE(user_id, visit_date)
-- empêchait d'enregistrer une 2e visite le même jour. Le workflow validé
-- autorise cette 2e visite (elle est enregistrée mais ne compte pas dans
-- le nombre de jours à payer — dédoublonnage géré côté application).
-- À exécuter dans le SQL Editor Supabase.
-- ============================================================

alter table public.groom_visits
  drop constraint groom_visits_user_id_visit_date_key;
