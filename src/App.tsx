import { Route, Routes } from "react-router-dom";
import "./App.css";
import Homepage from "./Homepage";
import LoginPage from "./LoginPage";

import TransferTokens from "./pages/TransferTokens";

function App() {
  // const oktoClient = useOkto();

  // const isloggedIn = oktoClient.isLoggedIn();

  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<Homepage />} />

        <Route path="/transfertoken" element={<TransferTokens />} />
       
      </Routes>
    </>
  );
}

export default App;
