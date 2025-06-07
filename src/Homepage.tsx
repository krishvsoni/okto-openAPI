import {
  useOkto,
} from "@okto_web3/react-sdk";
import { googleLogout } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import GetButton from "./components/GetButton";

export default function Homepage() {
  const oktoClient = useOkto();
  const navigate = useNavigate();
  const isloggedIn = oktoClient.isLoggedIn();
  const userSWA = oktoClient.userSWA;
  const clientSWA = oktoClient.clientSWA;

  // handles user logout process
  async function handleLogout() {
    try {
      // Perform Google OAuth logout and remove stored token
      googleLogout();
      oktoClient.sessionClear();
      localStorage.removeItem("googleIdToken");
      navigate("/");
      return { result: "logout success" };
    } catch (error) {
      console.error("Logout failed:", error);
      return { result: "logout failed" };
    }
  }

  async function getSessionInfo() {
    const session = localStorage.getItem("okto_session");
    const sessionInfo = JSON.parse(session || "{}");
    return { result: sessionInfo };
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 to-violet-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* <h1 className="text-center text-4xl font-bold text-violet-900 mb-12">
          Okto v2 SDK Demo
        </h1> */}

        {/* <div className="space-y-4">
          <h2 className="text-violet-900 font-bold text-2xl">Env Config</h2>
          <pre className="whitespace-pre-wrap break-words bg-white p-6 rounded-xl text-gray-800 w-full border border-violet-200 shadow-lg">
            {isloggedIn ? JSON.stringify(envconfig, null, 2) : "not signed in"}
          </pre>
        </div> */}
        <div className="space-y-4">
          <h2 className="text-violet-900 font-bold text-2xl">User Details</h2>
          <pre className="whitespace-pre-wrap break-words bg-white p-6 rounded-xl text-gray-800 w-full border border-violet-200 shadow-lg">
            {isloggedIn
              ? `Logged in \n userSWA: ${userSWA} \n clientSWA: ${clientSWA}`
              : "not signed in"}
          </pre>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-violet-200 p-6 mb-8">
          <h2 className="text-violet-900 font-semibold text-2xl mb-6">
            Session
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <GetButton title="Okto Log out" apiFn={handleLogout} tag="" />
            <GetButton
              title="Show Session Info"
              apiFn={getSessionInfo}
              tag=""
            />
          </div>
        </div>


{/* 
        <div className="bg-white rounded-xl shadow-lg border border-violet-200 p-6">
          <SignComponent />
        </div> */}

        <div className="bg-white rounded-xl shadow-lg border border-violet-200 p-6">
          <h2 className="text-violet-900 font-semibold text-2xl mb-6">
            Intents
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate("/transfertoken")}
              className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-center font-medium"
            >
              Transfer Token
            </button>
          
          </div>
        </div>
      </div>
    </main>
  );
}
