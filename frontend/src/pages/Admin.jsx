import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
    Music2,
    Users,
    Star,
    MessageSquare,
    Heart,
    Trash2,
    LogOut,
    Home,
    User,
    LayoutDashboard,
} from "lucide-react";

function Admin() {
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [songs, setSongs] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState("");

    const token = localStorage.getItem("token");

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const loadDashboard = async () => {
        try {
            setLoading(true);
            setError("");

            const headers = {
                Authorization: `Bearer ${token}`,
            };

            const [
                statsResponse,
                usersResponse,
                songsResponse,
            ] = await Promise.all([
                axios.get(
                    "http://localhost:5000/api/admin/stats",
                    { headers }
                ),
                axios.get(
                    "http://localhost:5000/api/admin/users",
                    { headers }
                ),
                axios.get(
                    "http://localhost:5000/api/admin/songs",
                    { headers }
                ),
            ]);

            setStats(statsResponse.data);
            setUsers(
                Array.isArray(usersResponse.data)
                    ? usersResponse.data
                    : []
            );
            setSongs(
                Array.isArray(songsResponse.data)
                    ? songsResponse.data
                    : []
            );

        } catch (err) {
            console.error("ADMIN ERROR:", err);

            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login");
                return;
            }

            if (err.response?.status === 403) {
                navigate("/home");
                return;
            }

            setError(
                err.response?.data?.message ||
                "Unable to load admin dashboard."
            );

        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const deleteSong = async (songId) => {
        const confirmed = window.confirm(
            "Delete this song and all related ratings, reviews and likes?"
        );

        if (!confirmed) return;

        try {
            setDeleting(songId);

            await axios.delete(
                `http://localhost:5000/api/songs/${songId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setSongs((previous) =>
                previous.filter(
                    (song) => song._id !== songId
                )
            );

            setStats((previous) => ({
                ...previous,
                songs: Math.max((previous?.songs || 0) - 1, 0),
            }));

        } catch (err) {
            alert(
                err.response?.data?.message ||
                "Unable to delete song."
            );
        } finally {
            setDeleting("");
        }
    };

    if (loading) {
        return (
            <div className="admin-page">
                <div className="page-loading">
                    Loading dashboard...
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page">

            <nav className="admin-navbar">

                <button
                    className="brand-button"
                    onClick={() => navigate("/home")}
                >
                    <span className="brand-icon">
                        <Music2 size={19} />
                    </span>

                    <span>TUNED</span>
                </button>

                <div className="admin-nav-actions">

                    <button
                        className="nav-icon-button"
                        title="Home"
                        onClick={() => navigate("/home")}
                    >
                        <Home size={19} />
                    </button>

                    <button
                        className="nav-icon-button"
                        title="Profile"
                        onClick={() => navigate("/profile")}
                    >
                        <User size={19} />
                    </button>

                    <button
                        className="nav-icon-button"
                        title="Logout"
                        onClick={logout}
                    >
                        <LogOut size={19} />
                    </button>

                </div>

            </nav>

            <main className="admin-content">

                <header className="admin-header">

                    <div>
                        <p className="section-label">
                            TUNED CONTROL CENTER
                        </p>

                        <h1>Admin Dashboard</h1>

                        <p>
                            Manage the Tuned community and
                            music catalogue.
                        </p>
                    </div>

                    <div className="admin-header-icon">
                        <LayoutDashboard size={30} />
                    </div>

                </header>

                {error && (
                    <div className="admin-error">
                        {error}
                    </div>
                )}

                {stats && (
                    <section className="admin-stats">

                        <div className="admin-stat-card">
                            <Users size={22} />
                            <span>Users</span>
                            <strong>{stats.users}</strong>
                        </div>

                        <div className="admin-stat-card">
                            <Music2 size={22} />
                            <span>Songs</span>
                            <strong>{stats.songs}</strong>
                        </div>

                        <div className="admin-stat-card">
                            <Star size={22} />
                            <span>Ratings</span>
                            <strong>{stats.ratings}</strong>
                        </div>

                        <div className="admin-stat-card">
                            <MessageSquare size={22} />
                            <span>Reviews</span>
                            <strong>{stats.reviews}</strong>
                        </div>

                        <div className="admin-stat-card">
                            <Heart size={22} />
                            <span>Likes</span>
                            <strong>{stats.likes}</strong>
                        </div>

                    </section>
                )}

                <section className="admin-section">

                    <div className="admin-section-heading">
                        <div>
                            <p className="section-label">
                                COMMUNITY
                            </p>

                            <h2>Users</h2>
                        </div>

                        <span>
                            {users.length} shown
                        </span>
                    </div>

                    <div className="admin-table-wrapper">

                        <table className="admin-table">

                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Joined</th>
                                </tr>
                            </thead>

                            <tbody>

                                {users.map((user) => (
                                    <tr key={user._id}>

                                        <td>{user.name}</td>

                                        <td>{user.email}</td>

                                        <td>
                                            <span
                                                className={
                                                    user.role === "admin"
                                                        ? "admin-role"
                                                        : "user-role"
                                                }
                                            >
                                                {user.role}
                                            </span>
                                        </td>

                                        <td>
                                            {new Date(
                                                user.createdAt
                                            ).toLocaleDateString()}
                                        </td>

                                    </tr>
                                ))}

                            </tbody>

                        </table>

                    </div>

                </section>

                <section className="admin-section">

                    <div className="admin-section-heading">
                        <div>
                            <p className="section-label">
                                CATALOGUE
                            </p>

                            <h2>Saved Songs</h2>
                        </div>

                        <span>
                            {songs.length} shown
                        </span>
                    </div>

                    <div className="admin-song-list">

                        {songs.length === 0 ? (
                            <div className="admin-empty">
                                No songs saved yet.
                            </div>
                        ) : (
                            songs.map((song) => (
                                <div
                                    className="admin-song-row"
                                    key={song._id}
                                >

                                    <img
                                        src={song.thumbnail}
                                        alt=""
                                    />

                                    <div className="admin-song-info">

                                        <strong>
                                            {song.title}
                                        </strong>

                                        <span>
                                            {song.artist ||
                                                "Unknown artist"}
                                        </span>

                                    </div>

                                    <button
                                        className="admin-delete-button"
                                        title="Delete song"
                                        onClick={() =>
                                            deleteSong(song._id)
                                        }
                                        disabled={
                                            deleting === song._id
                                        }
                                    >
                                        <Trash2 size={18} />
                                    </button>

                                </div>
                            ))
                        )}

                    </div>

                </section>

            </main>

        </div>
    );
}

export default Admin;