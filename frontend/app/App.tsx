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
import TrackUpload from "@/components/TrackUpload";
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

// Walrus track type
interface WalrusTrack {
  title: string;
  artist: string;
  walrus_blob_id: string;
  uploader: string;
  upload_timestamp: number;
  file_size: number;
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
  const [lastTrackChangeTime, setLastTrackChangeTime] = useState<number>(Date.now());

  // 🎵 Track management states
  const [showUpload, setShowUpload] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [walrusTracks, setWalrusTracks] = useState<WalrusTrack[]>([]);
  const [showWalrusPanel, setShowWalrusPanel] = useState(false);

  // Handle ESC key to close upload modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showUpload) {
        setShowUpload(false);
      }
    };

    if (showUpload) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showUpload]);

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
    { enabled: canQueryObject }
  );

  const fields = useMemo(() => getJukeboxFields(data?.data), [data]);

  // Create unified playlist with FIFO rotation (max 20 tracks) - no duplicates
  const unifiedPlaylist = useMemo(() => {
    const localTracks = PLAYLIST.map(track => ({ ...track, isWalrus: false }));
    const walrusPlaylistTracks = walrusTracks.map(track => ({
      title: track.title,
      file: track.walrus_blob_id, // Use blob ID as file identifier
      isWalrus: true,
      walrusBlobId: track.walrus_blob_id
    }));
    
    // Combine tracks and remove duplicates by title (Walrus tracks override local ones)
    const trackMap = new Map();
    
    // Add local tracks first
    localTracks.forEach(track => {
      trackMap.set(track.title.toLowerCase(), track);
    });
    
    // Add Walrus tracks (will override local tracks with same title)
    walrusPlaylistTracks.forEach(track => {
      trackMap.set(track.title.toLowerCase(), track);
    });
    
    const allTracks = Array.from(trackMap.values());
    const MAX_TRACKS = 20;
    
    if (allTracks.length > MAX_TRACKS) {
      // Keep the newest tracks (FIFO: newest Walrus tracks replace oldest local tracks)
      return allTracks.slice(-MAX_TRACKS);
    }
    
    return allTracks;
  }, [walrusTracks]);

  // Auto-play locally whenever the on-chain current_track changes
  useEffect(() => {
    const title = fields?.current_track;
    if (title && playerRef.current) {
      console.log('🎵 Chain says play:', title);
      
      // Check if this is a Walrus track in our unified list
      const walrusTrack = walrusTracks.find(track => track.title.toLowerCase() === title.toLowerCase());

      if (walrusTrack) {
        // It's a Walrus track - pass the blob ID to the player
        console.log('🌊 Playing Walrus track:', walrusTrack);
        playerRef.current.playWalrusTrack(title, walrusTrack.walrus_blob_id);
      } else {
        // It's a local track - use existing logic
        console.log('🎶 Playing local track:', title);
        playerRef.current.playByTitle(title);
      }

      // Clear chat messages when track changes and update timestamp
      setChatMessages([]);
      setLastTrackChangeTime(Date.now());
    }
  }, [fields?.current_track, walrusTracks]);

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

  // Fetch chat messages from blockchain events (only since last track change)
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

      // Filter messages since last track change, sort by timestamp (oldest first, newest at bottom) and limit to 10
      return messages
        .filter(msg => msg.timestamp >= lastTrackChangeTime)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-10); // Get last 10 messages

    } catch (error) {
      console.warn('Failed to fetch chat messages:', error);
      return [];
    }
  }, [suiClient, jukeboxPackageId, lastTrackChangeTime]);

  // Fetch Walrus tracks from blockchain events
  const fetchWalrusTracks = useCallback(async (): Promise<void> => {
    try {
      if (!jukeboxPackageId) return;

      // Query for track added events
      const response = await suiClient.queryEvents({
        query: {
          MoveEventType: `${jukeboxPackageId}::jukebox::TrackAddedEvent`
        },
        limit: 50,
        order: 'descending'
      });

      const tracks: WalrusTrack[] = response.data.map((event: any) => {
        const eventData = event.parsedJson;
        return {
          title: eventData.title,
          artist: eventData.artist,
          walrus_blob_id: eventData.walrus_blob_id,
          uploader: eventData.uploader,
          upload_timestamp: eventData.timestamp,
          file_size: 0, // Not available in event, would need to query chain
        };
      });

      setWalrusTracks(tracks);
      console.log('📡 Fetched Walrus tracks:', tracks.length);

    } catch (error) {
      console.warn('Failed to fetch Walrus tracks:', error);
    }
  }, [suiClient, jukeboxPackageId]);

  // Load Walrus tracks on component mount and periodically
  useEffect(() => {
    let cancelled = false;

    const pollWalrusTracks = async () => {
      try {
        await fetchWalrusTracks();
      } catch (e) {
        console.warn("Walrus tracks poll failed:", e);
      }
    };

    // Load immediately, then every 15 seconds
    pollWalrusTracks();
    const id = setInterval(pollWalrusTracks, 15000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchWalrusTracks]);

  // Chat message handler (micro-transaction with event)
  const handleChatMessage = async (message: string) => {
    try {
      setUiMsg(null);

      const tx = new Transaction();

      // Set an explicit gas budget
      tx.setGasBudget(GAS_BUDGET_MIST);

      // 📢 Call jukebox to emit a chat message event (no payment needed for chat)
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
          },
          onError: (err) => {
            console.error('Chat transaction failed:', err);
            throw err; // Re-throw to be caught by AudioPlayer
          },
        },
      );
    } catch (e: any) {
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

  // Add track to blockchain after Walrus upload
  const addTrackToJukebox = async (blobId: string, metadata: any) => {
    try {
      setUploadingTrack(true);
      setUiMsg(null);

      const tx = new Transaction();
      tx.setGasBudget(GAS_BUDGET_MIST);

      // Call add_track function
      tx.moveCall({
        target: `${jukeboxPackageId}::jukebox::add_track`,
        arguments: [
          tx.object(jukeboxObjectId),      // &mut Jukebox
          tx.pure.string(metadata.title),  // title: String
          tx.pure.string(metadata.artist), // artist: String
          tx.pure.string(blobId),          // walrus_blob_id: String
          tx.pure.u64(metadata.fileSize),  // file_size: u64
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async ({ digest }) => {
            await suiClient.waitForTransaction({ digest });
            console.log(`🎵 Track added to jukebox: ${digest}`);
            setUiMsg(`✅ Track "${metadata.title}" added successfully!`);

            // Refresh track list
            await fetchWalrusTracks();
            setUploadingTrack(false);
            setShowUpload(false);
          },
          onError: (err) => {
            console.error('Add track transaction failed:', err);
            setUiMsg(`❌ Failed to add track: ${err.message || 'Unknown error'}`);
            setUploadingTrack(false);
          },
        },
      );
    } catch (e: any) {
      console.error('Error adding track to jukebox:', e);
      setUiMsg(`❌ Error: ${e.message || 'Unknown error'}`);
      setUploadingTrack(false);
    }
  };

  // Handle successful Walrus upload
  const handleUploadSuccess = async (blobId: string, metadata: any) => {
    console.log('🎵 Walrus upload successful:', { blobId, metadata });

    if (!currentAccount) {
      setUiMsg('❌ Please connect your wallet to add track to jukebox');
      return;
    }

    // Add to blockchain
    await addTrackToJukebox(blobId, metadata);
    
    // Show Walrus panel briefly to highlight the new track
    setShowWalrusPanel(true);
    setTimeout(() => setShowWalrusPanel(false), 3000);
  };

  // Handle upload error
  const handleUploadError = (error: string) => {
    console.error('❌ Upload error:', error);
    setUiMsg(`❌ Upload failed: ${error}`);
    setUploadingTrack(false);
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

      {/* Hover zone for Walrus panel trigger */}
      {walrusTracks.length > 0 && (
        <div 
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '20px',
            height: '100vh',
            zIndex: 1400,
            cursor: 'pointer'
          }}
          onMouseEnter={() => setShowWalrusPanel(true)}
        />
      )}

      {/* Upload button */}
      {currentAccount && (
        <div style={{
          position: 'fixed',
          bottom: '135px',
          right: '3%',
          zIndex: 1000
        }}>
          <div
            onClick={() => setShowUpload(!showUpload)}
            className="audio-player__btn audio-player__upload-btn"
            title="Upload new track to Walrus"
          />
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(10px)'
          }}
          onClick={() => setShowUpload(false)}
        >
          {/* ESC hint */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '12px'
          }}>
            Press ESC to close
          </div>
          
          <div 
            style={{
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <TrackUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
              isUploading={uploadingTrack}
            />
          </div>
        </div>
      )}

      {/* Walrus Tracks Panel - Sliding */}
      {walrusTracks.length > 0 && (
        <div 
          style={{
            position: 'fixed',
            top: '50%',
            left: showWalrusPanel ? '0px' : '-280px',
            transform: 'translateY(-50%)',
            width: '300px',
            maxHeight: '400px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '0 12px 12px 0',
            padding: '16px',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderLeft: 'none',
            zIndex: 1500,
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)'
          }}
          onMouseEnter={() => setShowWalrusPanel(true)}
          onMouseLeave={() => setShowWalrusPanel(false)}
        >
          {/* Handle visible when closed */}
          <div style={{
            position: 'absolute',
            right: '-20px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '60px',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '0 8px 8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'white',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed'
          }}>
            🌊
          </div>
          
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: '#fff',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            paddingBottom: '8px'
          }}>
            🌊 Walrus Tracks ({walrusTracks.length})
          </h4>
          
          <div 
            className="walrus-panel-scroll"
            style={{
              maxHeight: '320px',
              overflow: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent'
            }}>
            {walrusTracks.map((track, index) => (
              <div key={track.walrus_blob_id} style={{
                fontSize: '12px',
                padding: '8px 10px',
                margin: '4px 0',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#fff',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              onClick={() => handleSearch(track.title)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{track.title}</div>
                <div style={{ opacity: 0.8, fontSize: '10px' }}>{track.artist}</div>
                <div style={{ opacity: 0.6, fontSize: '9px', marginTop: '2px' }}>Blob: {track.walrus_blob_id.slice(0, 8)}...</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local player mirrors the on-chain title list */}
      <AudioPlayer
        ref={playerRef}
        playlist={unifiedPlaylist}
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
