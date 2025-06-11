import { googleLogout } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import GetButton from "./components/GetButton";
import { verifySession } from "../auth/verifySession_template";

export default function Homepage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userSWA, setUserSWA] = useState("");
  const [clientSWA, setClientSWA] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const sessionToken = localStorage.getItem("okto_session");
      if (!sessionToken) {
        navigate("/");
        return;
      }
  
      try {
        const sessionData = await verifySession(sessionToken);
  
        if (sessionData?.status === "success") {
          const { user_swa, client_swa, vendor_swa, user_id, client_id, is_session_added } = sessionData.data;
  
          setIsLoggedIn(true);
          setUserSWA(user_swa || "");
          setClientSWA(vendor_swa || client_swa || "");
  
          localStorage.setItem("okto_user_id", user_id || "");
          localStorage.setItem("okto_client_id", client_id || "");
          localStorage.setItem("okto_is_session_added", JSON.stringify(is_session_added));

        } else {
          handleLogout();
        }
      } catch (error) {
        console.error("Session verification failed:", error);
        handleLogout();
      }
    };
  
    checkSession();
  }, [navigate]);
  
  

  async function handleLogout() {
    try {
      googleLogout();
      localStorage.removeItem("googleIdToken");
      localStorage.removeItem("okto_session");
      localStorage.removeItem("ethereumAddress");
      navigate("/");
      return { result: "logout success" };
    } catch (error) {
      console.error("Logout failed:", error);
      return { result: "logout failed" };
    }
  }

  async function getSessionInfo() {
    const session = localStorage.getItem("okto_session");
    if (!session) return { result: {} };

    try {
      const sessionData = await verifySession(session);
      return { result: sessionData };
    } catch (error) {
      console.error("Failed to get session info:", error);
      return { result: {} };
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 to-violet-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <h2 className="text-violet-900 font-bold text-2xl">User Details</h2>
          <pre className="whitespace-pre-wrap break-words bg-white p-6 rounded-xl text-gray-800 w-full border border-violet-200 shadow-lg">
            {isLoggedIn
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