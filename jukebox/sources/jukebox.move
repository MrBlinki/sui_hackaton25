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

	// --- Constants ---
	const ONE_SUI: u64 = 1_000_000_000;

	public struct Jukebox has key {
		id: UID,
		owner: address,
		fee: u64,
		last_buyer: address,
		current_track: String,
	}

	fun init(ctx: &mut TxContext) {
		transfer::share_object(
			Jukebox {
				id: object::new(ctx),
				owner: ctx.sender(),
				fee: ONE_SUI,
				last_buyer: ctx.sender(),
				current_track: b"Silence".to_string(),
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

		// --- Check if change must be sent back ---
		if (paid > jukebox.fee) {
			let change = split(&mut payment, paid - jukebox.fee, ctx);
			transfer::public_transfer(change, sender(ctx));
		};

		// --- Send payment to jukebox owner ---
		transfer::public_transfer(payment, jukebox.owner);

		// --- To implement : send payment to artist ---
		jukebox.last_buyer = sender(ctx);
		jukebox.current_track = new_track;
	}

}