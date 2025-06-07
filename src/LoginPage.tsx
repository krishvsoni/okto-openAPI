import { useOkto } from "@okto_web3/react-sdk";
import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dotenv from "dotenv";
import { loginUsingOAuth } from "../utils/generateOktoAuthToken";
import { generateClientSignature } from "../utils/generateClientSignature";

dotenv.config();

type TabType = "google" | "email";

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

interface ApiResponse {
  status: string;
  data: {
    token?: string;
    auth_token?: string;
    userSWA?: string;
    [key: string]: any;
  };
}

async function postSignedRequest(endpoint: string, fullPayload: any): Promise<ApiResponse> {
  const payloadWithTimestamp = {
    ...fullPayload,
    timestamp: Date.now() - 1000,
  };

  const signature = await generateClientSignature(payloadWithTimestamp);

  const requestBody = {
    data: payloadWithTimestamp,
    client_signature: signature,
    type: "ethsign",
  };

  console.log("Request Body:", requestBody);
  const response = await axios.post<ApiResponse>(endpoint, requestBody, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

export default function LoginPage() {
  const oktoClient = useOkto();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("google");

  const [email, setEmail] = useState(localStorage.getItem("okto_email") || "");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState(localStorage.getItem("okto_token") || "");
  const [status, setStatus] = useState(
    localStorage.getItem("okto_status") || "send_OTP"
  );
  const [ethereumAddress, setEthereumAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const clientSwa = "0x7337975B2D8CE19c2a201C42106aAc0e7E40d109";

  useEffect(() => {
    if (oktoClient.isLoggedIn()) {
      navigate("/home");
      return;
    }

    const storedToken = localStorage.getItem("googleIdToken");
    if (storedToken) handleAuthenticate(storedToken);
  }, [oktoClient, navigate]);

  const extractEthereumAddress = (session: OktoSession | string): string => {
    if (typeof session === "string") return "";
    
    // Check if session is null or undefined
    if (!session) {
      console.warn("Session is null or undefined");
      return "";
    }

    try {
      // Debug logging
      console.log("Session object:", session);
      console.log("SessionKey:", session.sessionKey);
      
      // The SessionKey has getter methods, try accessing directly
      if (session.sessionKey) {
        // Try accessing as property (getter will be called automatically)
        const address = session.sessionKey.ethereumAddress;
        console.log("Extracted address:", address);
        if (address) return address;
      }
      
      // Try accessing it directly from session
      if (session.ethereumAddress) {
        return session.ethereumAddress;
      }

      // If the above doesn't work, try accessing the private key and deriving address
      if (session.sessionKey?.privateKeyHexWith0x) {
        console.log("Private key available:", session.sessionKey.privateKeyHexWith0x);
        // You could derive the ethereum address from the private key if needed
      }

      console.log("Available session properties:", Object.keys(session));
      console.log("SessionKey type:", typeof session.sessionKey);
      console.log("SessionKey constructor:", session.sessionKey?.constructor?.name);
      
    } catch (error) {
      console.error("Error extracting ethereum address:", error);
    }

    return "";
  };

  const handleAuthenticate = async (idToken: string) => {
    setIsLoading(true);
    setError("");
    try {
      console.log("Starting authentication with token:", idToken);
      
      const session = await loginUsingOAuth(idToken, "google");
      console.log("Session data:", session);

      if (!session) {
        throw new Error("Authentication failed: No session data returned");
      }

      // Handle case where session is an auth token string
      if (typeof session === "string") {
        await oktoClient.loginUsingOAuth(
          { idToken: session, provider: "google" },
          (sessionData: OktoSession) => {
            const address = extractEthereumAddress(sessionData);
            if (!address) {
              console.warn("Ethereum address not found in session data, continuing anyway");
              // Don't throw error, just continue with empty address
            }
            console.log("Session stored:", sessionData);
            setEthereumAddress(address);
            localStorage.setItem("ethereumAddress", address);
            localStorage.setItem("okto_session", JSON.stringify(sessionData));
            navigate("/home");
          }
        );
        return;
      }

      // Handle case where session is an object
      const address = extractEthereumAddress(session);
      if (!address) {
        console.warn("Session address is undefined, but continuing with authentication");
        // Don't throw error, just log warning
      }

      console.log("Session address:", address);
      setEthereumAddress(address);
      localStorage.setItem("ethereumAddress", address);

      await oktoClient.loginUsingOAuth(
        { idToken, provider: "google" },
        (sessionData: OktoSession) => {
          console.log("Session stored:", sessionData);
          // Try to extract address from the callback session data too
          const callbackAddress = extractEthereumAddress(sessionData);
          if (callbackAddress) {
            setEthereumAddress(callbackAddress);
            localStorage.setItem("ethereumAddress", callbackAddress);
          }
          localStorage.setItem("okto_session", JSON.stringify(sessionData));
          navigate("/home");
        }
      );
    } catch (error) {
      console.error("Authentication failed:", error);
      setError(error instanceof Error ? error.message : "Authentication failed");
      localStorage.removeItem("googleIdToken");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse: { credential?: string }) => {
    const idToken = credentialResponse.credential || "";
    if (idToken) {
      localStorage.setItem("googleIdToken", idToken);
      await handleAuthenticate(idToken);
    }
  };

  const sendOtp = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (!email) {
        throw new Error("Please enter a valid email address");
      }

      const payload = {
        email: email,
        client_swa: clientSwa,
      };

      console.log("Calling sendOtp with payload:", payload);
      const res = await postSignedRequest(
        "https://sandbox-api.okto.tech/api/oc/v1/authenticate/email",
        payload
      );
      
      if (res.status !== "success" || !res.data.token) {
        throw new Error("Failed to send OTP");
      }

      console.log("OTP Sent:", res);
      setToken(res.data.token);
      setStatus("verify_OTP");
      localStorage.setItem("okto_token", res.data.token);
      localStorage.setItem("okto_email", email);
    } catch (error) {
      console.error("Error sending OTP:", error);
      setError(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (!otp) {
        throw new Error("Please enter the OTP");
      }

      const payload = {
        email: email,
        token: token,
        otp: otp,
        client_swa: clientSwa,
      };

      const res = await postSignedRequest(
        "https://sandbox-api.okto.tech/api/oc/v1/authenticate/email/verify",
        payload
      );

      console.log("OTP Verified:", res);

      if (res.status !== "success" || !res.data.auth_token) {
        throw new Error("OTP verification failed");
      }

      const authToken = res.data.auth_token;
      console.log("Auth token received:", authToken);
      
      try {
        const session = await loginUsingOAuth(authToken, "okto");
        console.log("Full session object:", session);

        // Check if session is undefined or null
        if (!session) {
          console.error("Session is undefined - API authentication may have failed");
          throw new Error("Authentication failed: Unable to create session. Please check your API configuration.");
        }

        let ethAddress = "";

        if (typeof session === "string") {
          // If session is just a token string
          await oktoClient.loginUsingOAuth(
            { idToken: session, provider: "okto" },
            (sessionData: OktoSession) => {
              ethAddress = extractEthereumAddress(sessionData);
              if (!ethAddress) {
                console.warn("Ethereum address not found in session data, continuing anyway");
              }
              setEthereumAddress(ethAddress);
              localStorage.setItem("ethereumAddress", ethAddress);
              localStorage.setItem("okto_session", JSON.stringify(sessionData));
              navigate("/home");
            }
          );
        } else {
          // If session is an object
          ethAddress = extractEthereumAddress(session);
          if (!ethAddress) {
            console.warn("Failed to retrieve Ethereum address from session, but continuing");
          }

          setEthereumAddress(ethAddress);
          localStorage.setItem("ethereumAddress", ethAddress);

          await oktoClient.loginUsingOAuth(
            { idToken: authToken, provider: "okto" },
            (sessionData: OktoSession) => {
              console.log("Session stored:", sessionData);
              // Try to extract address from callback session data too
              const callbackAddress = extractEthereumAddress(sessionData);
              if (callbackAddress) {
                setEthereumAddress(callbackAddress);
                localStorage.setItem("ethereumAddress", callbackAddress);
              }
              localStorage.setItem("okto_session", JSON.stringify(sessionData));
              navigate("/home");
            }
          );
        }
      } catch (sessionError) {
        console.error("Session creation error:", sessionError);
        // throw new Error(`Authentication failed: ${sessionError instanceof Error ? sessionError.message : 'Unknown session error'}`);
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setError(error instanceof Error ? error.message : "OTP verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAction = async () => {
    try {
      if (status === "send_OTP" || status === "resend_OTP") {
        await sendOtp();
      } else if (status === "verify_OTP") {
        await verifyOtp();
      }
    } catch (err) {
      console.error("Email login error:", err);
    }
  };

  return (
    <main className="min-h-[90vh] bg-gray-900 flex flex-col items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-md mb-6">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab("google")}
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === "google"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-300"
            }`}
            // disabled={isLoading}
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
      </div>

      <div className="bg-black border border-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Welcome to Okto
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-900 text-red-100 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Debug info - remove in production */}
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
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setError("Google login failed")}
                theme="filled_black"
                size="large"
                shape="rectangular"
                disabled={isLoading}
              />
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
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {status === "verify_OTP" ? "Verifying..." : "Sending..."}
                  </span>
                ) : status === "verify_OTP" ? "Verify OTP" : "Send OTP"}
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
      </div>
    </main>
  );
}