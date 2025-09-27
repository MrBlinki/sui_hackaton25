# 🎵 Intégration du Lecteur Audio Howler.js

Ce projet intègre un lecteur audio puissant basé sur Howler.js dans une application Next.js avec TypeScript.

## 🚀 Fonctionnalités

### Lecteur Audio Simple (`/simple-audio`)
- Interface moderne et responsive
- Contrôles de lecture (play, pause, suivant, précédent)
- Barre de progression cliquable
- Gestion du volume avec slider
- Playlist interactive
- Design avec gradients et effets de blur

### Lecteur Audio Avancé (`/audio-player`)
- Interface plein écran avec animations SiriWave
- Même fonctionnalités que le lecteur simple
- Animations d'ondes sonores (SiriWave)
- Design inspiré du lecteur original Howler.js

## 📁 Structure des Fichiers

```
app/
├── components/
│   ├── AudioPlayer.tsx          # Lecteur avancé avec SiriWave
│   ├── AudioPlayer.css          # Styles du lecteur avancé
│   ├── SimpleAudioPlayer.tsx    # Lecteur simple et moderne
│   ├── SimpleAudioPlayer.css    # Styles du lecteur simple
│   └── SiriWave.tsx            # Composant d'animation des ondes
├── audio-player/
│   └── page.tsx                # Page du lecteur avancé
├── simple-audio/
│   └── page.tsx                # Page du lecteur simple
└── page.tsx                    # Page d'accueil avec liens

public/
└── audio/                      # Dossier des fichiers audio
    ├── rave_digger.mp3
    ├── 80s_vibe.mp3
    ├── running_out.mp3
    └── README.md
```

## 🎧 Configuration Audio

Les fichiers audio doivent être placés dans `public/audio/`. Le format MP3 est supporté par défaut.

### Playlist personnalisée

Pour modifier la playlist, éditez les fichiers de page :

```typescript
const customPlaylist = [
  {
    title: 'Titre de la chanson',
    file: 'nom_du_fichier' // sans extension
  },
  // ... autres chansons
];
```

## 🛠 Technologies Utilisées

- **Howler.js** : Librairie audio JavaScript puissante
- **Next.js** : Framework React avec TypeScript
- **TailwindCSS** : Framework CSS utilitaire
- **CSS personnalisé** : Styles avancés avec gradients et animations

## 📱 Responsive Design

Les deux lecteurs sont entièrement responsives et s'adaptent aux différentes tailles d'écran :

- **Desktop** : Interface complète avec tous les contrôles
- **Tablet** : Adaptation des tailles et espacements
- **Mobile** : Interface optimisée pour le tactile

## 🎨 Personnalisation

### Couleurs et Thèmes

Les couleurs peuvent être personnalisées dans les fichiers CSS :

```css
/* Gradients principaux */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Couleurs d'accent */
background-color: rgba(255, 255, 255, 0.2);
```

### Animations

Les animations peuvent être ajustées dans `SiriWave.tsx` :

```typescript
<SiriWave
  speed={0.03}      // Vitesse de l'animation
  amplitude={0.7}   // Amplitude des ondes
  frequency={2}     // Fréquence des ondes
/>
```

## 🔧 Commandes de Développement

```bash
# Installation des dépendances
pnpm install

# Démarrage du serveur de développement
pnpm dev

# Build de production
pnpm build

# Démarrage en production
pnpm start
```

## 📚 API Howler.js

Le lecteur utilise les principales fonctionnalités de Howler.js :

- **Chargement** : Support des formats MP3, WebM, OGG
- **Contrôles** : Play, pause, stop, seek
- **Volume** : Contrôle global et par instance
- **Événements** : onplay, onpause, onend, onload, etc.
- **HTML5 Audio** : Streaming pour les gros fichiers

## 🎯 Utilisation

1. **Accédez à la page d'accueil** : `http://localhost:3001`
2. **Choisissez votre lecteur** :
   - Simple : interface moderne et compacte
   - Avancé : expérience immersive plein écran
3. **Ajoutez vos fichiers audio** dans `public/audio/`
4. **Personnalisez la playlist** dans les fichiers de page

## 🐛 Dépannage

### Les fichiers audio ne se chargent pas
- Vérifiez que les fichiers sont dans `public/audio/`
- Assurez-vous que les noms correspondent à la playlist
- Vérifiez la console pour les erreurs 404

### Problèmes d'hydratation
- Les composants utilisent `"use client"` pour le côté client
- SiriWave est chargé dynamiquement avec `ssr: false`

### Performance
- Les fichiers audio sont streamés en HTML5
- Utilisez des formats compressés (MP3, WebM)
- Optimisez la taille des fichiers audio

## 📄 Licence

Ce projet utilise les mêmes licences que ses dépendances :
- Howler.js : MIT License
- Next.js : MIT License