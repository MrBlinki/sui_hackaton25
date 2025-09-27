import { getFullnodeUrl } from "@mysten/sui/client";
import {
  // 👇 add these exports in your constants file (see next block)
  DEVNET_JUKEBOX_PACKAGE_ID,
  DEVNET_JUKEBOX_OBJECT_ID,
  TESTNET_JUKEBOX_PACKAGE_ID, // placeholders ok if you don't have them yet
  TESTNET_JUKEBOX_OBJECT_ID,
  MAINNET_JUKEBOX_PACKAGE_ID,
  MAINNET_JUKEBOX_OBJECT_ID,
} from "./constants";
import { createNetworkConfig } from "@mysten/dapp-kit";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
  createNetworkConfig({
    devnet: {
      url: getFullnodeUrl("devnet"),
      variables: {
        // 👇 new: expose jukebox variables
        jukeboxPackageId: DEVNET_JUKEBOX_PACKAGE_ID,
        jukeboxObjectId: DEVNET_JUKEBOX_OBJECT_ID
      },
    },
    testnet: {
      url: getFullnodeUrl("testnet"),
      variables: {
        // 👇 testnet values (use real IDs or leave as empty strings)
        jukeboxPackageId: TESTNET_JUKEBOX_PACKAGE_ID,
        jukeboxObjectId: TESTNET_JUKEBOX_OBJECT_ID
      },
    },
    mainnet: {
      url: getFullnodeUrl("mainnet"),
      variables: {

        // 👇 mainnet values (use real IDs or leave as empty strings)
        jukeboxPackageId: MAINNET_JUKEBOX_PACKAGE_ID,
        jukeboxObjectId: MAINNET_JUKEBOX_OBJECT_ID
      },
    },
  });

export { useNetworkVariable, useNetworkVariables, networkConfig };
