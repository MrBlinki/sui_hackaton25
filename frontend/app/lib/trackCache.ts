// Local cache system for Walrus tracks
import { downloadFromWalrus, createCacheUrl, WalrusTrack } from './walrus';

interface CachedTrack {
  blobId: string;
  title: string;
  artist: string;
  localUrl: string;
  cachedAt: number;
  fileSize: number;
}

export class TrackCache {
  private cache = new Map<string, CachedTrack>();
  private readonly maxCacheSize = 100 * 1024 * 1024; // 100MB cache limit
  private currentCacheSize = 0;

  /**
   * Get a track from cache or download from Walrus
   */
  async getTrack(blobId: string, metadata: { title: string; artist: string; fileSize: number }): Promise<string> {
    // Check if already cached
    if (this.cache.has(blobId)) {
      const cached = this.cache.get(blobId)!;
      console.log('📦 Track loaded from cache:', cached.title);
      return cached.localUrl;
    }

    // Download from Walrus
    console.log('⬇️ Downloading track from Walrus:', blobId);
    try {
      const blob = await downloadFromWalrus(blobId);
      const localUrl = createCacheUrl(blob);

      // Check cache size limit
      if (this.currentCacheSize + metadata.fileSize > this.maxCacheSize) {
        this.evictOldest();
      }

      // Add to cache
      const cachedTrack: CachedTrack = {
        blobId,
        title: metadata.title,
        artist: metadata.artist,
        localUrl,
        cachedAt: Date.now(),
        fileSize: metadata.fileSize,
      };

      this.cache.set(blobId, cachedTrack);
      this.currentCacheSize += metadata.fileSize;

      console.log('✅ Track cached:', metadata.title, `(${this.formatFileSize(metadata.fileSize)})`);
      return localUrl;

    } catch (error) {
      console.error('❌ Failed to download track:', error);
      throw error;
    }
  }

  /**
   * Pre-load a track into cache (for background downloading)
   */
  async preloadTrack(blobId: string, metadata: { title: string; artist: string; fileSize: number }): Promise<void> {
    if (this.cache.has(blobId)) {
      return; // Already cached
    }

    try {
      await this.getTrack(blobId, metadata);
      console.log('🚀 Pre-loaded track:', metadata.title);
    } catch (error) {
      console.warn('⚠️ Failed to pre-load track:', metadata.title, error);
    }
  }

  /**
   * Check if a track is cached
   */
  isCached(blobId: string): boolean {
    return this.cache.has(blobId);
  }

  /**
   * Get cache info for a track
   */
  getCacheInfo(blobId: string): CachedTrack | null {
    return this.cache.get(blobId) || null;
  }

  /**
   * Clear a specific track from cache
   */
  clearTrack(blobId: string): void {
    const cached = this.cache.get(blobId);
    if (cached) {
      URL.revokeObjectURL(cached.localUrl);
      this.currentCacheSize -= cached.fileSize;
      this.cache.delete(blobId);
      console.log('🗑️ Removed track from cache:', cached.title);
    }
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    for (const cached of this.cache.values()) {
      URL.revokeObjectURL(cached.localUrl);
    }
    this.cache.clear();
    this.currentCacheSize = 0;
    console.log('🗑️ Cleared all cache');
  }

  /**
   * Evict oldest cached tracks to make space
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    // Remove oldest 25% of cache
    const toRemove = Math.max(1, Math.floor(entries.length * 0.25));
    for (let i = 0; i < toRemove; i++) {
      const [blobId] = entries[i];
      this.clearTrack(blobId);
    }

    console.log(`🧹 Evicted ${toRemove} old tracks from cache`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalTracks: number;
    totalSize: number;
    maxSize: number;
    usagePercent: number;
  } {
    return {
      totalTracks: this.cache.size,
      totalSize: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      usagePercent: (this.currentCacheSize / this.maxCacheSize) * 100,
    };
  }

  /**
   * List all cached tracks
   */
  getCachedTracks(): CachedTrack[] {
    return Array.from(this.cache.values()).sort((a, b) => b.cachedAt - a.cachedAt);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// Global cache instance
export const trackCache = new TrackCache();