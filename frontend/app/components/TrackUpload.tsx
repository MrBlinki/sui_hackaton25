"use client";

import React, { useState, useCallback } from 'react';
import { uploadToWalrus, validateAudioFile } from '@/lib/walrus';

interface TrackUploadProps {
  onUploadSuccess: (blobId: string, metadata: any) => void;
  onUploadError: (error: string) => void;
  isUploading: boolean;
}

const TrackUpload: React.FC<TrackUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  isUploading
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    artist: '',
  });

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      onUploadError(validation.error!);
      return;
    }

    setSelectedFile(file);

    // Auto-fill title from filename
    if (!metadata.title) {
      const title = file.name.replace(/\.[^/.]+$/, "");
      setMetadata(prev => ({ ...prev, title }));
    }
  }, [metadata.title, onUploadError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !metadata.title.trim() || !metadata.artist.trim()) {
      onUploadError('Please fill in all fields and select a file');
      return;
    }

    try {
      const result = await uploadToWalrus(selectedFile);

      // Merge user metadata with upload metadata
      const fullMetadata = {
        ...result.metadata,
        title: metadata.title.trim(),
        artist: metadata.artist.trim(),
      };

      onUploadSuccess(result.blobId, fullMetadata);

      // Reset form
      setSelectedFile(null);
      setMetadata({ title: '', artist: '' });

    } catch (error) {
      onUploadError(error instanceof Error ? error.message : 'Upload failed');
    }
  }, [selectedFile, metadata, onUploadSuccess, onUploadError]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="track-upload">
      <h3 className="track-upload__title">Upload New Track</h3>

      {/* File Drop Zone */}
      <div
        className={`track-upload__dropzone ${dragOver ? 'dragover' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        {selectedFile ? (
          <div className="track-upload__file-info">
            <div className="track-upload__file-name">📎 {selectedFile.name}</div>
            <div className="track-upload__file-size">{formatFileSize(selectedFile.size)}</div>
          </div>
        ) : (
          <div className="track-upload__placeholder">
            <div className="track-upload__icon">🎵</div>
            <div>Drag & drop an audio file here</div>
            <div className="track-upload__hint">or click to browse</div>
          </div>
        )}
      </div>

      {/* Metadata Form */}
      {selectedFile && (
        <div className="track-upload__form">
          <div className="track-upload__field">
            <label htmlFor="track-title">Track Title</label>
            <input
              id="track-title"
              type="text"
              value={metadata.title}
              onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter track title"
              disabled={isUploading}
              maxLength={100}
            />
          </div>

          <div className="track-upload__field">
            <label htmlFor="track-artist">Artist Name</label>
            <input
              id="track-artist"
              type="text"
              value={metadata.artist}
              onChange={(e) => setMetadata(prev => ({ ...prev, artist: e.target.value }))}
              placeholder="Enter artist name"
              disabled={isUploading}
              maxLength={100}
            />
          </div>

          <div className="track-upload__actions">
            <button
              className="track-upload__cancel"
              onClick={() => {
                setSelectedFile(null);
                setMetadata({ title: '', artist: '' });
              }}
              disabled={isUploading}
            >
              Cancel
            </button>

            <button
              className="track-upload__submit"
              onClick={handleUpload}
              disabled={isUploading || !metadata.title.trim() || !metadata.artist.trim()}
            >
              {isUploading ? (
                <>
                  <span className="track-upload__spinner">⟳</span>
                  Uploading to Walrus...
                </>
              ) : (
                'Upload to Jukebox'
              )}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .track-upload {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .track-upload__title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 16px;
          color: var(--text, #fff);
          text-align: center;
        }

        .track-upload__dropzone {
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 16px;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .track-upload__dropzone:hover,
        .track-upload__dropzone.dragover {
          border-color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.05);
        }

        .track-upload__dropzone.has-file {
          border-color: #4CAF50;
          background: rgba(76, 175, 80, 0.1);
        }

        .track-upload__placeholder {
          color: var(--text-dim, rgba(255, 255, 255, 0.7));
        }

        .track-upload__icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .track-upload__hint {
          font-size: 12px;
          margin-top: 4px;
          opacity: 0.7;
        }

        .track-upload__file-info {
          color: var(--text, #fff);
        }

        .track-upload__file-name {
          font-weight: bold;
          margin-bottom: 4px;
        }

        .track-upload__file-size {
          font-size: 12px;
          opacity: 0.7;
        }

        .track-upload__form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .track-upload__field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .track-upload__field label {
          font-size: 12px;
          font-weight: bold;
          color: var(--text, #fff);
        }

        .track-upload__field input {
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.1);
          color: var(--text, #fff);
          font-size: 14px;
          outline: none;
        }

        .track-upload__field input:focus {
          border-color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.15);
        }

        .track-upload__field input::placeholder {
          color: var(--text-dim, rgba(255, 255, 255, 0.5));
        }

        .track-upload__field input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .track-upload__actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .track-upload__cancel,
        .track-upload__submit {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .track-upload__cancel {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text, #fff);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .track-upload__cancel:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .track-upload__submit {
          background: #4CAF50;
          color: white;
        }

        .track-upload__submit:hover:not(:disabled) {
          background: #45a049;
          transform: translateY(-1px);
        }

        .track-upload__submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .track-upload__spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TrackUpload;