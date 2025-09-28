// Walrus API utilities for decentralized storage
// Testnet endpoints for Walrus

const WALRUS_PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

export interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject: {
      id: string;
      storedEpoch: number;
      blobId: string;
      size: number;
      encodingType: string;
      certifiedEpoch: number;
      storage: {
        id: string;
        startEpoch: number;
        endEpoch: number;
        storageSize: number;
      };
    };
  };
  alreadyCertified?: {
    blobId: string;
    event: {
      txDigest: string;
      eventSeq: string;
    };
    endEpoch: number;
  };
}

export interface TrackMetadata {
  title: string;
  artist: string;
  duration?: number;
  fileSize: number;
  mimeType: string;
  uploadedAt: number;
}

export interface WalrusTrack {
  blobId: string;
  metadata: TrackMetadata;
  cachedUrl?: string; // Local cache URL if downloaded
}

/**
 * Upload an audio file to Walrus testnet
 */
export async function uploadToWalrus(file: File): Promise<{ blobId: string; metadata: TrackMetadata }> {
  try {
    console.log('🔄 Uploading to Walrus:', file.name);
    console.log('📡 Upload URL:', `${WALRUS_PUBLISHER_URL}/v1/store?epochs=5`);

    // Create metadata
    const metadata: TrackMetadata = {
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      artist: "Unknown Artist", // Could be extracted from ID3 tags later
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: Date.now(),
    };

    // Convert file to buffer for direct upload (like working backend)
    const fileBuffer = await file.arrayBuffer();

    const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=5`, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Full response details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        errorText
      });
      throw new Error(`Walrus upload failed: ${response.status} - ${errorText}`);
    }

    const result: WalrusUploadResponse = await response.json();
    console.log('📥 Walrus response:', result);

    let blobId: string;
    if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
      console.log('✅ New blob created:', blobId);
    } else if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
      console.log('✅ Blob already exists:', blobId);
    } else {
      throw new Error('Unexpected Walrus response format');
    }

    return { blobId, metadata };

  } catch (error) {
    console.error('❌ Walrus upload error:', error);
    throw new Error(`Failed to upload to Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download an audio file from Walrus by blob ID
 */
export async function downloadFromWalrus(blobId: string): Promise<Blob> {
  try {
    console.log('🔄 Downloading from Walrus:', blobId);

    const response = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Walrus download failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('✅ Downloaded blob:', blob.size, 'bytes');

    return blob;

  } catch (error) {
    console.error('❌ Walrus download error:', error);
    throw new Error(`Failed to download from Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a local cache URL for a Walrus blob
 */
export function createCacheUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Validate audio file before upload
 */
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('audio/')) {
    return { valid: false, error: 'File must be an audio file' };
  }

  // Check file size (max 50MB for testnet)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  // Check supported formats
  const supportedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: `Supported formats: ${supportedTypes.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Get Walrus blob URL for direct streaming (if supported)
 */
export function getWalrusStreamUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
}