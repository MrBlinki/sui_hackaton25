/*
/// Module: jukebox
module jukebox::jukebox;
*/

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions


module jukebox::jukebox {

	// --- TxContext ---
	use sui::tx_context::{sender};

	// --- Coins ---
	use sui::coin::{Coin, value, split};
	use sui::sui::SUI;

	// --- Data types ---
	use std::string::String;

	// --- Error codes ---
	const E_INSUFFICIENT_PAYMENT: u64 = 1;
	const E_TRACK_NOT_FOUND: u64 = 2;

	// --- Constants ---
	const ONE_SUI: u64 = 1_000_000_000;

	public struct Jukebox has key {
		id: UID,
		owner: address,
		fee: u64,
		last_buyer: address,
		current_track: String,
		collection: vector<Track>,
	}

	public struct Track has key, store {
		id: UID, // Probably not used for now but could make artists owners of tracks later
		artist: address,
		title: String,
	}

	fun initCollection() : vector<Track> {
		vector<Track>[]
	}

	public fun addTrack(jukebox: &mut Jukebox, title: String, ctx: &mut TxContext) {
		jukebox.collection.push_back(Track {
			id: object::new(ctx),
			artist: ctx.sender(),
			title,
		});
	}

	fun init(ctx: &mut TxContext) {
		transfer::share_object(
			Jukebox {
				id: object::new(ctx),
				owner: ctx.sender(),
				fee: ONE_SUI,
				last_buyer: ctx.sender(),
				current_track: b"Silence".to_string(),
				collection: initCollection(),
			}	
		)
	}

	public fun change_track(
		jukebox: &mut Jukebox,
		mut payment: Coin<SUI>,
		new_track: String,
		ctx: &mut TxContext
	) {

		let paid = value(&payment);

		// --- Check if payment is insufficient ---
		assert!(paid >= jukebox.fee, E_INSUFFICIENT_PAYMENT);

		// --- Search for track name in collection to retrieve artist address
		let mut track_exists = false;
		let mut track_artist: address = @0x0;
		let mut i = 0;
		let collection_length = vector::length(&jukebox.collection);

		while (i < collection_length) {
			let track = vector::borrow(&jukebox.collection, i);
			if (track.title == new_track) {
				track_exists = true;
				track_artist = track.artist;
				break;
			};
			i = i + 1;
		};

		// --- Check track has been found ---
		assert!(track_exists, E_TRACK_NOT_FOUND);

		// --- Check if change must be sent back ---
		if (paid > jukebox.fee) {
			let change = split(&mut payment, paid - jukebox.fee, ctx);
			transfer::public_transfer(change, sender(ctx));
		};

		// --- Send half of payment to artist of the track ---
		let artist_share = split(&mut payment, jukebox.fee / 2, ctx);
		transfer::public_transfer(artist_share, track_artist);
		// --- Send other half to owner of jukebox ---
		transfer::public_transfer(payment, jukebox.owner);

		jukebox.last_buyer = sender(ctx);
		jukebox.current_track = new_track;
	}

}