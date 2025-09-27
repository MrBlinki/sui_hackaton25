/// Module: Music Jukebox with Walrus Storage
module todo_list::music_jukebox;

use std::string::String;

/// 🎵 STRUCTURE : Un morceau de musique individuel
/// Cette structure contient UNIQUEMENT les métadonnées du track
/// Le fichier audio lui-même est stocké sur Walrus (réseau décentralisé)
public struct MusicTrack has store, copy, drop {
    title: String,           // 📝 Titre du morceau (ex: "Bohemian Rhapsody")
    artist: String,          // 👤 Nom de l'artiste (ex: "Queen")
    walrus_blob_id: String,  // 🔗 Identifiant unique Walrus pour récupérer le fichier MP3
    duration_seconds: u64,   // ⏱️ Durée en secondes (ex: 355 = 5min 55sec)
    added_by: address,       // 📍 Adresse wallet de la personne qui a ajouté ce track
}

/// 📻 STRUCTURE : La Jukebox principale
/// C'est le conteneur principal qui stocke tous les morceaux de musique
/// Une jukebox = une playlist partagée où tout le monde peut ajouter des tracks
public struct MusicJukebox has key, store {
    id: UID,                        // 🆔 Identifiant unique Sui pour cet objet
    tracks: vector<MusicTrack>,     // 📚 Liste de tous les morceaux (array dynamique)
    owner: address,                 // 👑 Propriétaire de cette jukebox (celui qui l'a créée)
}

/// Create a new music jukebox
public fun new(ctx: &mut TxContext): MusicJukebox {
    let jukebox = MusicJukebox {
        id: object::new(ctx),
        tracks: vector[],
        owner: ctx.sender(),
    };

    jukebox
}

/// 🎵 FONCTION PRINCIPALE : Ajouter un track à la jukebox
/// Cette fonction permet à n'importe qui d'ajouter un morceau de musique
/// ÉTAPES :
/// 1. L'utilisateur a déjà uploadé son MP3 sur Walrus → reçu un Blob ID
/// 2. L'utilisateur appelle cette fonction avec les métadonnées + Blob ID
/// 3. Le smart contract crée un MusicTrack et l'ajoute à la collection
/// 4. L'utilisateur PAIE les fees SUI pour cette transaction
public fun add_track(
    jukebox: &mut MusicJukebox,        // 📝 La jukebox à modifier (référence mutable)
    title: String,                     // 🎵 Titre du morceau (ex: "My Song")
    artist: String,                    // 👤 Nom de l'artiste (ex: "John Doe")
    walrus_blob_id: String,           // 🔗 ID du fichier sur Walrus (ex: "n3BKzEC2o...")
    duration_seconds: u64,            // ⏱️ Durée en secondes (ex: 180 pour 3min)
    ctx: &TxContext                   // 🌐 Contexte de la transaction (qui appelle, etc.)
) {
    // ✨ CRÉATION D'UN NOUVEAU TRACK
    // On prend toutes les infos fournies + l'adresse de celui qui ajoute
    let track = MusicTrack {
        title,                        // 📝 Titre fourni par l'utilisateur
        artist,                       // 👤 Artiste fourni par l'utilisateur
        walrus_blob_id,              // 🔗 Blob ID Walrus (clé pour récupérer l'audio)
        duration_seconds,            // ⏱️ Durée fournie par l'utilisateur
        added_by: ctx.sender(),      // 📍 Adresse wallet de celui qui ajoute le track
    };

    // 📥 AJOUT À LA COLLECTION
    // On ajoute le track à la fin de la liste des tracks de la jukebox
    jukebox.tracks.push_back(track);

    // 💰 NOTE : Les fees SUI sont automatiquement prélevées par Sui Network
    // pour cette transaction. L'utilisateur paie via son wallet.
}

/// Get the number of tracks in the jukebox
public fun get_track_count(jukebox: &MusicJukebox): u64 {
    jukebox.tracks.length()
}

/// Get a specific track by index
public fun get_track(jukebox: &MusicJukebox, index: u64): &MusicTrack {
    &jukebox.tracks[index]
}

/// Get track title
public fun get_track_title(track: &MusicTrack): String {
    track.title
}

/// Get track artist
public fun get_track_artist(track: &MusicTrack): String {
    track.artist
}

/// Get track Walrus blob ID
public fun get_track_blob_id(track: &MusicTrack): String {
    track.walrus_blob_id
}

/// Get track duration
public fun get_track_duration(track: &MusicTrack): u64 {
    track.duration_seconds
}

/// Get who added the track
public fun get_track_added_by(track: &MusicTrack): address {
    track.added_by
}

/// Remove a track by index (only owner)
public fun remove_track(jukebox: &mut MusicJukebox, index: u64, ctx: &TxContext): MusicTrack {
    assert!(ctx.sender() == jukebox.owner, 0);
    jukebox.tracks.remove(index)
}

/// Delete the jukebox
public fun delete(jukebox: MusicJukebox) {
    let MusicJukebox { id, tracks: _, owner: _ } = jukebox;
    id.delete();
}

/// Get jukebox owner
public fun get_owner(jukebox: &MusicJukebox): address {
    jukebox.owner
}