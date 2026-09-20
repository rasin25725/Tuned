import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
    Search,
    Music2,
    LogOut,
    User,
    Heart,
    Activity,
    ShieldCheck,
    History,
} from "lucide-react";

function Home() {
    const navigate = useNavigate();

    const [search, setSearch] = useState("");
    const [searchHistory, setSearchHistory] = useState([]);
    const [showSearchHistory, setShowSearchHistory] = useState(false);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [likedSongs, setLikedSongs] = useState({});
    const [songIds, setSongIds] = useState({});
    const [likeCounts, setLikeCounts] = useState({});
    const [likingSongs, setLikingSongs] = useState({});

    const handleSearch = async (e) => {
        e.preventDefault();

        console.log("SEARCH BUTTON CLICKED");

        const query = search.trim();

        if (query) {
            const user = JSON.parse(localStorage.getItem("user") || "null");

            const historyKey = user
                ? `tunedSearchHistory_${user.id}`
                : null;

            const existingHistory = historyKey
                ? JSON.parse(localStorage.getItem(historyKey) || "[]")
                : [];

            const updatedHistory = [
                query,
                ...existingHistory.filter(
                    (item) => item.toLowerCase() !== query.toLowerCase()
                ),
            ].slice(0, 10);

            if (historyKey) {
                localStorage.setItem(
                    historyKey,
                    JSON.stringify(updatedHistory)
                );
            }

            setSearchHistory(updatedHistory);
            setShowSearchHistory(false);
        }

        console.log("SEARCH QUERY:", query);

        if (!query) {
            setError("Enter a song, artist, or album.");
            return;
        }

        const token = localStorage.getItem("token");

        console.log("TOKEN EXISTS:", !!token);

        if (!token) {
            setError("Your login session has expired. Please login again.");
            navigate("/login");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setSongs([]);

            console.log("SENDING REQUEST TO BACKEND...");

            const response = await axios.get(
                "http://localhost:5000/api/youtube/search",
                {
                    params: {
                        q: query,
                    },
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            console.log("BACKEND RESPONSE:", response.data);

            setSongs(
                Array.isArray(response.data)
                ? response.data
                : response.data.results || []
            );

        } catch (err) {
            console.error("SEARCH ERROR:", err);

            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");

                navigate("/login");
                return;
            }

            setError(
                err.response?.data?.message ||
                "Something went wrong while searching."
            );

        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const historyKey = user
            ? `tunedSearchHistory_${user.id}`
            : null;

        if (historyKey) {
            const savedHistory = JSON.parse(
                localStorage.getItem(historyKey) || "[]"
            );

            setSearchHistory(
                Array.isArray(savedHistory) ? savedHistory : []
            );
        }
    }, []);

    // LOAD USER'S LIKES
    useEffect(() => {
        const loadMyLikes = async () => {
            const token = localStorage.getItem("token");

            if (!token) return;

            try {
                const response = await axios.get(
                    "http://localhost:5000/api/likes/my",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const likes = Array.isArray(response.data)
                    ? response.data
                    : response.data.likes || [];

                const likedMap = {};
                const songIdMap = {};

                likes.forEach((like) => {
                    const song = like.song;

                    if (song?.youtubeVideoId) {
                        likedMap[song.youtubeVideoId] = true;
                        songIdMap[song.youtubeVideoId] = song._id;
                    }
                });

                setLikedSongs(likedMap);
                setSongIds(songIdMap);

            } catch (err) {
                console.error("LOAD LIKES ERROR:", err);

                if (err.response?.status === 401) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    navigate("/login");
                }
            }
        };

        loadMyLikes();
    }, [navigate]);

    // LOAD LIKE COUNTS
    useEffect(() => {
        const loadLikeCounts = async () => {
            const entries = Object.entries(songIds);

            if (entries.length === 0) return;

            const results = await Promise.all(
                entries.map(async ([youtubeVideoId, mongoSongId]) => {
                    try {
                        const response = await axios.get(
                            `http://localhost:5000/api/likes/${mongoSongId}/count`
                        );

                        return {
                            youtubeVideoId,
                            count: response.data.likes || 0,
                        };
                    } catch {
                        return {
                            youtubeVideoId,
                            count: 0,
                        };
                    }
                })
            );

            const counts = {};

            results.forEach((item) => {
                counts[item.youtubeVideoId] = item.count;
            });

            setLikeCounts((previous) => ({
                ...previous,
                ...counts,
            }));
        };

        loadLikeCounts();
    }, [songIds]);

    // LIKE / UNLIKE
    const handleLike = async (e, song) => {
        e.stopPropagation();

        const youtubeVideoId = song.youtubeVideoId;

        if (likingSongs[youtubeVideoId]) return;

        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        try {
            setLikingSongs((previous) => ({
                ...previous,
                [youtubeVideoId]: true,
            }));

            let mongoSongId = songIds[youtubeVideoId];

            // Save song first if it doesn't exist in MongoDB
            if (!mongoSongId) {
                const saveResponse = await axios.post(
                    "http://localhost:5000/api/songs",
                    {
                        youtubeVideoId: song.youtubeVideoId,
                        title: song.title,
                        artist: song.artist || song.channel || "Unknown Artist",
                        thumbnail: song.thumbnail,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const savedSong =
                    saveResponse.data.song || saveResponse.data;

                mongoSongId = savedSong._id;

                setSongIds((previous) => ({
                    ...previous,
                    [youtubeVideoId]: mongoSongId,
                }));
            }

            let likeResponse;

            // UNLIKE
            if (likedSongs[youtubeVideoId]) {
                likeResponse = await axios.delete(
                    `http://localhost:5000/api/likes/${mongoSongId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setLikedSongs((previous) => ({
                    ...previous,
                    [youtubeVideoId]: false,
                }));
            }

            // LIKE
            else {
                likeResponse = await axios.post(
                    `http://localhost:5000/api/likes/${mongoSongId}`,
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setLikedSongs((previous) => ({
                    ...previous,
                    [youtubeVideoId]: true,
                }));
            }

            setLikeCounts((previous) => ({
                ...previous,
                [youtubeVideoId]: likeResponse.data.likes || 0,
            }));

        } catch (err) {
            console.error("LIKE ERROR:", err);

            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login");
            }
        } finally {
            setLikingSongs((previous) => ({
                ...previous,
                [youtubeVideoId]: false,
            }));
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        navigate("/login");
    };

    const handleSongClick = (song) => {
        navigate(`/song/${song.youtubeVideoId}`, {
            state: {
                song,
            },
        });
    };

    return (
        <div className="home-page">

            {/* NAVBAR */}

            <nav className="home-navbar">

                <div className="home-logo">

                    <div className="home-logo-icon">
                        <Music2 size={20} />
                    </div>

                    <span>TUNED</span>

                </div>

                <div className="home-nav-actions">

                    <button
                        className="nav-icon-button"
                        title="Feed"
                        onClick={() => navigate("/feed")}
                    >
                        <Activity size={20} />
                    </button>

                    <button
                        className="nav-icon-button"
                        title="Profile"
                        onClick={() => navigate("/profile")}
                    >
                        <User size={20} />
                    </button>

                    {JSON.parse(localStorage.getItem("user") || "null")?.role === "admin" && (
                        <button
                            className="nav-icon-button"
                            title="Admin"
                            onClick={() => navigate("/admin")}
                        >
                            <ShieldCheck size={20} />
                        </button>
                    )}

                    <button
                        className="nav-icon-button"
                        title="Logout"
                        onClick={handleLogout}
                    >
                        <LogOut size={19} />
                    </button>

                </div>

            </nav>


            {/* MAIN */}

            <main className="home-content">

                {/* HERO */}

                <section className="home-hero">

                    <div className="hero-text">

                        <p className="home-eyebrow">
                            DISCOVER YOUR SOUND
                        </p>

                        <h1>
                            Find music.
                            <br />
                            <span>Make it yours.</span>
                        </h1>

                        <p className="hero-description">
                            Search for songs, discover new music,
                            and build your personal taste on Tuned.
                        </p>

                    </div>


                    {/* SEARCH FORM */}

                    <form
                        className="home-search"
                        onSubmit={handleSearch}
                    >

                        <Search size={21} />

                        <input
                            type="text"
                            placeholder="Search songs, artists, albums..."
                            value={search}
                            autoComplete="off"
                            onFocus={() => setShowSearchHistory(true)}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setError("");
                                setShowSearchHistory(true);
                            }}
                        />

                        {showSearchHistory &&
                            search.trim() &&
                            searchHistory.filter((item) =>
                                item.toLowerCase().includes(search.toLowerCase())
                            ).length > 0 && (
                                <div className="search-history">
                                    {searchHistory
                                        .filter((item) =>
                                            item.toLowerCase().includes(search.toLowerCase())
                                        )
                                        .map((item) => (
                                            <button
                                                type="button"
                                                className="search-history-item"
                                                key={item}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setSearch(item);
                                                    setShowSearchHistory(false);
                                                }}
                                            >
                                                <History size={16} />
                                                <span>{item}</span>
                                            </button>
                                        ))}
                                </div>
                            )}

                        <button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Searching..." : "Search"}
                        </button>

                    </form>


                    {/* ERROR */}

                    {error && (
                        <p className="home-error">
                            {error}
                        </p>
                    )}

                </section>


                {/* LOADING */}

                {loading && (
                    <section className="results-section">

                        <div className="section-heading">

                            <div>

                                <p className="section-label">
                                    SEARCHING
                                </p>

                                <h2>
                                    Finding your music...
                                </h2>

                            </div>

                        </div>

                    </section>
                )}


                {/* RESULTS */}

                {!loading && songs.length > 0 && (
                    <section className="results-section">

                        <div className="section-heading">

                            <div>

                                <p className="section-label">
                                    SEARCH RESULTS
                                </p>

                                <h2>
                                    Music for you
                                </h2>

                            </div>

                            <span className="result-count">
                                {songs.length} results
                            </span>

                        </div>


                        <div className="song-grid">

                            {songs.map((song) => (

                                <article
                                    className="song-card"
                                    key={song.youtubeVideoId}
                                    onClick={() =>
                                        handleSongClick(song)
                                    }
                                >

                                    <div className="song-image-wrapper">

                                        <img
                                            src={song.thumbnail}
                                            alt={song.title}
                                            className="song-image"
                                        />

                                        <div className="song-overlay">
                                        </div>

                                    </div>


                                    <div className="song-info">

                                        <h3 title={song.title}>
                                            {song.title}
                                        </h3>

                                        <p>
                                            {song.channel}
                                        </p>

                                    </div>


                                    <button
                                        type="button"
                                        className={`song-like-button ${
                                            likedSongs[song.youtubeVideoId] ? "liked" : ""
                                        }`}
                                        title={
                                            likedSongs[song.youtubeVideoId]
                                                ? "Unlike"
                                                : "Like"
                                        }
                                        disabled={likingSongs[song.youtubeVideoId]}
                                        onClick={(e) => handleLike(e, song)}
                                    >
                                        <Heart
                                            size={18}
                                            fill={
                                                likedSongs[song.youtubeVideoId]
                                                    ? "currentColor"
                                                    : "none"
                                            }
                                        />

                                        {likeCounts[song.youtubeVideoId] > 0 && (
                                            <span className="song-like-count">
                                                {likeCounts[song.youtubeVideoId]}
                                            </span>
                                        )}
                                    </button>

                                </article>

                            ))}

                        </div>

                    </section>
                )}


                {/* EMPTY STATE */}

                {!loading && songs.length === 0 && !error && (
                    <section className="discover-section">

                        <div className="discover-card">

                            <div className="discover-icon">
                                <Music2 size={28} />
                            </div>

                            <div>

                                <p className="section-label">
                                    START EXPLORING
                                </p>

                                <h2>
                                    What are you listening to?
                                </h2>

                                <p>
                                    Search for a song or artist above
                                    and start building your music taste.
                                </p>

                            </div>

                        </div>

                    </section>
                )}

            </main>

        </div>
    );
}

export default Home;