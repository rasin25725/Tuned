import { Navigate, Outlet } from "react-router-dom";

function AdminRoute() {
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (!user || user.role !== "admin") {
        return <Navigate to="/home" replace />;
    }

    return <Outlet />;
}

export default AdminRoute;