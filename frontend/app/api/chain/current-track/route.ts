import { NextResponse } from 'next/server';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Configuration pour se connecter à SUI (testnet pour correspondre aux IDs)
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

import { TESTNET_JUKEBOX_OBJECT_ID } from '@/constants';

// Utilise l'ID du réseau devnet par défaut
// En production, on devrait détecter le réseau actuel
const JUKEBOX_OBJECT_ID = process.env.NEXT_PUBLIC_JUKEBOX_OBJECT_ID || TESTNET_JUKEBOX_OBJECT_ID;

export async function GET() {
  try {
    if (!JUKEBOX_OBJECT_ID || JUKEBOX_OBJECT_ID === "YOUR_JUKEBOX_OBJECT_ID") {
      return NextResponse.json({
        error: 'JUKEBOX_OBJECT_ID not configured',
        current_track: null
      });
    }

    // Lire l'objet Jukebox depuis la blockchain SUI
    const response = await suiClient.getObject({
      id: JUKEBOX_OBJECT_ID,
      options: { showContent: true }
    });

    if (!response.data) {
      return NextResponse.json({
        error: 'Jukebox object not found',
        current_track: null
      });
    }

    // Extraire les fields du Move object
    const content = response.data.content;
    if (content?.dataType !== 'moveObject') {
      return NextResponse.json({
        error: 'Invalid object type',
        current_track: null
      });
    }

    const fields = (content as any).fields;
    const currentTrack = fields?.current_track;

    console.log('Chain current track:', currentTrack);

    // Mapper le title vers un file si nécessaire
    const trackMapping: Record<string, string> = {
      'Horizon': 'horizon',
      'skelet': 'inside_out',
      'wax': 'wax',
      'atmosphere': 'atmosphere'
    };
	
return NextResponse.json({
      current_track: currentTrack,
      title: currentTrack,
      file: trackMapping[currentTrack] || null,
      last_buyer: fields?.last_buyer,
      fee: fields?.fee
    });

  } catch (error) {
    console.error('Error fetching from SUI blockchain:', error);
    return NextResponse.json({
      error: 'Failed to fetch from blockchain',
      details: error instanceof Error ? error.message : String(error),
      current_track: null
    }, { status: 500 });
  }
}
  