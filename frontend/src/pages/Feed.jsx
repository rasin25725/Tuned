import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../api";
import {
    ArrowLeft,
    Heart,
    LogOut,
    MessageSquare,
    Music2,
    Star,
    User,
} from "lucide-react";

function Feed() {
    const navigate = useNavigate();

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const token = localStorage.getItem("token");

    useEffect(() => {
        if (!token) {
            navigate("/login");
            return;
        }

        loadFeed();
    }, [token, navigate]);

    const loadFeed = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await axios.get(`${API_URL}/api/feed`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setActivities(
                Array.isArray(response.data)
                    ? response.data
                    : response.data.activities ||
                      response.data.feed ||
                      []
            );
        } catch (err) {
            console.error("FEED ERROR:", err);

            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login");
                return;
            }

            setError(
                err.response?.data?.message ||
                "Unable to load your feed."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        navigate("/login");
    };

    const getUserName = (activity) => {
        return (
            activity.user?.name ||
            activity.userId?.name ||
            activity.userName ||
            "Tuned User"
        );
    };

    const getSong = (activity) => {
        return activity.song || activity.songId || null;
    };

    const getSongTitle = (activity) => {
        const song = getSong(activity);

        return song?.title || activity.songTitle || "Unknown song";
    };

    const getSongArtist = (activity) => {
        const song = getSong(activity);

        return (
            song?.artist ||
            song?.channel ||
            activity.artist ||
            "Unknown artist"
        );
    };

    const getSongThumbnail = (activity) => {
        const song = getSong(activity);

        return song?.thumbnail || activity.thumbnail || "";
    };

    const getYoutubeId = (activity) => {
        const song = getSong(activity);

        return (
            song?.youtubeVideoId ||
            activity.youtubeVideoId ||
            null
        );
    };

    const openSong = (activity) => {
        const youtubeVideoId = getYoutubeId(activity);

        if (!youtubeVideoId) {
            return;
        }

        navigate(`/song/${youtubeVideoId}`, {
            state: {
                song: getSong(activity),
            },
        });
    };

    const getActivityIcon = (type) => {
        if (type === "rating") {
            return <Star size={17} fill="currentColor" />;
        }

        if (type === "review") {
            return <MessageSquare size={17} />;
        }

        if (type === "like") {
            return <Heart size={17} fill="currentColor" />;
        }

        return <Music2 size={17} />;
    };

    const getActivityText = (activity) => {
        const name = getUserName(activity);

        if (activity.type === "rating") {
            return (
                <>
                    <strong>{name}</strong> rated a song
                </>
            );
        }

        if (activity.type === "review") {
            return (
                <>
                    <strong>{name}</strong> reviewed a song
                </>
            );
        }

        if (activity.type === "like") {
            return (
                <>
                    <strong>{name}</strong> liked a song
                </>
            );
        }

        return (
            <>
                <strong>{name}</strong> interacted with a song
            </>
        );
    };

    const renderRating = (rating) => {
        if (!rating) {
            return null;
        }

        return (
            <div className="feed-rating">
                <Star size={15} fill="currentColor" />
                <span>{rating}/5</span>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="feed-loading-page">
                <div className="feed-loading-card">
                    <div className="feed-loading-icon">
                        <Music2 size={28} />
                    </div>

                    <p>Loading your feed...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="feed-error-page">
                <div className="feed-error-card">
                    <div className="feed-loading-icon">
                        <Music2 size={28} />
                    </div>

                    <h2>Something went wrong</h2>

                    <p>{error}</p>

                    <button
                        type="button"
                        onClick={loadFeed}
                        className="feed-retry-button"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="feed-page">

            {/* NAVBAR */}

            <nav className="feed-navbar">

                <button
                    type="button"
                    className="feed-back-button"
                    onClick={() => navigate("/home")}
                >
                    <ArrowLeft size={19} />
                    <span>Home</span>
                </button>

                <div className="feed-logo">
                    <div className="feed-logo-icon">
                        <Music2 size={20} />
                    </div>

                    <span>TUNED</span>
                </div>

                <div className="feed-nav-actions">

                    <button
                        type="button"
                        className="feed-nav-button"
                        title="Profile"
                        onClick={() => navigate("/profile")}
                    >
                        <User size={19} />
                    </button>

                    <button
                        type="button"
                        className="feed-nav-button"
                        title="Logout"
                        onClick={handleLogout}
                    >
                        <LogOut size={19} />
                    </button>

                </div>

            </nav>


            {/* MAIN */}

            <main className="feed-content">

                <section className="feed-heading">

                    <div>
                        <p className="feed-section-label">
                            TUNED COMMUNITY
                        </p>

                        <h1>
                            Your music feed.
                        </h1>

                        <p className="feed-description">
                            See what people are rating, reviewing,
                            and liking on Tuned.
                        </p>
                    </div>

                </section>


                {activities.length === 0 ? (
                    <section className="feed-empty">

                        <div className="feed-empty-icon">
                            <Music2 size={28} />
                        </div>

                        <h2>
                            Nothing here yet.
                        </h2>

                        <p>
                            Music activity from the Tuned community
                            will appear here.
                        </p>

                        <button
                            type="button"
                            onClick={() => navigate("/home")}
                        >
                            Discover music
                        </button>

                    </section>
                ) : (
                    <section className="feed-list">

                        {activities.map((activity, index) => {

                            const songId = getYoutubeId(activity);

                            return (
                                <article
                                    className={`feed-activity ${
                                        songId
                                            ? "feed-activity-clickable"
                                            : ""
                                    }`}
                                    key={
                                        activity._id ||
                                        `${activity.type}-${index}`
                                    }
                                    onClick={() => {
                                        if (songId) {
                                            openSong(activity);
                                        }
                                    }}
                                >

                                    {/* ACTIVITY HEADER */}

                                    <div className="feed-activity-header">

                                        <div className="feed-user">

                                            <div className="feed-user-avatar">
                                                <User size={17} />
                                            </div>

                                            <div className="feed-user-info">

                                                <p>
                                                    {getActivityText(activity)}
                                                </p>

                                                {activity.createdAt && (
                                                    <span>
                                                        {new Date(
                                                            activity.createdAt
                                                        ).toLocaleDateString(
                                                            undefined,
                                                            {
                                                                day: "numeric",
                                                                month: "short",
                                                                year: "numeric",
                                                            }
                                                        )}
                                                    </span>
                                                )}

                                            </div>

                                        </div>


                                        <div
                                            className={`feed-activity-icon feed-${activity.type}`}
                                        >
                                            {getActivityIcon(
                                                activity.type
                                            )}
                                        </div>

                                    </div>


                                    {/* SONG */}

                                    <div className="feed-song">

                                        <div className="feed-song-image">

                                            {getSongThumbnail(activity) ? (
                                                <img
                                                    src={getSongThumbnail(
                                                        activity
                                                    )}
                                                    alt={getSongTitle(
                                                        activity
                                                    )}
                                                />
                                            ) : (
                                                <Music2 size={25} />
                                            )}

                                        </div>


                                        <div className="feed-song-info">

                                            <h2>
                                                {getSongTitle(activity)}
                                            </h2>

                                            <p>
                                                {getSongArtist(activity)}
                                            </p>

                                            {activity.type === "rating" &&
                                                renderRating(
                                                    activity.rating
                                                )}

                                        </div>

                                    </div>


                                    {/* REVIEW */}

                                    {activity.type === "review" &&
                                        activity.review?.text && (
                                            <div className="feed-review">

                                                <MessageSquare size={16} />

                                                <p>
                                                    {activity.review.text}
                                                </p>

                                            </div>
                                        )}

                                    {activity.type === "review" &&
                                        activity.text && (
                                            <div className="feed-review">

                                                <MessageSquare size={16} />

                                                <p>
                                                    {activity.text}
                                                </p>

                                            </div>
                                        )}

                                </article>
                            );
                        })}

                    </section>
                )}

            </main>

        </div>
    );
}

export default Feed;