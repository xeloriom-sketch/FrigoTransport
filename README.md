# FrigoTransport

Application web progressive (PWA) de suivi GPS de flotte frigorifique. Permet au patron de surveiller ses camions en temps réel depuis un dashboard, et aux ouvriers de déclarer leur prise de poste via QR code.

**Production** : https://xeloriom-sketch.github.io/FrigoTransport/

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | Next.js 14 (export statique) |
| Base de données | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth |
| Carte | Leaflet.js + Google Maps (via GoogleMutant) |
| Style | Tailwind CSS |
| Déploiement | GitHub Pages via GitHub Actions |
| Hors-ligne | Service Worker + IndexedDB |

---

## Fonctionnalités

### Dashboard admin (`/admin/`)
- Suivi GPS en temps réel de tous les camions actifs
- Marqueur animé avec flèche orientée dans la direction de déplacement (style Uber)
- Carte Google Maps (rues, restaurants, POIs) — fallback CartoDB Voyager
- Popup au clic : nom, conducteur, vitesse, adresse géocodée, heure du dernier signal
- Stats live : camions actifs, ouvriers, positions GPS
- Tableau des affectations (filtre Tous / Actifs / Terminés)
- **Alertes GPS** : notification navigateur si un camion actif n'envoie plus de position depuis 30 min
- Wake Lock : l'écran reste allumé pendant la surveillance

### Page ouvrier (`/worker/`)
- Prise de poste par scan QR code du camion (caméra native)
- Suivi GPS continu toutes les 5 secondes
- Carte temps réel de sa propre position
- Chrono de service en cours
- Bouton "Camion rangé" pour clôturer le service
- **Notification** : si le GPS est inactif depuis 30 min, le Service Worker notifie l'ouvrier d'ouvrir l'app

### Gestion des camions (`/admin/trucks/`)
- Ajout / suppression de camions
- Génération de QR codes (impression ou partage)

### Gestion des ouvriers (`/admin/workers/`)
- Création de comptes ouvriers (email + mot de passe)
- Suppression de comptes

### Historique des trajets (`/admin/history/`)
- Sélection camion + date → trajet complet affiché sur la carte
- Polyline colorée par vitesse : vert (normal) / orange (> 70 km/h) / rouge (> 90 km/h)
- Stats : distance totale, durée, vitesse moyenne/max, nombre d'excès de vitesse
- Timeline scrollable : départ, excès détectés, arrivée

---

## Architecture

```
app/
├── layout.tsx              # Layout racine + PWAUpdater + ErrorBoundary
├── page.tsx                # Redirection vers /login ou /admin ou /worker
├── login/                  # Page de connexion
├── register/               # Inscription ouvrier (via lien admin)
├── scan/                   # Scan QR code universel
├── admin/
│   ├── layout.tsx          # Layout admin (nav, header, Wake Lock)
│   ├── page.tsx            # Dashboard principal
│   ├── trucks/             # Gestion camions
│   ├── workers/            # Gestion ouvriers
│   └── history/            # Historique des trajets
└── worker/
    └── page.tsx            # Interface ouvrier (scan → service → carte)

components/
├── LiveMap.tsx             # Carte Leaflet + Google Maps (marqueurs animés)
├── TripMap.tsx             # Carte historique (polyline colorée)
├── PWAUpdater.tsx          # Popup changelog + détection mise à jour SW
├── ErrorBoundary.tsx       # Écran d'erreur + reset cache SW
├── GPSAlertMonitor.tsx     # Surveillance inactivité GPS 30 min (admin)
├── WorkerNavigation.tsx    # Composant navigation/adresse ouvrier
└── InstallPWA.tsx          # Bannière "Installer l'app"

public/
└── sw.js                   # Service Worker : cache, GPS queue IndexedDB,
                            # Background Sync, notifications persistantes
```

---

## Base de données Supabase

### Tables principales

| Table | Description |
|-------|-------------|
| `profiles` | Utilisateurs (admin / worker), lié à `auth.users` |
| `trucks` | Camions (nom, plaque, token QR) |
| `assignments` | Affectations ouvrier ↔ camion (départ, fin, is_active) |
| `locations` | Points GPS (lat, lng, speed, accuracy, heading, timestamp) |

### Politiques RLS
- Les ouvriers ne voient que leur propre affectation active
- Les admins voient tout
- Insertions `locations` autorisées pour le worker authentifié de l'affectation

---

## Service Worker

Le SW (`public/sw.js`) gère :

1. **Cache réseau-first** — ressources statiques mises en cache, réseau en priorité
2. **GPS Queue (IndexedDB)** — points GPS sauvegardés localement si hors-ligne, synchronisés dès que le réseau revient (Background Sync)
3. **Notification persistante** — badge "GPS actif — Camion X" visible dans la barre de notifications Android quand l'ouvrier est en service
4. **Inactivité GPS** — Periodic Background Sync vérifie toutes les ~15 min si le dernier signal GPS dépasse 30 min → notification de rappel

---

## Développement local

```bash
git clone https://github.com/xeloriom-sketch/FrigoTransport.git
cd FrigoTransport
npm install
```

Créer `.env.local` :
```
NEXT_PUBLIC_SUPABASE_URL=https://pomscilzzjnlevrwyvap.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SUPABASE_SERVICE_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
```

```bash
npm run dev      # http://localhost:3131
npm run build    # Build de production
```

---

## Déploiement

Le déploiement est automatique via GitHub Actions à chaque push sur `main`. Le build Next.js en export statique est déployé sur GitHub Pages.

**À chaque déploiement** : incrémenter `APP_VERSION` dans `components/PWAUpdater.tsx` et mettre à jour le `CHANGELOG` — la popup de mise à jour s'affiche automatiquement chez tous les utilisateurs.

---

## Versions

| Version | Nouveautés principales |
|---------|----------------------|
| v1.9.0 | Alertes GPS 30 min, fix écran noir, ErrorBoundary |
| v1.8.0 | Google Maps, marqueur corrigé, adresse dans popup, Wake Lock global |
| v1.7.0 | Popup mise à jour automatique, cache SW v3 |
| v1.6.0 | Fix camion dans la mer, padding mobile, filtre GPS |
| v1.5.0 | Carte Google Maps-like, GPS 5s, zoom rue, animations modales |
| v1.4.0 | Popup nouveautés, changelog redesigné |
| v1.0.0 | Lancement initial : scan QR, GPS, dashboard, gestion flotte |
