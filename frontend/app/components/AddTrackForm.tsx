"use client";

import React, { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useNetworkVariable } from "../networkConfig";

interface AddTrackFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddTrackForm: React.FC<AddTrackFormProps> = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uiMsg, setUiMsg] = useState<string | null>(null);

  const jukeboxPackageId = useNetworkVariable("jukeboxPackageId");
  const jukeboxObjectId = useNetworkVariable("jukeboxObjectId");
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const resetForm = () => {
    setTitle("");
    setAudioFile(null);
    setUiMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setUiMsg("Please enter a track title.");
      return;
    }
    
    if (!audioFile) {
      setUiMsg("Please select an audio file.");
      return;
    }

    if (!currentAccount) {
      setUiMsg("Please connect your wallet first.");
      return;
    }

    if (!jukeboxPackageId || !jukeboxObjectId) {
      setUiMsg("Jukebox configuration is missing.");
      return;
    }

    setIsUploading(true);
    setUiMsg(null);

    try {
      // First, upload the file
      const formData = new FormData();
      formData.append("file", audioFile);
      formData.append("title", title.trim());

      const uploadResponse = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      const { filename } = await uploadResponse.json();

      // Then, make the blockchain transaction
      const tx = new Transaction();
      tx.setGasBudget(100_000_000n); // 0.1 SUI gas budget

      tx.moveCall({
        target: `${jukeboxPackageId}::jukebox::addTrack`,
        arguments: [
          tx.object(jukeboxObjectId), // &mut Jukebox
          tx.pure.string(title.trim()), // String
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async ({ digest }) => {
            await suiClient.waitForTransaction({ digest });
            setUiMsg(`Track "${title}" added successfully!`);
            setIsUploading(false);
            
            // Call success callback and close after a short delay
            setTimeout(() => {
              onSuccess?.();
              handleClose();
            }, 1500);
          },
          onError: (err) => {
            setUiMsg(`Transaction failed: ${String((err as any)?.message || err)}`);
            setIsUploading(false);
          },
        }
      );
    } catch (error: any) {
      setIsUploading(false);
      setUiMsg(`Error: ${error.message || String(error)}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's an audio file
      if (!file.type.startsWith("audio/")) {
        setUiMsg("Please select an audio file.");
        return;
      }
      setAudioFile(file);
      setUiMsg(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-black">Add New Track</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
            disabled={isUploading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Track Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              placeholder="Enter track title"
              disabled={isUploading}
              required
            />
          </div>

          <div>
            <label htmlFor="audioFile" className="block text-sm font-medium text-gray-700 mb-1">
              Audio File *
            </label>
            <input
              type="file"
              id="audioFile"
              accept="audio/*"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              disabled={isUploading}
              required
            />
            {audioFile && (
              <p className="text-sm text-gray-600 mt-1">
                Selected: {audioFile.name}
              </p>
            )}
          </div>

          {uiMsg && (
            <div className={`text-sm p-2 rounded ${
              uiMsg.includes("successfully") 
                ? "bg-green-100 text-green-700" 
                : "bg-red-100 text-red-700"
            }`}>
              {uiMsg}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isUploading || !currentAccount}
            >
              {isUploading ? "Adding..." : "Add Track"}
            </button>
          </div>
        </form>

        {!currentAccount && (
          <p className="text-sm text-gray-600 mt-2 text-center">
            Please connect your wallet to add tracks.
          </p>
        )}
      </div>
    </div>
  );
};

export default AddTrackForm;