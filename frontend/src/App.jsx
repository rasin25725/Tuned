import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Song from "./pages/Song";
import Profile from "./pages/Profile";
import Feed from "./pages/Feed";
import Admin from "./pages/Admin";
import ProtectedRoute from "./pages/ProtectedRoute";
import AdminRoute from "./pages/AdminRoute";

function App() {
    return (
        <Routes>
            {/* PUBLIC */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* LOGGED-IN USERS */}
            <Route element={<ProtectedRoute />}>
                <Route path="/home" element={<Home />} />
                <Route path="/song/:youtubeVideoId" element={<Song />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/feed" element={<Feed />} />

                {/* ADMIN ONLY */}
                <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<Admin />} />
                </Route>

            </Route>

            {/* UNKNOWN ROUTES */}
            <Route path="*" element={<Navigate to="/home" replace />} />

        </Routes>
    );
}

export default App;