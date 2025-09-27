/*
/// Module: billboard
module billboard::billboard;
*/

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions


module billboard::billboard {
	//use sui::object::UID;
	//use sui::transfer;
	use std::string::String;
	use sui::tx_context::{sender};
	use sui::coin::{Coin, value, split};
	use sui::sui::SUI;

	const E_INSUFFICIENT_PAYMENT: u64 = 1; // Custom error code
	const ONE_SUI: u64 = 1_000_000_000;

	public struct Billboard has key {
		id: UID,
		owner: address,
		fee: u64,
		last_writer: address,
		text: String,
	}

	/*
	 * The Capability which grants the Billboard owner the right to manage the billboard.
	 * Management of the billboard is not implemented yet.
	 */
	public struct BillboardOwnerCap has key, store {
		id: UID,
	}

	/*
	 * Called only once, upon module publication.
	 * It must be private.
	 * Transfers the BillboardOwnerCap to the sender (the publisher).
	 */
	fun init(ctx: &mut TxContext) {
		transfer::transfer(BillboardOwnerCap {
			id: object::new(ctx)
		}, ctx.sender());

		transfer::share_object(Billboard {
			id: object::new(ctx),
			owner: ctx.sender(),
			fee: ONE_SUI,
			last_writer: ctx.sender(),
			text: b"Replace me if you dare!".to_string(),
		})
	}

	public fun update_text(
		b: &mut Billboard,
		mut payment: Coin<SUI>,
		new_text: String,
		ctx: &mut TxContext
	) {
		let paid = value(&payment);
		assert!(paid >= ONE_SUI, E_INSUFFICIENT_PAYMENT);

		if (paid > ONE_SUI) {
			let change = split(&mut payment, paid - ONE_SUI, ctx);
			transfer::public_transfer(change, sender(ctx));
		};

		// `payment` now holds exactly ONE_SUI – send it to the billboard owner
		transfer::public_transfer(payment, b.owner);

		// Update billboard state
		b.last_writer = sender(ctx);
		b.text = new_text;
	}
}