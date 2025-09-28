// App.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ConnectModal,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

import AudioPlayer, { AudioPlayerHandle } from "@/components/AudioPlayer";
import { useNetworkVariable } from "./networkConfig";

// Local playlist used by the AudioPlayer (titles must match on-chain values)
const PLAYLIST = [
  { title: 'Horizon', file: 'horizon' },
  { title: 'skelet',  file: 'inside_out' },
  { title: 'wax',  file: 'wax' },
  { title: 'atmosphere',  file: 'atmosphere' }
];

// Chat message type
interface ChatMessage {
  id: string;
  address: string;
  message: string;
  timestamp: number;
}

// ---- Types & helpers to read your Move object ----
type JukeboxFields = {
  current_track: string;
};
function getJukeboxFields(data?: any): JukeboxFields | null {
  if (!data || data.content?.dataType !== "moveObject") return null;
  return data.content.fields as unknown as JukeboxFields;
}

// ==== Important runtime constants ====
// If your Move function enforces an exact fee, match it here.
const JUKEBOX_FEE_MIST = 1_000_000_000n; // exactly 1 SUI
// Give the tx an explicit gas budget so dry-run can simulate.
const GAS_BUDGET_MIST = 100_000_000n; // 0.1 SUI (tweak if needed)

export default function App() {
  // IDs pulled from your network config
  const jukeboxPackageId = useNetworkVariable("jukeboxPackageId"); // e.g. 0x4ece...
  const jukeboxObjectId = useNetworkVariable("jukeboxObjectId");   // e.g. 0x2fee...

  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const playerRef = useRef<AudioPlayerHandle>(null);
  const [waiting, setWaiting] = useState(false);
  const [uiMsg, setUiMsg] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // 🔓 Connect modal control + "retry after connect" memory
  const [showConnect, setShowConnect] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  // Guard against missing object ID in the query
  const canQueryObject = Boolean(jukeboxObjectId);

  // Query the on-chain jukebox object; refetch after tx success
  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getObject",
    {
      id: jukeboxObjectId || "",
      options: { showContent: true },
    },
    // @ts-expect-error: the hook accepts a 3rd "options" param in runtime; this silences TS
    { enabled: canQueryObject }
  );

  const fields = useMemo(() => getJukeboxFields(data?.data), [data]);

  // Auto-play locally whenever the on-chain current_track changes
  useEffect(() => {
    const title = fields?.current_track;
    if (title && playerRef.current) {
      playerRef.current.playByTitle(title);
    }
  }, [fields?.current_track]);

  // After the user connects, if we had a pending search, run it once.
  useEffect(() => {
    if (currentAccount && pendingQuery) {
      void doChangeTrack(pendingQuery);
      setPendingQuery(null);
      setShowConnect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount]);

  const missingIds = !jukeboxPackageId || !jukeboxObjectId;

  // Core tx logic (splits a Coin<SUI> and calls change_track)
  const doChangeTrack = async (newTitle: string) => {
    try {
      setUiMsg(null);
      setWaiting(true);

      const tx = new Transaction();

      // Set an explicit gas budget to help the dry-run determine costs.
      tx.setGasBudget(GAS_BUDGET_MIST);

      // 🪙 Split EXACTLY the fee your Move function expects (1 SUI here).
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(JUKEBOX_FEE_MIST)]);

      // Signature expected: change_track(&mut Jukebox, Coin<SUI>, String, &mut TxContext)
      tx.moveCall({
        target: `${jukeboxPackageId}::jukebox::change_track`,
        arguments: [
          tx.object(jukeboxObjectId),   // &mut Jukebox
          payment,                      // Coin<SUI> (exact fee)
          tx.pure.string(newTitle),     // String
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async ({ digest }) => {
            await suiClient.waitForTransaction({ digest });
            await refetch(); // pull fresh current_track from chain
            // setUiMsg(`Track changed on-chain to "${newTitle}".`);
            setWaiting(false);
          },
          onError: (err) => {
            setUiMsg(`Transaction failed: ${String((err as any)?.message || err)}`);
            setWaiting(false);
          },
        },
      );
    } catch (e: any) {
      setUiMsg(`Unexpected error: ${e?.message || String(e)}`);
      setWaiting(false);
    }
  };

  // Fetch chat messages from blockchain events
  const fetchChatMessages = useCallback(async (): Promise<ChatMessage[]> => {
    try {
      if (!jukeboxPackageId) return [];

      // Query for chat message events
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${jukeboxPackageId}::jukebox::ChatMessageEvent`
        },
        limit: 50, // Get last 50 events
        order: 'descending'
      });

      // Parse events into chat messages
      const messages: ChatMessage[] = events.data.map((event, index) => {
        const eventData = event.parsedJson as any;
        const timestamp = parseInt(event.timestampMs || Date.now().toString());

        return {
          id: event.id?.txDigest + '_' + index || Date.now().toString() + '_' + index,
          address: eventData.sender?.slice(0, 6) + '...' + eventData.sender?.slice(-4) || 'Unknown',
          message: eventData.message || eventData.content || 'Unknown message',
          timestamp: timestamp
        };
      });

      // Sort by timestamp (newest first) and limit to 10
      return messages
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

    } catch (error) {
      console.warn('Failed to fetch chat messages:', error);
      return [];
    }
  }, [suiClient, jukeboxPackageId]);

  // Chat message handler (micro-transaction with event)
  const handleChatMessage = async (message: string) => {
    try {
      setUiMsg(null);
      setWaiting(true);

      const tx = new Transaction();

      // Set an explicit gas budget
      tx.setGasBudget(GAS_BUDGET_MIST);

      // 💬 Split a small fee for chat messages (0.001 SUI)
      const CHAT_FEE_MIST = 1000000n; // 0.001 SUI
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(CHAT_FEE_MIST)]);

      // Send the chat fee to a burn address (or keep it simple and transfer to null address)
      tx.transferObjects([payment], tx.pure.address('0x0000000000000000000000000000000000000000000000000000000000000000'));

      // 📢 Call jukebox to emit a chat message event
      tx.moveCall({
        target: `${jukeboxPackageId}::jukebox::send_chat_message`,
        arguments: [
          tx.object(jukeboxObjectId),      // &mut Jukebox
          tx.pure.string(message),         // message content
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async ({ digest }) => {
            await suiClient.waitForTransaction({ digest });
            console.log(`💬 Chat message event emitted: ${digest}`);
            // Refresh chat messages after successful transaction
            const newMessages = await fetchChatMessages();
            setChatMessages(newMessages);
            setWaiting(false);
          },
          onError: (err) => {
            console.error('Chat transaction failed:', err);
            setWaiting(false);
            throw err; // Re-throw to be caught by AudioPlayer
          },
        },
      );
    } catch (e: any) {
      setWaiting(false);
      throw e;
    }
  };

  // Called by the Search component
  const handleSearch = async (rawTitle: string) => {
    const newTitle = rawTitle.trim();
    if (!newTitle) {
      setUiMsg("Type a track title first.");
      return;
    }
    if (waiting) {
      setUiMsg("Please wait for the previous transaction.");
      return;
    }
    if (missingIds) {
      setUiMsg("Jukebox IDs are not configured for this network.");
      return;
    }
    // If not connected, open wallet and remember the intended action
    if (!currentAccount) {
      setPendingQuery(newTitle);
      setShowConnect(true);
      return;
    }
    // Connected → run the tx
    await doChangeTrack(newTitle);
  };

  // ====== CHAT MESSAGES POLLING ======
  useEffect(() => {
    let cancelled = false;

    const pollChatMessages = async () => {
      try {
        const messages = await fetchChatMessages();
        if (!cancelled) {
          setChatMessages(messages);
        }
      } catch (e) {
        console.warn("Chat messages poll failed:", e);
      }
    };

    // Poll immediately, then every 10 seconds
    pollChatMessages();
    const id = setInterval(pollChatMessages, 10000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchChatMessages]);

  return (
    <div className="bg-white text-black">
      {isPending && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-red-600">Error: {error.message}</div>}
      {uiMsg && <div className="text-sm">{uiMsg}</div>}

      {/* {fields?.current_track && (
        <div className="text-sm">
          On-chain current track: <b>{fields.current_track}</b>
        </div>
      )} */}

      {/* Local player mirrors the on-chain title list */}
      <AudioPlayer
        ref={playerRef}
        playlist={PLAYLIST}
        onTrackSelect={handleSearch}
        isWaiting={waiting}
        currentAccount={currentAccount}
        onChatMessage={handleChatMessage}
        chatMessages={chatMessages}
      />

      {/* Wallet connect modal; lives anywhere under WalletProvider */}
      <ConnectModal
        trigger={<div />}
        open={showConnect}
        onOpenChange={setShowConnect}
      />
    </div>
  );
}
