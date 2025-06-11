import React, { useState } from "react";
import axios from "axios";
import CopyButton from "./CopyButton";

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
interface GetButtonProps {
  title: string;
  apiFn: () => Promise<any>;
  tag: string;
}

const GetButton: React.FC<GetButtonProps> = ({ title, apiFn, tag }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [resultData, setResultData] = useState("");

  const handleButtonClick = async () => {
    try {
      const session = localStorage.getItem("okto_session");
      if (!session) {
        setResultData("No session found");
        setModalVisible(true);
        return;
      }

      const sessionData = await verifySession(session);
      if (sessionData.status !== "success") {
        setResultData("Invalid session");
        setModalVisible(true);
        return;
      }

      const result = await apiFn();
      console.log(`${title}:`, result);
      const resultData = JSON.stringify(result, null, 2);
      setResultData(resultData !== "null" ? resultData : "No result");
      setModalVisible(true);
    } catch (error) {
      console.error(`${title} error:`, error);
      setResultData(`error: ${error}`);
      setModalVisible(true);
    }
  };

  const handleClose = () => setModalVisible(false);

  return (
    <div className="text-center">
      <button
        className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        onClick={handleButtonClick}
      >
        {title}
      </button>

      {modalVisible && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-black rounded-lg w-11/12 max-w-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-4">
              <div className="flex-1 text-left">
                <h2 className="text-lg font-semibold text-white">
                  {title} Result
                </h2>
                <p className="text-sm font-regular text-white">{tag}</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-200 transition-colors text-2xl"
                onClick={handleClose}
              >
                &times;
              </button>
            </div>
            <div className="text-left text-white max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words bg-gray-900 p-4 rounded">
                <CopyButton text={resultData} />
                {resultData}
              </pre>
            </div>
            <div className="mt-4 text-right">
              <button
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GetButton;