/// Module: Music Jukebox with Walrus Storage
module todo_list::music_jukebox;

use std::string::String;

/// A music track stored on Walrus
public struct MusicTrack has store, copy, drop {
    title: String,
    artist: String,
    walrus_blob_id: String,
    duration_seconds: u64,
    added_by: address,
}

/// Music Jukebox containing a collection of tracks
public struct MusicJukebox has key, store {
    id: UID,
    tracks: vector<MusicTrack>,
    owner: address,
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

/// Add a new music track to the jukebox
public fun add_track(
    jukebox: &mut MusicJukebox,
    title: String,
    artist: String,
    walrus_blob_id: String,
    duration_seconds: u64,
    ctx: &TxContext
) {
    let track = MusicTrack {
        title,
        artist,
        walrus_blob_id,
        duration_seconds,
        added_by: ctx.sender(),
    };

    jukebox.tracks.push_back(track);
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