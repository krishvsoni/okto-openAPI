"use client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CopyButton from "../components/CopyButton";
import ViewExplorerURL from "../components/ViewExplorerURL";
import { transferToken } from "../../intents/tokenTransfer_with_estimate";
import { getChains } from "../../explorer/getChains";
import { getTokens } from "../../explorer/getTokens";
import { getPortfolio } from "../../explorer/getPortfolio";
import { getOrderHistory } from "../../utils/getOrderHistory";
import { verifySession } from "../../auth/verifySession_template";
import { estimateUserOp } from "../../utils/invokeEstimateUserOp";
import { signUserOp, executeUserOp } from "../../utils/invokeExecuteUserOp";

interface NetworkData {
  caip_id: string;
  network_name: string;
  chain_id: string;
  logo: string;
  sponsorship_enabled: boolean;
  gsn_enabled: boolean;
  type: string;
  network_id: string;
  onramp_enabled: boolean;
  whitelisted: boolean;
  explorerUrl?: string;
}

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  caipId: string;
  image: string;
}

interface PortfolioToken {
  symbol: string;
  balance: string;
  usdtBalance: string;
  inrBalance: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface TransferData {
  caipId: string;
  recipient: string;
  token: string;
  amount: string;
}

interface SessionConfig {
  sessionPrivKey: string;
  sessionPubkey: string;
  userSWA: string;
}

interface TransferResult {
  intentId: string;
  userOp: any;
}

interface ExecutionResult {
  transactionHash: string;
}

interface ViewURLProps {
  hash: string;
  url?: string;
}

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
  const navigate = useNavigate();
  const [chains, setChains] = useState<NetworkData[]>([]);
  const [tokens, setTokens] = useState<TokenOption[]>([]);
  const [portfolioBalance, setPortfolioBalance] = useState<PortfolioToken[]>([]);
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
  const [jobId, setJobId] = useState<string | null>(null);
  const [estimatedUserOp, setEstimatedUserOp] = useState<any>(null);
  const [signedUserOp, setSignedUserOp] = useState<any>(null);
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [orderHistory, setOrderHistory] = useState<any | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [userAddress, setUserAddress] = useState<string>("");

  const showModal = (modal: string) => setActiveModal(modal);
  const closeAllModals = () => setActiveModal(null);

  const resetForm = () => {
    setSelectedToken("");
    setAmount("");
    setRecipient("");
    setEstimatedUserOp(null);
    setSignedUserOp(null);
    setTransactionHash("");
    setTransactionStatus("");
    setJobId(null);
    setOrderHistory(null);
    setExplorerUrl(null);
    setError(null);
    closeAllModals();
  };

  const verifyUserSession = async () => {
    const session = localStorage.getItem("okto_session");
    if (!session) {
      navigate("/");
      return null;
    }

    const sessionData = await verifySession(session);
    if (sessionData.status !== "success") {
      navigate("/");
      return null;
    }

    return session;
  };

  const validateFormData = (): TransferData => {
    const token = tokens.find((t) => t.symbol === selectedToken);
    if (!token) throw new Error("Please select a valid token");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      throw new Error("Please enter a valid amount");
    if (!recipient || !recipient.startsWith("0x"))
      throw new Error("Please enter a valid recipient address");

    return {
      amount: amount,
      recipient: recipient,
      token: token.address || "",
      caipId: selectedChain,
    };
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const session = await verifyUserSession();
        if (!session) return;

        const sessionData = await verifySession(session);
        if (sessionData.status === "success") {
          setUserAddress(sessionData.data.user_swa);
        }
      } catch (error: any) {
        console.error("Error fetching user data:", error);
        setError(`Failed to fetch user data: ${error.message}`);
      }
    };
    fetchUserData();
  }, [navigate]);

  useEffect(() => {
    const fetchChains = async () => {
      try {
        const session = await verifyUserSession();
        if (!session) return;

        const response = await getChains(session);
        console.log("Networks response:", response);

        if (Array.isArray(response)) {
          setChains(response);
          if (response.length > 0) {
            setSelectedChain(response[0].caip_id);
            setSponsorshipEnabled(response[0].sponsorship_enabled);
          }
        } else {
          console.error("Invalid networks data format:", response);
          setError("Failed to fetch networks: Invalid data format");
        }
      } catch (error: any) {
        console.error("Error fetching networks:", error);
        setError(`Failed to fetch networks: ${error.message}`);
      }
    };
    fetchChains();
  }, [navigate]);

  useEffect(() => {
    const fetchTokens = async () => {
      if (!selectedChain) {
        setTokens([]);
        return;
      }

      setLoadingTokens(true);
      setError(null);

      try {
        const session = await verifyUserSession();
        if (!session) return;

        const response = await getTokens(session);
        console.log("API Response:", response);

        if (response?.status === "success" && Array.isArray(response.data.tokens)) {
          console.log("All tokens from API:", response.data.tokens);
          console.log("Selected chain:", selectedChain);
          
          const filteredTokens = response.data.tokens
            .filter((token) => {
              // Handle both full CAIP format (eip155:42161) and just chain ID (42161)
              const tokenChainId = token.caip_id;
              const isMatch = tokenChainId === selectedChain || 
                             tokenChainId.split(':')[1] === selectedChain ||
                             tokenChainId === `eip155:${selectedChain}`;
              console.log(`Token ${token.symbol} - tokenChainId: ${tokenChainId}, selectedChain: ${selectedChain}, match: ${isMatch}`);
              return isMatch;
            })
            .map((token) => ({
              address: token.address || "",
              symbol: token.symbol,
              name: token.short_name || token.name,
              decimals: Number(token.decimals),
              caipId: token.caip_id,
              image: token.image || "",
            }));

          console.log("Filtered Tokens:", filteredTokens);
          setTokens(filteredTokens);
        } else {
          console.error("API response structure:", response);
          throw new Error("Invalid token data structure");
        }
      } catch (error: any) {
        console.error("Error fetching tokens:", error);
        setError(`Failed to fetch tokens: ${error.message}`);
        setTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [selectedChain, navigate]);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const session = await verifyUserSession();
        if (!session) return;

        const portfolioData = await getPortfolio(session);
        if (portfolioData.status === "success") {
          setPortfolioBalance(portfolioData.data.group_tokens || []);
        }
      } catch (error: any) {
        console.error("Error fetching portfolio:", error);
        setError(`Failed to fetch portfolio: ${error.message}`);
      }
    };

    fetchPortfolio();
  }, [navigate]);

  const handleNetworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCaipId = e.target.value;
    setSelectedChain(selectedCaipId);
    setSelectedToken("");
    setTokenBalance(null);

    const selectedNetwork = chains.find(
      (network) => network.caip_id === selectedCaipId
    );
    setSponsorshipEnabled(selectedNetwork?.sponsorship_enabled || false);
  };

  const handleTokenSelect = async (symbol: string) => {
    setSelectedToken(symbol);
    if (portfolioBalance) {
      const tokenData = portfolioBalance.find((item) => item.symbol === symbol);
      if (tokenData) {
        setTokenBalance({
          balance: tokenData.balance || "0",
          usdtBalance: tokenData.usdtBalance || "0",
          inrBalance: tokenData.inrBalance || "0"
        });
      } else {
        setTokenBalance(null);
      }
    }
    await refreshPortfolio();
  };

  const refreshPortfolio = async () => {
    setIsRefreshing(true);
    try {
      const session = await verifyUserSession();
      if (!session) return;

      const portfolioData = await getPortfolio(session);
      setPortfolioBalance(portfolioData.data.group_tokens || []);
    } catch (error: any) {
      console.error("Error refreshing portfolio:", error);
      setError(`Failed to refresh portfolio: ${error.message}`);
    } finally {
      setIsRefreshing(false);
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
      const session = await verifyUserSession();
      if (!session) return;

      const orders = await getOrderHistory(session, intentId, "TOKEN_TRANSFER");
      setOrderHistory(orders?.[0]);
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
      const session = await verifyUserSession();
      if (!session) return;

      const orders = await getOrderHistory(session, jobId, "TOKEN_TRANSFER");
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
      const session = await verifyUserSession();
      if (!session) return;

      const transferData = validateFormData();

      const sessionData = await verifySession(session);
      const sessionConfig: SessionConfig = {
        sessionPrivKey: sessionData.data.session_priv_key,
        sessionPubkey: sessionData.data.session_pub_key,
        userSWA: sessionData.data.user_swa
      };

      const feePayerAddress = "0xdb9B5bbf015047D84417df078c8F06fDb6D71b76";

      const estimatedOp = await estimateUserOp({
        intent: "TOKEN_TRANSFER",
        chainId: selectedChain,
        tokenAddress: transferData.token,
        amount: transferData.amount,
        recipient: transferData.recipient
      }, session);
      setEstimatedUserOp(estimatedOp);

      const transferResult: TransferResult = await transferToken(
        transferData,
        sessionConfig,
        sponsorshipEnabled ? feePayerAddress : undefined
      );
      setJobId(transferResult.intentId);

      const signedOp = await signUserOp(transferResult.userOp, sessionConfig);
      setSignedUserOp(signedOp);

      const executionResult: ExecutionResult = await executeUserOp(signedOp, session);
      setTransactionHash(executionResult.transactionHash);

      const selectedChainObj = chains.find(chain => chain.caip_id === selectedChain);
      if (selectedChainObj && executionResult.transactionHash) {
        setExplorerUrl(`${selectedChainObj.explorerUrl}/tx/${executionResult.transactionHash}`);
      }

      setTransactionStatus("Processing");
      await handleGetOrderHistory(transferResult.intentId);

      if (portfolioBalance && selectedToken) {
        const updatedTokenBalance = portfolioBalance.find(item => item.symbol === selectedToken);
        setTokenBalance(updatedTokenBalance || null);
      }

      showModal("orderHistory");
    } catch (error: any) {
      console.error("Transfer failed:", error);
      setError(`Transfer failed: ${error.message}`);
      setTransactionStatus("Failed");
    } finally {
      setIsLoading(false);
    }
  };

  const renderTokenSelect = () => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        Select Token
      </label>
      <div className="relative">
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
            <option key={token.symbol} value={token.symbol}>
              {token.symbol} - {token.name}
            </option>
          ))}
        </select>
        {selectedToken && tokens.find(t => t.symbol === selectedToken)?.image && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <img
              src={tokens.find(t => t.symbol === selectedToken)?.image}
              alt={selectedToken}
              className="w-5 h-5 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>
      {selectedToken && (
        <div className="mt-2 text-sm text-gray-400 bg-gray-800 p-3 rounded border border-gray-700">
          <div className="flex items-center space-x-3">
            {tokens.find(t => t.symbol === selectedToken)?.image && (
              <img
                src={tokens.find(t => t.symbol === selectedToken)?.image}
                alt={selectedToken}
                className="w-8 h-8"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div>
              <p className="font-medium text-white">{tokens.find(t => t.symbol === selectedToken)?.name}</p>
              <p className="text-gray-400">
                {tokens.find(t => t.symbol === selectedToken)?.address
                  ? `${tokens.find(t => t.symbol === selectedToken)?.address.slice(0, 6)}...${tokens.find(t => t.symbol === selectedToken)?.address.slice(-4)}`
                  : 'Native Token'}
              </p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-700 p-2 rounded">
              <p className="text-gray-400">Decimals</p>
              <p className="text-white">{tokens.find(t => t.symbol === selectedToken)?.decimals}</p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <p className="text-gray-400">Network</p>
              <p className="text-white">{chains.find(chain => chain.caip_id === selectedChain)?.network_name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

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
            {chains.length === 0 ? "Loading networks..." : "Select a network"}
          </option>
          {chains.map((network) => (
            <option key={network.network_id} value={network.caip_id}>
              {network.network_name} ({network.chain_id})
            </option>
          ))}
        </select>
      </div>
      {selectedChain && (
        <p className="mt-2 text-sm text-gray-300 border border-indigo-700 p-2 my-2">
          {chains.find(network => network.caip_id === selectedChain)?.sponsorship_enabled
            ? "Gas sponsorship is available ✅"
            : "⚠️ Sponsorship is not activated for this chain, the user must hold native tokens to proceed with the transfer. You can get the token from the respective faucets"}
        </p>
      )}

      {renderTokenSelect()}

      <div>
        <label className="flex justify-between block text-sm font-medium text-gray-300 mb-1">
          <p>Amount (in smallest unit):</p>
          <p>
            Balance:{' '}
            {selectedToken && portfolioBalance
              ? (() => {
                  const tokenData = portfolioBalance.find(
                    (pb) => pb.symbol === selectedToken
                  );
                  return tokenData
                    ? `${Number(tokenData.balance || 0).toFixed(4)}`
                    : '0.0000';
                })()
              : '0.0000'}
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

      {transactionStatus && (
        <div className="bg-gray-800 rounded-xl shadow-lg border border-violet-200 p-6">
          <h2 className="text-violet-300 font-semibold text-xl mb-4">
            Transaction Status
          </h2>
          <div className="space-y-2">
            <p>Status: {transactionStatus}</p>
            {transactionHash && (
              <div className="flex items-center gap-2">
                <span>Transaction Hash:</span>
                <CopyButton text={transactionHash} />
                <ViewExplorerURL hash={transactionHash} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderModals = () => (
    <>
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
                  <ViewExplorerURL
                    hash={orderHistory.downstreamTransactionHash[0]}
                    url={explorerUrl || ""}
                  />
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

        {userAddress && (
          <div className="text-white text-center mb-4">
            <p className="text-sm text-gray-400">Your Address:</p>
            <p className="font-mono break-all">{userAddress}</p>
          </div>
        )}

        {renderForm()}
      </div>
      {renderModals()}
    </div>
  );
}

export default TwoStepTokenTransfer;