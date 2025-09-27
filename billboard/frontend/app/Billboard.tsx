// Billboard.tsx
"use client";

import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiObjectData } from "@mysten/sui/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import { useNetworkVariable } from "./networkConfig";

type BillboardFields = {
  id: { id: string };      // UID inner shape
  owner: string;           // address
  fee: string | number;    // u64
  last_writer: string;     // address
  text: string;            // String
};

export function Billboard({ id }: { id: string }) {
  const billboardPackageId = useNetworkVariable("billboardPackageId"); // add this to your networkConfig
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const { data, isPending, error, refetch } = useSuiClientQuery("getObject", {
    id,
    options: { showContent: true, showOwner: true },
  });

  const fields = getBillboardFields(data?.data);
  const [newText, setNewText] = useState("");
  const [waiting, setWaiting] = useState(false);
  const ONE_SUI = 1_000_000_000n; // 1 SUI in MIST

  const updateText = async () => {
    if (!billboardPackageId || !fields) return;
    setWaiting(true);

    const tx = new Transaction();

    // Split exactly 1 SUI from the gas coin
    const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(ONE_SUI)]);

    // Call: update_text(&mut Billboard, Coin<SUI>, String, &mut TxContext)
    tx.moveCall({
      target: `${billboardPackageId}::billboard::update_text`,
      arguments: [
        tx.object(id),           // &mut Billboard (shared object)
        payment,                 // Coin<SUI>
        tx.pure.string(newText), // String
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          await refetch();
          setNewText("");
          setWaiting(false);
        },
        onError: () => setWaiting(false),
      },
    );
  };

  if (isPending) {
    return (
      <Alert><AlertDescription className="text-muted-foreground">Loading…</AlertDescription></Alert>
    );
  }
  if (error || !fields) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ? `Error: ${error.message}` : "Billboard not found"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="shadow-lg bg-white text-black">
		<CardHeader>
			<CardTitle className="text-black">Billboard</CardTitle>
			<CardDescription className="text-black">
			Current message (costs 1 SUI to update)
			</CardDescription>
		</CardHeader>
		<CardContent className="space-y-6 text-black">
			<div className="p-4 rounded-xl border bg-white text-black">
			<div className="text-2xl font-semibold break-words text-black">
				{fields.text}
			</div>
			<div className="text-xs text-black mt-2">
				Last writer: {short(fields.last_writer)} · Owner: {short(fields.owner)}
			</div>
			</div>

			<div className="flex gap-2">
			<Input
				placeholder="Type a new message…"
				value={newText}
				onChange={(e) => setNewText(e.target.value)}
				className="bg-white text-black placeholder:text-black"
			/>
			<Button
				onClick={updateText}
				disabled={!currentAccount || !newText || waiting}
				className="bg-blue-600 hover:bg-blue-700 text-white"
			>
				{waiting ? <ClipLoader size={18} color="white" /> : "Update (1 SUI)"}
			</Button>
			</div>
		</CardContent>
		</Card>
  );
}

function getBillboardFields(data?: SuiObjectData | null) : BillboardFields | null {
  if (!data || data.content?.dataType !== "moveObject") return null;
  // Your Move struct: billboard::billboard::Billboard
  // TS SDK exposes it as .content.fields
  return data.content.fields as unknown as BillboardFields;
}

function short(a?: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
