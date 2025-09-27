# Fichiers Audio de Démonstration

Pour tester le lecteur audio, vous devez ajouter vos fichiers audio dans le dossier `/public/audio/`.

Les fichiers attendus sont :
- `rave_digger.mp3` ou `rave_digger.webm`
- `80s_vibe.mp3` ou `80s_vibe.webm`
- `running_out.mp3` ou `running_out.webm`

## Format recommandé

Pour une meilleure compatibilité, utilisez :
- **WebM** pour une qualité optimale et une taille réduite
- **MP3** comme format de fallback

Le lecteur essaiera automatiquement de charger le format WebM en premier, puis MP3 si WebM n'est pas disponible.

## Exemple d'ajout de fichiers

```bash
# Copiez vos fichiers audio dans le dossier public/audio/
cp votre-musique.mp3 public/audio/rave_digger.mp3
cp votre-musique2.mp3 public/audio/80s_vibe.mp3
cp votre-musique3.mp3 public/audio/running_out.mp3
```

## Personnalisation de la playlist

Vous pouvez modifier la playlist dans le fichier `app/audio-player/page.tsx` en changeant l'array `customPlaylist`.