/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useState, useEffect } from "react";
import {
  Address,
  getOrdersHistory,
  getPortfolio,
  getTokens,
  useOkto,
  UserPortfolioData,
} from "@okto_web3/react-sdk";
import { getChains } from "@okto_web3/react-sdk";
import { useNavigate } from "react-router-dom";
import CopyButton from "../components/CopyButton";
import ViewExplorerURL from "../components/ViewExplorerURL";
import { transferToken } from "../../intents/tokenTransfer_with_estimate";

// Types
interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  caipId: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Updated Data interface to match the transferToken function requirements
interface TransferData {
  caipId: string;
  recipient: string;
  token: string;
  amount: string; // Keep as string as expected by transferToken
}

interface SessionConfig {
  sessionPrivKey: string;
  sessionPubkey: string;
  userSWA: string;
}

// Components
const Modal = ({ isOpen, onClose, title, children }: ModalProps) =>
  !isOpen ? null : (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );

const RefreshIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
  </svg>
);

function TwoStepTokenTransfer() {
  const oktoClient = useOkto();
  const navigate = useNavigate();

  // Form state
  const [chains, setChains] = useState<any[]>([]);
  const [tokens, setTokens] = useState<TokenOption[]>([]);
  const [portfolio, setPortfolio] = useState<UserPortfolioData>();
  const [portfolioBalance, setPortfolioBalance] = useState<any[]>([]);
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [sponsorshipEnabled, setSponsorshipEnabled] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<{
    balance: string;
    usdtBalance: string;
    inrBalance: string;
  } | null>(null);

  // Transaction state
  const [jobId, setJobId] = useState<string | null>(null);
  const [userOp, setUserOp] = useState<any | null>(null);
  const [signedUserOp, setSignedUserOp] = useState<any | null>(null);
  const [orderHistory, setOrderHistory] = useState<any | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);

  // Modal states
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Helper functions
  const showModal = (modal: string) => setActiveModal(modal);
  const closeAllModals = () => setActiveModal(null);

  const resetForm = () => {
    setSelectedToken("");
    setAmount("");
    setRecipient("");
    setUserOp(null);
    setSignedUserOp(null);
    setJobId(null);
    setOrderHistory(null);
    setExplorerUrl(null);
    setError(null);
    closeAllModals();
  };

  const validateFormData = (): TransferData => {
    const token = tokens.find((t) => t.symbol === selectedToken);
    if (!token) throw new Error("Please select a valid token");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      throw new Error("Please enter a valid amount");
    if (!recipient || !recipient.startsWith("0x"))
      throw new Error("Please enter a valid recipient address");

    return {
      amount: amount, // Keep as string
      recipient: recipient,
      token: token.address || "", // Use empty string for native tokens
      caipId: selectedChain,
    };
  };

  // Data fetching
  useEffect(() => {
    const fetchChains = async () => {
      try {
        setChains(await getChains(oktoClient));
      } catch (error: any) {
        console.error("Error fetching chains:", error);
        setError(`Failed to fetch chains: ${error.message}`);
      }
    };
    fetchChains();
  }, [oktoClient]);

  useEffect(() => {
    const fetchTokens = async () => {
      if (!selectedChain) {
        setTokens([]);
        return;
      }

      setLoadingTokens(true);
      setError(null);

      try {
        const response = await getTokens(oktoClient);
        const filteredTokens = response
          .filter((token: any) => token.caipId === selectedChain)
          .map((token: any) => ({
            address: token.address,
            symbol: token.symbol,
            name: token.shortName || token.name,
            decimals: token.decimals,
            caipId: token.caipId,
          }));

        setTokens(filteredTokens);
      } catch (error: any) {
        console.error("Error fetching tokens:", error);
        setError(`Failed to fetch tokens: ${error.message}`);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [selectedChain, oktoClient]);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const data = await getPortfolio(oktoClient);
        setPortfolio(data);

        if (data?.groupTokens) {
          const tokenBalanceMap = new Map();

          data.groupTokens.forEach((group) => {
            if (group.aggregationType === "token") {
              tokenBalanceMap.set(group.symbol, {
                balance: group.balance,
                usdtBalance: group.holdingsPriceUsdt,
                inrBalance: group.holdingsPriceInr,
              });
            }

            if (group.tokens && group.tokens.length > 0) {
              group.tokens.forEach((token) => {
                tokenBalanceMap.set(token.symbol, {
                  balance: token.balance,
                  usdtBalance: token.holdingsPriceUsdt,
                  inrBalance: token.holdingsPriceInr,
                });
              });
            }
          });

          if (selectedToken && tokenBalanceMap.has(selectedToken)) {
            setTokenBalance(tokenBalanceMap.get(selectedToken));
          } else {
            setTokenBalance(null);
          }

          setPortfolioBalance(
            Array.from(tokenBalanceMap.entries()).map(([symbol, data]) => ({
              symbol,
              ...data,
            }))
          );
        }
      } catch (error: any) {
        console.error("Error fetching portfolio:", error);
        setError(`Failed to fetch portfolio: ${error.message}`);
      }
    };

    fetchPortfolio();
  }, [oktoClient, selectedToken]);

  const handleNetworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCaipId = e.target.value;
    setSelectedChain(selectedCaipId);
    setSelectedToken("");
    setTokenBalance(null);

    const selectedChainObj = chains.find(
      (chain) => chain.caipId === selectedCaipId
    );
    setSponsorshipEnabled(selectedChainObj?.sponsorshipEnabled || false);
  };

  const handleTokenSelect = (symbol: string) => {
    setSelectedToken(symbol);
    if (portfolioBalance) {
      const tokenData = portfolioBalance.find((item) => item.symbol === symbol);
      setTokenBalance(tokenData || null);
    }
  };

  const handleGetOrderHistory = async (id?: string) => {
    const intentId = id || jobId;
    if (!intentId) {
      setError("No job ID available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const orders = await getOrdersHistory(oktoClient, {
        intentId,
        intentType: "TOKEN_TRANSFER",
      });
      setOrderHistory(orders?.[0]);
      console.log("Refreshed Order History:", orders);
      setActiveModal("orderHistory");
    } catch (error: any) {
      console.error("Error in fetching order history", error);
      setError(`Error fetching transaction details: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrderHistory = async () => {
    if (!jobId) {
      setError("No job ID available to refresh");
      return;
    }

    setIsRefreshing(true);
    try {
      const orders = await getOrdersHistory(oktoClient, {
        intentId: jobId,
        intentType: "TOKEN_TRANSFER",
      });
      setOrderHistory(orders?.[0]);
    } catch (error: any) {
      console.error("Error refreshing order history", error);
      setError(`Error refreshing transaction details: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTransferToken = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const transferParams = validateFormData();
      const sessionConfig: SessionConfig = {
        sessionPrivKey: "0x85ffef45e363f107476800f052102a940fcfa1167023ee462a859d3cada0cc76",
        sessionPubkey: "0x04869dbfba722c6d3bdcb56ac2475f37c85b21907b3c1f748271a80bca12d60ea45612dfdf7dfbdea0035ee8633d8c6717cea87ee451830bf0ecb35c6b37825e4c",
        userSWA: "0x281FaF4F242234c7AeD53530014766E845AC1E90",
      };

      const feePayerAddress: Address = "0xdb9B5bbf015047D84417df078c8F06fDb6D71b76";

      let result: string;
      if (sponsorshipEnabled) {
        await transferToken(transferParams, sessionConfig, feePayerAddress);
     
        result = "";
      } else {
        result = await transferToken(transferParams, sessionConfig);
      }

      setJobId(result);
      showModal("jobId");
      console.log("Transfer jobId:", result);
      
      // Automatically fetch order history after successful transfer
      setTimeout(() => {
        handleGetOrderHistory(result);
      }, 2000); // Wait 2 seconds before checking status
      
    } catch (error: any) {
      console.error("Error in token transfer:", error);
      setError(`Error in token transfer: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Select Network
        </label>
        <select
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
          value={selectedChain}
          onChange={handleNetworkChange}
          disabled={isLoading}
        >
          <option value="" disabled>
            Select a network
          </option>
          {chains.map((chain) => (
            <option key={chain.chainId} value={chain.caipId}>
              {chain.networkName} ({chain.caipId})
            </option>
          ))}
        </select>
      </div>
      {selectedChain && (
        <p className="mt-2 text-sm text-gray-300 border border-indigo-700 p-2 my-2">
          {sponsorshipEnabled
            ? "Gas sponsorship is available ✅"
            : "⚠️ Sponsorship is not activated for this chain, the user must hold native tokens to proceed with the transfer. You can get the token from the respective faucets"}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Select Token
        </label>
        <select
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
          value={selectedToken}
          onChange={(e) => handleTokenSelect(e.target.value)}
          disabled={isLoading || loadingTokens || !selectedChain}
        >
          <option value="" disabled>
            {loadingTokens
              ? "Loading tokens..."
              : !selectedChain
              ? "Select a network first"
              : tokens.length === 0
              ? "No tokens available"
              : "Select a token"}
          </option>
          {tokens.map((token) => (
            <option
              key={`${token.caipId}-${token.address}`}
              value={token.symbol}
            >
              {token.symbol} - {token.address || "native"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex justify-between block text-sm font-medium text-gray-300 mb-1">
          <p>Amount (in smallest unit):</p>
          <p>
            {selectedChain && (
              <>
                Balance:{" "}
                {selectedToken &&
                portfolioBalance?.find((pb) => pb.symbol === selectedToken)
                  ?.balance !== undefined
                  ? Number(
                      portfolioBalance.find((pb) => pb.symbol === selectedToken)
                        ?.balance
                    ).toFixed(4)
                  : "N/A"}{" "}
                &nbsp; INR:{" "}
                {(selectedToken &&
                  portfolioBalance?.find((pb) => pb.symbol === selectedToken)
                    ?.inrBalance) ||
                  "N/A"}{" "}
                &nbsp; USDT:{" "}
                {(selectedToken &&
                  portfolioBalance?.find((pb) => pb.symbol === selectedToken)
                    ?.usdtBalance) ||
                  "N/A"}
              </>
            )}
          </p>
        </label>
        <input
          type="text"
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount in smallest unit (e.g., wei)"
          disabled={isLoading}
        />
        <small className="text-gray-400">
          {selectedToken &&
            tokens.find((t) => t.symbol === selectedToken)?.decimals &&
            `This token has ${tokens.find((t) => t.symbol === selectedToken)?.decimals} decimals`}
        </small>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Recipient Address
        </label>
        <input
          type="text"
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          disabled={isLoading}
        />
      </div>

      <div className="flex gap-4 pt-2">
        <button
          className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:bg-blue-800 disabled:opacity-50"
          onClick={handleTransferToken}
          disabled={
            isLoading ||
            !selectedChain ||
            !selectedToken ||
            !amount ||
            !recipient
          }
        >
          {isLoading ? "Processing..." : "Transfer Token"}
        </button>
      </div>
    </div>
  );

  const renderModals = () => (
    <>
      <Modal
        isOpen={activeModal === "jobId"}
        onClose={() => showModal("orderHistory")}
        title="Transaction Submitted"
      >
        <div className="space-y-4 text-white">
          <p>Your transaction has been submitted successfully.</p>
          <div className="bg-gray-700 p-3 rounded">
            <p className="text-sm text-gray-300 mb-1">Job ID:</p>
            <CopyButton text={jobId ?? ""} />
            <p className="font-mono break-all">{jobId}</p>
          </div>
          <div className="flex justify-center pt-2">
            <button
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors w-full"
              onClick={() => handleGetOrderHistory()}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Check Job Status"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === "orderHistory"}
        onClose={closeAllModals}
        title="Transaction Details"
      >
        <div className="space-y-4 text-white">
          <div className="flex justify-between items-center">
            <p>Transaction Details:</p>
          </div>

          {orderHistory ? (
            <div className="bg-gray-700 p-4 rounded-md">
              <p>
                <span className="font-semibold">Intent ID:</span>{" "}
                {orderHistory.intentId}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                {orderHistory.status}
              </p>
              <p>
                <span className="font-semibold">Transaction Hash:</span>
              </p>
              <pre className="break-all whitespace-pre-wrap overflow-auto bg-gray-800 p-2 rounded-md text-sm max-w-full">
                <CopyButton
                  text={orderHistory.downstreamTransactionHash[0] ?? ""}
                />
                {orderHistory.downstreamTransactionHash[0]}
              </pre>
            </div>
          ) : (
            <p className="text-gray-400">No order history available.</p>
          )}

          {orderHistory && (
            <>
              {orderHistory.status === "SUCCESSFUL" ? (
                <div className="flex justify-center w-full pt-2">
                  <ViewExplorerURL orderHistory={orderHistory} />
                </div>
              ) : (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={refreshOrderHistory}
                    className="flex gap-x-3 justify-center items-center p-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors w-full text-center"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <span>Refreshing...</span>
                    ) : (
                      <>
                        <RefreshIcon /> Refresh
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          <div className="flex justify-center pt-2">
            <button
              className="p-3 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors w-full"
              onClick={resetForm}
            >
              Create New Transaction
            </button>
          </div>
        </div>
      </Modal>
    </>
  );

  return (
    <div className="w-full bg-gray-900 min-h-screen">
      <div className="flex flex-col w-full max-w-2xl mx-auto p-6 space-y-6 bg-gray-900 rounded-lg shadow-xl justify-center items-center">
        <button
          onClick={() => navigate("/home")}
          className="w-fit py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black mb-8"
        >
          Home
        </button>
        <h1 className="text-2xl font-bold text-white text-center">
          Token Transfer
        </h1>
        <p className="text-white font-regular text-lg mb-6">
          For a detailed overview of Token Transfer intent, refer to our
          documentation on{" "}
          <a
            className="underline text-indigo-300"
            href="https://docs.okto.tech/docs/react-sdk/tokenTransfer"
            target="_blank"
            rel="noopener noreferrer"
          >
            Token Transfer
          </a>
          .
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-100 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {renderForm()}
      </div>
      {renderModals()}
    </div>
  );
}

export default TwoStepTokenTransfer;