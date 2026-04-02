"use client";
import { useState, useEffect, useCallback } from "react";
import { CHAIN_ID_HEX, addGenLayerNetwork } from "./genlayer";

export type WalletState = "disconnected" | "connecting" | "wrong_network" | "connected";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [state, setState] = useState<WalletState>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const checkChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const id: string = await window.ethereum.request({ method: "eth_chainId" });
      setState(id.toLowerCase() === CHAIN_ID_HEX.toLowerCase() ? "connected" : "wrong_network");
    } catch {}
  }, []);

  // Auto-reconnect if wallet was previously connected
  useEffect(() => {
    const saved = localStorage.getItem("fc_wallet");
    if (saved && window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" })
        .then((accs: string[]) => {
          if (accs[0]) { setAddress(accs[0]); checkChain(); }
        })
        .catch(() => {});
    }
  }, []);

  // Listen for chain / account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onChain = () => checkChain();
    const onAcc = (accs: string[]) => {
      if (!accs[0]) { setAddress(null); setState("disconnected"); }
      else { setAddress(accs[0]); checkChain(); }
    };
    window.ethereum.on("chainChanged", onChain);
    window.ethereum.on("accountsChanged", onAcc);
    return () => {
      window.ethereum.removeListener("chainChanged", onChain);
      window.ethereum.removeListener("accountsChanged", onAcc);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) { setError("MetaMask not found — please install it."); return; }
    setState("connecting"); setError(null);
    try {
      const accs: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accs[0]) throw new Error("No account returned");
      setAddress(accs[0]);
      localStorage.setItem("fc_wallet", accs[0]);
      await checkChain();
    } catch (e: any) {
      setError(e.message || "Connection failed");
      setState("disconnected");
    }
  }, [checkChain]);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
      setState("connected");
    } catch (e: any) {
      if (e.code === 4902) {
        // Chain not yet added — add it automatically
        try {
          await addGenLayerNetwork();
          setState("connected");
        } catch (addErr: any) {
          setError(addErr.message || "Failed to add network");
        }
      } else {
        setError(e.message || "Failed to switch network");
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setState("disconnected");
    localStorage.removeItem("fc_wallet");
  }, []);

  return {
    address, state, error,
    connect, disconnect, switchNetwork,
    isConnected: state === "connected",
    isWrongNetwork: state === "wrong_network",
  };
}

declare global { interface Window { ethereum?: any; } }
