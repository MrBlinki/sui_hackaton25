"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectModal,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

import AudioPlayer, { AudioPlayerHandle } from "@/components/AudioPlayer";
import AddTrackForm from "@/components/AddTrackForm";
import { useNetworkVariable } from "../networkConfig";

// Type pour les tracks de la playlist
type PlaylistTrack = {
  title: string;
  file: string;
};

// ---- Types & helpers to read your Move object ----
type JukeboxFields = {
  current_track: string;
};
function getJukeboxFields(data?: any): JukeboxFields | null {
  if (!data || data.content?.dataType !== "moveObject") return null;
  return data.content.fields as unknown as JukeboxFields;
}

// ==== Important runtime constants ====
const JUKEBOX_FEE_MIST = 1_000_000_000n; // exactly 1 SUI
const GAS_BUDGET_MIST = 100_000_000n; // 0.1 SUI

export default function ArtistPage() {
  // IDs pulled from your network config
  const jukeboxPackageId = useNetworkVariable("jukeboxPackageId");
  const jukeboxObjectId = useNetworkVariable("jukeboxObjectId");

  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const playerRef = useRef<AudioPlayerHandle>(null);
  const [waiting, setWaiting] = useState(false);
  const [uiMsg, setUiMsg] = useState<string | null>(null);

  // Connect modal control + "retry after connect" memory
  const [showConnect, setShowConnect] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  // Add track form modal control
  const [showAddTrackForm, setShowAddTrackForm] = useState(false);

  // Playlist state
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([]);
  const [playlistInitialized, setPlaylistInitialized] = useState(false);

  // Guard against missing object ID in the query
  const canQueryObject = Boolean(jukeboxObjectId);

  // Query the on-chain jukebox object
  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getObject",
    {
      id: jukeboxObjectId || "",
      options: { showContent: true },
    },
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
      tx.setGasBudget(GAS_BUDGET_MIST);

      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(JUKEBOX_FEE_MIST)]);

      tx.moveCall({
        target: `${jukeboxPackageId}::jukebox::change_track`,
        arguments: [
          tx.object(jukeboxObjectId),
          payment,
          tx.pure.string(newTitle),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async ({ digest }) => {
            await suiClient.waitForTransaction({ digest });
            await refetch();
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

  // Called by the AudioPlayer component for track selection
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
    if (!currentAccount) {
      setPendingQuery(newTitle);
      setShowConnect(true);
      return;
    }
    await doChangeTrack(newTitle);
  };

  // Initialize playlist with audio files
  useEffect(() => {
    const initializePlaylist = async () => {
      if (playlistInitialized) return;
      
      try {
        const response = await fetch('/api/audio-files');
        const data = await response.json();
        
        if (data.files && data.files.length > 0) {
          const initialPlaylist: PlaylistTrack[] = data.files.map((file: any) => ({
            title: file.title,
            file: file.file
          }));
          
          setPlaylist(initialPlaylist);
          console.log('Playlist initialized with', initialPlaylist.length, 'tracks');
        }
        
        setPlaylistInitialized(true);
      } catch (error) {
        console.error('Error initializing playlist:', error);
        setPlaylistInitialized(true);
      }
    };

    initializePlaylist();
  }, [playlistInitialized]);

  // Function to add a new track to the playlist
  const handleAddTrack = (title: string, file: string) => {
    setPlaylist(prevPlaylist => [
      ...prevPlaylist,
      { title, file }
    ]);
  };

  return (
    <div className="bg-white text-black relative min-h-screen">
      {/* Affichage du loader pendant l'initialisation */}
      {!playlistInitialized && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-4">Chargement de la playlist...</div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        </div>
      )}

      {/* Add Track button - aligné avec le titre du morceau (seulement quand initialisé) */}
      {playlistInitialized && (
        <div className="absolute right-16 z-10" style={{ top: '3%' }}>
          <button
            onClick={() => setShowAddTrackForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 hover:shadow-xl"
            disabled={waiting}
          >
            + Add New Track
          </button>
        </div>
      )}

      {/* Status messages (seulement quand initialisé) - positionnés absolument pour éviter la bande blanche */}
      {playlistInitialized && (isPending || error || uiMsg) && (
        <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm rounded-md p-2 shadow-sm">
          {isPending && <div className="text-sm text-muted-foreground">Loading…</div>}
          {error && <div className="text-sm text-red-600">Error: {error.message}</div>}
          {uiMsg && <div className="text-sm">{uiMsg}</div>}
        </div>
      )}

      {/* Local player mirrors the on-chain title list */}
      {playlistInitialized && (
        <AudioPlayer
          ref={playerRef}
          playlist={playlist}
          onTrackSelect={handleSearch}
          isWaiting={waiting}
          isArtistMode={true}
        />
      )}

      {/* Add Track Form Modal */}
      <AddTrackForm
        isOpen={showAddTrackForm}
        onClose={() => setShowAddTrackForm(false)}
        onSuccess={(title: string, file: string) => {
          handleAddTrack(title, file);
          refetch();
        }}
      />

      {/* Wallet connect modal */}
      <ConnectModal
        trigger={<div />}
        open={showConnect}
        onOpenChange={setShowConnect}
      />
    </div>
  );
}