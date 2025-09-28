"use client";

import React, { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useNetworkVariable } from "../networkConfig";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddTrackPage() {
  const [title, setTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uiMsg, setUiMsg] = useState<string | null>(null);

  const jukeboxPackageId = useNetworkVariable("jukeboxPackageId");
  const jukeboxObjectId = useNetworkVariable("jukeboxObjectId");
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const router = useRouter();

  const resetForm = () => {
    setTitle("");
    setAudioFile(null);
    setUiMsg(null);
  };

  const handleClose = () => {
    resetForm();
    router.push("/artist"); // Retourner à la page artiste
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "audio/mpeg" && file.type !== "audio/mp3") {
        setUiMsg("Veuillez sélectionner un fichier MP3 valide.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setUiMsg("Le fichier ne doit pas dépasser 10MB.");
        return;
      }
      setAudioFile(file);
      setUiMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setUiMsg("Veuillez entrer un titre pour la piste.");
      return;
    }
    
    if (!audioFile) {
      setUiMsg("Veuillez sélectionner un fichier audio.");
      return;
    }

    if (!currentAccount) {
      setUiMsg("Veuillez connecter votre wallet.");
      return;
    }

    try {
      setIsUploading(true);
      setUiMsg(null);

      // 1. D'abord, uploader le fichier
      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("title", title.trim());

      const uploadResponse = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Échec de l'upload du fichier");
      }

      const uploadData = await uploadResponse.json();
      const fileName = uploadData.fileName; // e.g., "my-song"

      // 2. Ensuite, ajouter la piste au jukebox on-chain
      const tx = new Transaction();
      tx.setGasBudget(100_000_000n); // 0.1 SUI

      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000n)]); // 1 SUI fee

      tx.moveCall({
        target: `${jukeboxPackageId}::jukebox::add_track`,
        arguments: [
          tx.object(jukeboxObjectId),
          payment,
          tx.pure.string(title.trim()),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async ({ digest }) => {
            await suiClient.waitForTransaction({ digest });
            setUiMsg(`Piste "${title}" ajoutée avec succès !`);
            
            // Attendre un peu puis rediriger
            setTimeout(() => {
              resetForm();
              router.push("/artist");
            }, 2000);
          },
          onError: (err) => {
            console.error("Transaction error:", err);
            setUiMsg(`Erreur lors de l'ajout de la piste: ${String((err as any)?.message || err)}`);
            setIsUploading(false);
          },
        }
      );
    } catch (error) {
      console.error("Upload error:", error);
      setUiMsg(`Erreur: ${(error as Error).message}`);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="text-4xl">🎵</div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ajouter une Nouvelle Piste</h1>
          <p className="text-gray-600 mt-2">Uploadez votre musique au jukebox</p>
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <Link 
            href="/artist" 
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Retour à l'espace artiste
          </Link>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Input */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Titre de la piste *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Ma Nouvelle Chanson"
                required
                disabled={isUploading}
              />
            </div>

            {/* File Input */}
            <div>
              <label htmlFor="audio" className="block text-sm font-medium text-gray-700 mb-2">
                Fichier Audio (MP3) *
              </label>
              <input
                type="file"
                id="audio"
                accept="audio/mp3,audio/mpeg"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
                disabled={isUploading}
              />
              <p className="text-xs text-gray-500 mt-1">Formats acceptés: MP3. Taille max: 10MB</p>
            </div>

            {/* Error/Success Messages */}
            {uiMsg && (
              <div className={`p-3 rounded-md text-sm ${
                uiMsg.includes("succès") 
                  ? "bg-green-50 text-green-800 border border-green-200" 
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {uiMsg}
              </div>
            )}

            {/* Wallet Connection Warning */}
            {!currentAccount && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ Vous devez connecter votre wallet pour ajouter une piste.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                disabled={isUploading}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isUploading || !currentAccount}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Upload en cours...
                  </>
                ) : (
                  "Ajouter la Piste"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}