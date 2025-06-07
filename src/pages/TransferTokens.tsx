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
import CopyButton from "../components/CopyButton";
import ViewExplorerURL from "../components/ViewExplorerURL";
import { transferToken } from "../../intents/tokenTransfer_with_estimate";

type TokenOption = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  caipId: string;
};

export default function TransferTokens() {
  const oktoClient = useOkto();

  const [chains, setChains] = useState<any[]>([]);
  const [tokens, setTokens] = useState<TokenOption[]>([]);
  const [portfolio, setPortfolio] = useState<UserPortfolioData>();
  const [portfolioBalance, setPortfolioBalance] = useState<any[]>([]);

  const [selectedChain, setSelectedChain] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [sponsorshipEnabled, setSponsorshipEnabled] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getChains(oktoClient)
      .then(setChains)
      .catch((e) => setError(`Failed to fetch chains: ${e.message}`));
  }, [oktoClient]);

  useEffect(() => {
    if (!selectedChain) {
      setTokens([]);
      return;
    }
    getTokens(oktoClient)
      .then((res) => {
        const filtered = res.filter((t: any) => t.caipId === selectedChain);
        setTokens(
          filtered.map((token: any) => ({
            address: token.address,
            symbol: token.symbol,
            name: token.shortName || token.name,
            decimals: token.decimals,
            caipId: token.caipId,
          }))
        );
      })
      .catch((e) => setError(`Failed to fetch tokens: ${e.message}`));
  }, [selectedChain, oktoClient]);

  useEffect(() => {
    getPortfolio(oktoClient)
      .then((data) => {
        setPortfolio(data);

        if (!data?.groupTokens) return;

        const tokenMap = new Map<string, any>();
        data.groupTokens.forEach((group) => {
          if (group.aggregationType === "token") {
            tokenMap.set(group.symbol, {
              balance: group.balance,
              usdtBalance: group.holdingsPriceUsdt,
              inrBalance: group.holdingsPriceInr,
            });
          }
          if (group.tokens?.length) {
            group.tokens.forEach((token) => {
              tokenMap.set(token.symbol, {
                balance: token.balance,
                usdtBalance: token.holdingsPriceUsdt,
                inrBalance: token.holdingsPriceInr,
              });
            });
          }
        });

        setPortfolioBalance(
          Array.from(tokenMap.entries()).map(([symbol, balances]) => ({
            symbol,
            ...balances,
          }))
        );
      })
      .catch((e) => setError(`Failed to fetch portfolio: ${e.message}`));
  }, [oktoClient]);

  useEffect(() => {
    const chain = chains.find((c) => c.caipId === selectedChain);
    setSponsorshipEnabled(chain?.sponsorshipEnabled || false);
  }, [selectedChain, chains]);

  const validateFormData = () => {
    const token = tokens.find((t) => t.symbol === selectedToken);
    if (!token) throw new Error("Please select a valid token");
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount)))
      throw new Error("Please enter a valid amount");
    if (!recipient || !recipient.startsWith("0x"))
      throw new Error("Please enter a valid recipient address");

    return {
      amount: BigInt(amount),
      recipient: recipient as Address,
      token: token.address as Address,
      caipId: selectedChain,
    };
  };

  const handleTransfer = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = validateFormData();

      const sessionConfig = {
        sessionPrivKey:
          "0x85ffef45e363f107476800f052102a940fcfa1167023ee462a859d3cada0cc76",
        sessionPubkey:
          "0x04869dbfba722c6d3bdcb56ac2475f37c85b21907b3c1f748271a80bca12d60ea45612dfdf7dfbdea0035ee8633d8c6717cea87ee451830bf0ecb35c6b37825e4c",
        userSWA: "0x281FaF4F242234c7AeD53530014766E845AC1E90",
      };

      const newJobId = await transferToken(params, sessionConfig);
      setJobId(newJobId);

      const orders = await getOrdersHistory(oktoClient, {
        intentId: newJobId,
        intentType: "TOKEN_TRANSFER",
      });
      setOrderHistory(orders?.[0]);
    } catch (e: any) {
      setError(e.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  const refreshOrderHistory = async () => {
    if (!jobId) {
      setError("No job ID available");
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const orders = await getOrdersHistory(oktoClient, {
        intentId: jobId,
        intentType: "TOKEN_TRANSFER",
      });
      setOrderHistory(orders?.[0]);
    } catch (e: any) {
      setError(e.message || "Failed to refresh order history");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <main className="w-full max-w-2xl p-4 mx-auto  bg-gray-800 text-white rounded-lg shadow-lg">
      <h1 className="mb-6 text-3xl font-bold">Two-Step Token Transfer</h1>

      {error && (
        <div className="mb-4 p-3 text-red-400 bg-red-900 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <label className="block mb-2">
        Select Network
        <select
          className="block w-full p-2 mt-1 bg-gray-900 rounded"
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value)}
          disabled={loading}
        >
          <option value="">-- Select Network --</option>
          {chains.map((chain) => (
            <option key={chain.chainId} value={chain.caipId}>
              {chain.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block mb-2">
        Select Token
        <select
          className="block w-full p-2 mt-1 bg-gray-900 rounded"
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
          disabled={!selectedChain || loading}
        >
          <option value="">-- Select Token --</option>
          {tokens.map((token) => (
            <option key={token.address} value={token.symbol}>
              {token.symbol} ({token.name})
            </option>
          ))}
        </select>
      </label>

      <label className="block mb-2">
        Amount
        <input
          className="block w-full p-2 mt-1 bg-gray-900 rounded"
          type="number"
          min="0"
          step="any"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
        />
      </label>

      <label className="block mb-4">
        Recipient Address
        <input
          className="block w-full p-2 mt-1 bg-gray-900 rounded"
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          disabled={loading}
        />
      </label>

      <label className="inline-flex items-center mb-6">
        <input
          type="checkbox"
          checked={sponsorshipEnabled}
          readOnly
          className="mr-2"
        />
        Enable Sponsorship (read-only)
      </label>

      <button
        onClick={handleTransfer}
        disabled={
          loading ||
          !selectedChain ||
          !selectedToken ||
          !amount ||
          !recipient
        }
        className={`w-full py-3 font-semibold rounded ${
          loading ? "bg-gray-700 cursor-not-allowed" : "bg-blue-700 hover:bg-blue-800"
        }`}
      >
        {loading ? "Processing..." : "Transfer Token"}
      </button>

      {jobId && (
        <section className="mt-8 p-4 bg-gray-900 rounded">
          <h2 className="mb-2 text-xl font-semibold">Transaction Info</h2>
          <p>
            Job ID:{" "}
            <code className="break-all">{jobId}</code>
          </p>

          <CopyButton textToCopy={jobId} />

          <ViewExplorerURL
            intentId={jobId}
            intentType="TOKEN_TRANSFER"
            onClose={() => {
              setJobId(null);
              setOrderHistory(null);
            }}
          />

          <button
            onClick={refreshOrderHistory}
            disabled={refreshing}
            className="mt-4 px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            {refreshing ? "Refreshing..." : "Refresh Order History"}
          </button>

          {orderHistory && (
            <div className="mt-4 text-sm whitespace-pre-wrap">
              <pre>{JSON.stringify(orderHistory, null, 2)}</pre>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
