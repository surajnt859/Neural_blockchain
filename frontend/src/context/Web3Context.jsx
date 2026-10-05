import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { ethers } from "ethers";

const Web3Context = createContext(null);
const DEMO_WALLET_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_WALLET === "true";

function getDeploymentBlock() {
  const configuredValue = import.meta.env.VITE_DEPLOYMENT_BLOCK;
  if (!configuredValue) {
    throw new Error("VITE_DEPLOYMENT_BLOCK must be configured to read wallet events.");
  }
  const value = Number(configuredValue);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("VITE_DEPLOYMENT_BLOCK must be a non-negative block number.");
  }
  return value;
}

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionError, setTransactionError] = useState(null);
  const [ethBalance, setEthBalance] = useState(null);
  const [neuralBalance, setNeuralBalance] = useState(null);

  const refreshBalances = useCallback(async (targetAccount = account, targetProvider = provider) => {
    if (!targetAccount || !targetProvider) {
      setEthBalance(null);
      setNeuralBalance(null);
      return;
    }
    const tokenAddress = import.meta.env.VITE_NEURAL_TOKEN_ADDRESS;
    if (!ethers.isAddress(tokenAddress || "")) {
      throw new Error("VITE_NEURAL_TOKEN_ADDRESS is not configured with a valid token contract.");
    }
    const { default: tokenArtifact } = await import("../contracts/NeuralToken.json");
    const token = new ethers.Contract(tokenAddress, tokenArtifact.abi, targetProvider);
    const [ethWei, tokenWei] = await Promise.all([
      targetProvider.getBalance(targetAccount),
      token.balanceOf(targetAccount),
    ]);
    setEthBalance(ethers.formatEther(ethWei));
    setNeuralBalance(ethers.formatUnits(tokenWei, 18));
  }, [account, provider]);

  const refreshTransactions = useCallback(async (targetAccount = account, targetProvider = provider) => {
    if (!targetAccount || !targetProvider) {
      setTransactions([]);
      setTransactionError(null);
      setTransactionsLoading(false);
      return;
    }
    setTransactionsLoading(true);
    setTransactionError(null);
    setTransactions([]);
    try {
    const marketplaceAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
    const tokenAddress = import.meta.env.VITE_NEURAL_TOKEN_ADDRESS;
    if (!ethers.isAddress(marketplaceAddress || "") || !ethers.isAddress(tokenAddress || "")) {
      throw new Error("Marketplace and NEURAL token contract addresses must be configured.");
    }
    const [{ default: marketplaceArtifact }, { default: tokenArtifact }] = await Promise.all([
      import("../contracts/ModelMarketplace.json"),
      import("../contracts/NeuralToken.json"),
    ]);
    const marketplace = new ethers.Contract(marketplaceAddress, marketplaceArtifact.abi, targetProvider);
    const token = new ethers.Contract(tokenAddress, tokenArtifact.abi, targetProvider);
    const fromBlock = getDeploymentBlock();
    const [ethPurchases, neuralPurchases, sentToken, receivedToken] = await Promise.all([
      marketplace.queryFilter(marketplace.filters.ModelPurchased(null, targetAccount), fromBlock),
      marketplace.queryFilter(marketplace.filters.NeuralPurchase(null, targetAccount), fromBlock),
      token.queryFilter(token.filters.Transfer(targetAccount, null), fromBlock),
      token.queryFilter(token.filters.Transfer(null, targetAccount), fromBlock),
    ]);
    const transferLogs = new Map();
    [...sentToken, ...receivedToken].forEach((log) => transferLogs.set(`${log.transactionHash}:${log.index}`, log));
    const blockNumbers = new Set([
      ...ethPurchases,
      ...neuralPurchases,
      ...transferLogs.values(),
    ].map((log) => log.blockNumber));
    const blockTimestamps = new Map(await Promise.all([...blockNumbers].map(async (number) => {
      const block = await targetProvider.getBlock(number);
      return [number, block ? block.timestamp : null];
    })));
    const purchases = [
      ...ethPurchases.map((log) => ({
        hash: log.transactionHash,
        type: "eth_purchase",
        modelId: log.args.id.toString(),
        counterparty: log.args.seller,
        amount: ethers.formatEther(log.args.price),
        currency: "ETH",
        tier: Number(log.args.tier),
        blockNumber: log.blockNumber,
      })),
      ...neuralPurchases.map((log) => ({
        hash: log.transactionHash,
        type: "neural_purchase",
        modelId: log.args.modelId.toString(),
        counterparty: targetAccount,
        amount: ethers.formatUnits(log.args.tokenAmount, 18),
        currency: "NEURAL",
        tier: Number(log.args.tier),
        blockNumber: log.blockNumber,
      })),
    ];
    const transfers = [...transferLogs.values()].map((log) => ({
      hash: log.transactionHash,
      type: log.args.from.toLowerCase() === targetAccount.toLowerCase() ? "neural_sent" : "neural_received",
      counterparty: log.args.from.toLowerCase() === targetAccount.toLowerCase() ? log.args.to : log.args.from,
      amount: ethers.formatUnits(log.args.value, 18),
      currency: "NEURAL",
      blockNumber: log.blockNumber,
    }));
    const allTransactions = [...purchases, ...transfers]
      .map((item) => ({
        ...item,
        timestamp: blockTimestamps.get(item.blockNumber),
        status: "confirmed",
      }))
      .sort((left, right) => right.blockNumber - left.blockNumber);
    setTransactions(allTransactions);
    } catch (transactionReadError) {
      setTransactionError(transactionReadError.message || "Could not read on-chain transactions.");
      throw transactionReadError;
    } finally {
      setTransactionsLoading(false);
    }
  }, [account, provider]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask browser extension was not detected.");
      return false;
    }
    setConnecting(true);
    setError(null);
    try {
      const nextProvider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const nextSigner = await nextProvider.getSigner();
      const nextAccount = await nextSigner.getAddress();
      const network = await nextProvider.getNetwork();
      setProvider(nextProvider);
      setSigner(nextSigner);
      setAccount(nextAccount);
      setIsDemo(false);
      setChainId(Number(network.chainId));
      await Promise.all([
        refreshBalances(nextAccount, nextProvider),
        refreshTransactions(nextAccount, nextProvider),
      ]);
      return true;
    } catch (connectError) {
      setError(connectError.message || "MetaMask connection failed.");
      return false;
    } finally {
      setConnecting(false);
    }
  }, [refreshBalances, refreshTransactions]);

  const connectDemoWallet = useCallback(async () => {
    const privateKey = import.meta.env.VITE_DEMO_PRIVATE_KEY;
    if (!DEMO_WALLET_ENABLED || !privateKey) {
      setError("Demo wallet is disabled. Enable it only in local development.");
      return false;
    }

    setConnecting(true);
    setError(null);
    try {
      const nextProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const network = await nextProvider.getNetwork();
      if (network.chainId !== 31337n) {
        throw new Error("The demo wallet only connects to the local Hardhat network (chain ID 31337).");
      }
      const nextSigner = new ethers.Wallet(privateKey, nextProvider);
      const nextAccount = await nextSigner.getAddress();
      setProvider(nextProvider);
      setSigner(nextSigner);
      setAccount(nextAccount);
      setIsDemo(true);
      setChainId(Number(network.chainId));
      await Promise.all([
        refreshBalances(nextAccount, nextProvider),
        refreshTransactions(nextAccount, nextProvider),
      ]);
      return true;
    } catch (connectError) {
      setError(connectError.message || "Hardhat demo wallet connection failed.");
      return false;
    } finally {
      setConnecting(false);
    }
  }, [refreshBalances, refreshTransactions]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setIsDemo(false);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setEthBalance(null);
    setNeuralBalance(null);
    setTransactions([]);
    setTransactionsLoading(false);
    setTransactionError(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (isDemo || !window.ethereum) return undefined;
    let active = true;
    const restoreConnection = async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (!active || accounts.length === 0) return;
        const nextProvider = new ethers.BrowserProvider(window.ethereum);
        const nextSigner = await nextProvider.getSigner(accounts[0]);
        const network = await nextProvider.getNetwork();
        setProvider(nextProvider);
        setSigner(nextSigner);
        setAccount(accounts[0]);
        setIsDemo(false);
        setChainId(Number(network.chainId));
        await Promise.all([
          refreshBalances(accounts[0], nextProvider),
          refreshTransactions(accounts[0], nextProvider),
        ]);
      } catch (restoreError) {
        if (active) setError(restoreError.message || "Could not restore the MetaMask connection.");
      }
    };
    restoreConnection();
    const onAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        return;
      }
      try {
        const nextProvider = new ethers.BrowserProvider(window.ethereum);
        const nextSigner = await nextProvider.getSigner(accounts[0]);
        const network = await nextProvider.getNetwork();
        setProvider(nextProvider);
        setSigner(nextSigner);
        setAccount(accounts[0]);
        setIsDemo(false);
        setChainId(Number(network.chainId));
        await Promise.all([
          refreshBalances(accounts[0], nextProvider),
          refreshTransactions(accounts[0], nextProvider),
        ]);
      } catch (accountError) {
        setError(accountError.message || "Could not load the selected MetaMask account.");
      }
    };
    const onChainChanged = async () => {
      const nextProvider = new ethers.BrowserProvider(window.ethereum);
      const network = await nextProvider.getNetwork();
      setProvider(nextProvider);
      setChainId(Number(network.chainId));
      if (account) {
        await Promise.all([
          refreshBalances(account, nextProvider),
          refreshTransactions(account, nextProvider),
        ]).catch((chainError) => setError(chainError.message));
      }
    };
    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);
    return () => {
      active = false;
      window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [account, disconnectWallet, isDemo, refreshBalances, refreshTransactions]);

  const value = useMemo(() => ({
    account,
    isDemo,
    provider,
    signer,
    chainId,
    connecting,
    error,
    transactions,
    transactionsLoading,
    transactionError,
    ethBalance,
    neuralBalance,
    chainLabel: chainId ? `Chain ID ${chainId}` : "Not Connected",
    isMetaMask: Boolean(account) && !isDemo,
    connectWallet,
    connectMetaMask: connectWallet,
    connectDemoWallet,
    disconnect: disconnectWallet,
    disconnectWallet,
    refreshBalances,
    refreshTransactions,
    formatAddress: (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—",
  }), [
    account, isDemo, provider, signer, chainId, connecting, error, transactions,
    transactionsLoading, transactionError,
    ethBalance, neuralBalance, connectWallet, connectDemoWallet, disconnectWallet,
    refreshBalances, refreshTransactions,
  ]);

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) throw new Error("useWeb3 must be used within a Web3Provider");
  return context;
}
