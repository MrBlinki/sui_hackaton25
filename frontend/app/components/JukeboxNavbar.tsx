"use client";

import * as React from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";

interface JukeboxNavbarProps {
  pageTitle?: string;
  pageDescription?: string;
  pageIcon?: string;
}

export default function JukeboxNavbar({ 
  pageTitle = "Jukebox SUI", 
  pageDescription = "Musique décentralisée",
  pageIcon = "🎵"
}: JukeboxNavbarProps) {
  const currentAccount = useCurrentAccount();

  return (
    <header className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo et titre personnalisé */}
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{pageIcon}</div>
            <div>
              <h1 className="text-xl font-bold">{pageTitle}</h1>
              <p className="text-gray-300 text-xs">{pageDescription}</p>
            </div>
          </div>

          {/* Wallet et compte */}
          <div className="flex items-center space-x-4">
            {currentAccount && (
              <div className="text-sm bg-gray-800 px-3 py-1 rounded-full">
                <span className="text-gray-400">Connecté: </span>
                <span className="font-mono text-green-400">
                  {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
                </span>
              </div>
            )}
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}