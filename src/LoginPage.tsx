import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dotenv from "dotenv";
import { loginUsingOAuth } from "../utils/generateOktoAuthToken";
import { generateClientSignature } from "../utils/generateClientSignature";

dotenv.config();

export async function verifySession(OktoAuthToken: string) {
  try {
    const response = await axios.get(
      "https://sandbox-api.okto.tech/api/oc/v1/verify-session",
      {
        headers: {
          Authorization: `Bearer ${OktoAuthToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching session information:", error);
    throw new Error("Failed to fetch session information");
  }
}

interface RequestBody {
  data: any;
  client_signature: string;
  type: string;
}

interface ApiResponse {
  status: string;
  data: {
    token?: string;
    auth_token?: string;
    [key: string]: any;
  };
}

interface SessionKey {
  priv: Uint8Array;
  privateKey: Uint8Array;
  privateKeyHex: string;
  privateKeyHexWith0x: string;
  compressedPublicKey: string;
  uncompressedPublicKey: string;
  uncompressedPublicKeyHex: string;
  uncompressedPublicKeyHexWith0x: string;
  ethereumAddress: string;
}

interface OktoSession {
  sessionKey?: SessionKey;
  ethereumAddress?: string;
  authToken?: string;
  [key: string]: any;
}

async function postSignedRequest(endpoint: string, fullPayload: any): Promise<ApiResponse> {
  const payloadWithTimestamp = {
    ...fullPayload,
    timestamp: Date.now() - 1000,
  };
  const signature = await generateClientSignature(payloadWithTimestamp);
  const requestBody: RequestBody = {
    data: payloadWithTimestamp,
    client_signature: signature,
    type: "ethsign",
  };
  const response = await axios.post<ApiResponse>(endpoint, requestBody, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"google" | "email">("google");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"send_OTP" | "verify_OTP" | "resend_OTP">("send_OTP");
  const [ethereumAddress, setEthereumAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugRequest, setDebugRequest] = useState<RequestBody | null>(null);
  const [debugResponse, setDebugResponse] = useState<ApiResponse | null>(null);
  const clientSwa = "0x7337975B2D8CE19c2a201C42106aAc0e7E40d109";

  useEffect(() => {
    let isMounted = true;

    const checkStoredSession = async () => {
      const storedSession = localStorage.getItem("okto_session");
      if (storedSession && isMounted) {
        try {
          const res = await verifySession(storedSession);
          if (res?.status === "success") navigate("/home");
          else localStorage.removeItem("okto_session");
        } catch {
          localStorage.removeItem("okto_session");
        }
      }

      const storedToken = localStorage.getItem("googleIdToken");
      if (storedToken && isMounted) handleAuthenticate(storedToken);
    };

    checkStoredSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const extractEthereumAddress = (session: OktoSession | string): string => {
    if (typeof session === "string" || !session) return "";
    try {
      if (session.sessionKey?.ethereumAddress) return session.sessionKey.ethereumAddress;
      if (session.ethereumAddress) return session.ethereumAddress;
    } catch (error) {
      console.error("Error extracting ethereum address:", error);
    }
    return "";
  };

  const handleAuthenticate = async (idToken: string) => {
    setIsLoading(true);
    setError("");
    try {
      const session = await loginUsingOAuth(idToken, "google");
      if (!session) throw new Error("Authentication failed: No session returned");
      const address = extractEthereumAddress(session);
      if (address) {
        setEthereumAddress(address);
        localStorage.setItem("ethereumAddress", address);
      }
      if (typeof session === "string") {
        localStorage.setItem("okto_session", session);
      } else {
        localStorage.setItem("okto_session", JSON.stringify(session));
      }
      navigate("/home");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed");
      localStorage.removeItem("googleIdToken");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async ({ credential }: { credential?: string }) => {
    if (!credential) return;
    localStorage.setItem("googleIdToken", credential);
    await handleAuthenticate(credential);
  };

  const sendOtp = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (!email) throw new Error("Please enter a valid email address");
      const payload = { email, client_swa: clientSwa };
      setDebugRequest({ data: payload, client_signature: "signature_placeholder", type: "ethsign" });
      const res = await postSignedRequest("https://sandbox-api.okto.tech/api/oc/v1/authenticate/email", payload);
      setDebugResponse(res);
      if (res.status !== "success" || !res.data.token) throw new Error("Failed to send OTP");
      setToken(res.data.token);
      setStatus("verify_OTP");
      localStorage.setItem("okto_token", res.data.token);
      localStorage.setItem("okto_status", "verify_OTP");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (!otp) throw new Error("Please enter the OTP");
      const payload = { email, token, otp, client_swa: clientSwa };
      const res = await postSignedRequest("https://sandbox-api.okto.tech/api/oc/v1/authenticate/email/verify", payload);
      if (res.status !== "success" || !res.data.auth_token) throw new Error("OTP verification failed");
      localStorage.setItem("okto_session", res.data.auth_token);
      localStorage.setItem("okto_auth_token", res.data.auth_token);
      localStorage.setItem("okto_email", email);
      localStorage.setItem("okto_refresh_token", res.data.refresh_auth_token ?? "");
      localStorage.removeItem("okto_token");
      localStorage.removeItem("okto_status");
      navigate("/home");
    } catch (error) {
      setError(error instanceof Error ? error.message : "OTP verification failed");
      console.error("OTP verification error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAction = async () => {
    if (status === "send_OTP" || status === "resend_OTP") await sendOtp();
    else if (status === "verify_OTP") await verifyOtp();
  };

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab("google")}
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === "google"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Google
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === "email"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-300"
            }`}
            disabled={isLoading}
          >
            Email
          </button>
        </div>
        <div className="bg-black border border-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white text-center mb-8">
            Welcome to Okto
          </h1>
          {error && (
            <div className="mb-4 p-3 bg-red-900 text-red-100 rounded-lg text-sm">
              {error}
            </div>
          )}
          {ethereumAddress && (
            <div className="mb-4 p-3 bg-green-900 text-green-100 rounded-lg text-sm">
              Address: {ethereumAddress}
            </div>
          )}
          <div className="space-y-6">
            {activeTab === "google" && (
              <div className="flex flex-col items-center space-y-4">
                <p className="text-gray-400 text-center">
                  Sign in with your Google account
                </p>
                {!isLoading ? (
                  <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={() => setError("Google login failed")}
                    theme="filled_black"
                    size="large"
                    shape="rectangular"
                  />
                ) : (
                  <div className="text-gray-500 text-sm">Loading Google Login...</div>
                )}
              </div>
            )}
            {activeTab === "email" && (
              <div className="flex flex-col space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your Email"
                  className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={status === "verify_OTP" || isLoading}
                />
                {status === "verify_OTP" && (
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                    className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={isLoading}
                  />
                )}
                <button
                  onClick={handleEmailAction}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {status === "verify_OTP" ? "Verifying..." : "Sending..."}
                    </span>
                  ) : status === "verify_OTP" ? (
                    "Verify OTP"
                  ) : (
                    "Send OTP"
                  )}
                </button>
                {status === "verify_OTP" && (
                  <button
                    type="button"
                    onClick={() => setStatus("resend_OTP")}
                    className="text-sm text-blue-400 hover:underline text-center w-full disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                )}
                <p className="text-gray-400 text-sm text-center">
                  {status === "verify_OTP"
                    ? "Enter the OTP sent to your email"
                    : "We'll send you a login code"}
                </p>
              </div>
            )}
          </div>
          {debugRequest && (
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <h2 className="text-lg font-semibold text-white">Request Body:</h2>
              <pre className="text-sm text-gray-300 mt-2 overflow-auto">
                {JSON.stringify(debugRequest, null, 2)}
              </pre>
            </div>
          )}
          {debugResponse && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg">
              <h2 className="text-lg font-semibold text-white">Response:</h2>
              <pre className="text-sm text-gray-300 mt-2 overflow-auto">
                {JSON.stringify(debugResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
