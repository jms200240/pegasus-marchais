import echalote from '../assets/chevaux/echalote.jpg'
import hakea from '../assets/chevaux/hakea.jpg'
import romarin from '../assets/chevaux/romarin.jpg'
import cerise1977 from '../assets/chevaux/cerise-1977.jpg'
import cerise from '../assets/chevaux/cerise.jpg'
import fraise from '../assets/chevaux/fraise.jpg'
import pistache from '../assets/chevaux/pistache.jpg'
import pamplemousse from '../assets/chevaux/pamplemousse.jpg'
import haschich from '../assets/chevaux/haschich.jpg'
import kwetsche from '../assets/chevaux/kwetsche.jpg'
import lichen from '../assets/chevaux/lichen.jpg'
import pomme from '../assets/chevaux/pomme.jpg'
import litchi from '../assets/chevaux/litchi.jpg'
import nectarine from '../assets/chevaux/nectarine.jpg'
import hyacinthe from '../assets/chevaux/hyacinthe.jpg'
import chataigne from '../assets/chevaux/chataigne.jpg'
import cassis from '../assets/chevaux/cassis.jpg'

// Photos statiques bundlées (cf. règle "Photos vétérinaires" étendue aux
// chevaux) — clé = nom canonique du cheval, pas de photo_url Supabase Storage.
export const HORSE_PHOTOS: Record<string, string> = {
  'Échalote': echalote,
  'Hakéa': hakea,
  'Romarin': romarin,
  'Cerise': cerise,
  'Fraise': fraise,
  'Pistache': pistache,
  'Pamplemousse': pamplemousse,
  'Haschich': haschich,
  'Kwetsche': kwetsche,
  'Lichen': lichen,
  'Pomme': pomme,
  'Cerise (1977)': cerise1977,
  'Litchi': litchi,
  'Nectarine': nectarine,
  'Hyacinthe': hyacinthe,
  'Chataigne': chataigne,
  'Cassis': cassis,
}
