// App.tsx
'use client'
import { useCurrentAccount } from "@mysten/dapp-kit";
import { isValidSuiObjectId } from "@mysten/sui/utils";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Billboard } from "./Billboard";

function App() {
  const currentAccount = useCurrentAccount();
  const [billboardId, setBillboardId] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (isValidSuiObjectId(hash)) setBillboardId(hash);
  }, []);

  const goHome = () => {
    window.location.hash = '';
    setBillboardId(null);
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="min-h-[500px]">
        <CardContent className="pt-6">
          {!currentAccount ? (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connect your wallet
              </h2>
              <p className="text-gray-600">Then open a billboard object by ID in the URL hash.</p>
              <p className="text-gray-500 mt-2 text-sm">
                Example: <code>https://yourapp/#0x...billboard_object_id</code>
              </p>
            </div>
          ) : billboardId ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Button onClick={goHome} variant="outline">← Change billboard</Button>
                <div className="text-sm text-gray-500">
                  Billboard: {billboardId.slice(0, 8)}...{billboardId.slice(-8)}
                </div>
              </div>
              <Billboard id={billboardId} />
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No billboard selected</h2>
              <p className="text-gray-600">Put a Billboard object ID in the URL hash to view/update it.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
