import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../api";
import {
    ArrowLeft,
    Heart,
    LogOut,
    Mail,
    Music2,
    Star,
    User,
} from "lucide-react";

function Profile() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [ratings, setRatings] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [likedSongs, setLikedSongs] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const token = localStorage.getItem("token");

    useEffect(() => {
        if (!token) {
            navigate("/login");
            return;
        }

        loadProfile();
    }, [token, navigate]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError("");

            const storedUser = localStorage.getItem("user");

            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }

            const headers = {
                Authorization: `Bearer ${token}`,
            };

            const [profileResponse, ratingsResponse, reviewsResponse, likesResponse] =
                await Promise.all([
                    axios.get(`${API_URL}/api/profile`, { headers }),
                    axios.get(`${API_URL}/api/ratings/my`, { headers }),
                    axios.get(`${API_URL}/api/reviews/my`, { headers }),
                    axios.get(`${API_URL}/api/likes/my`, { headers }),
                ]);

            const profileData = profileResponse.data;

            setUser(
                profileData.user ||
                profileData
            );

            setRatings(
                Array.isArray(ratingsResponse.data)
                    ? ratingsResponse.data
                    : ratingsResponse.data.ratings || []
            );

            setReviews(
                Array.isArray(reviewsResponse.data)
                    ? reviewsResponse.data
                    : reviewsResponse.data.reviews || []
            );

            setLikedSongs(
                Array.isArray(likesResponse.data)
                    ? likesResponse.data
                    : likesResponse.data.likes || []
            );

        } catch (err) {
            console.error("PROFILE ERROR:", err);

            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login");
                return;
            }

            setError(
                err.response?.data?.message ||
                "Unable to load your profile."
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

    const getSong = (item) => {
        return (
            item.song ||
            item.songId ||
            item
        );
    };

    const getSongId = (item) => {
        const song = getSong(item);

        if (!song) {
            return null;
        }

        return (
            song.youtubeVideoId ||
            song.youtubeId ||
            song._id ||
            null
        );
    };

    const getSongTitle = (item) => {
        const song = getSong(item);

        return song?.title || "Unknown song";
    };

    const getSongArtist = (item) => {
        const song = getSong(item);

        return (
            song?.artist ||
            song?.channel ||
            "Unknown artist"
        );
    };

    const getSongThumbnail = (item) => {
        const song = getSong(item);

        return song?.thumbnail || "";
    };

    const openSong = (item) => {
        const song = getSong(item);

        if (!song?.youtubeVideoId) {
            return;
        }

        navigate(`/song/${song.youtubeVideoId}`, {
            state: {
                song,
            },
        });
    };

    if (loading) {
        return (
            <div className="profile-loading-page">
                <div className="profile-loading-card">
                    <div className="profile-loading-icon">
                        <Music2 size={28} />
                    </div>

                    <p>Loading your profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="profile-error-page">
                <div className="profile-error-card">
                    <div className="profile-loading-icon">
                        <Music2 size={28} />
                    </div>

                    <h2>Something went wrong</h2>
                    <p>{error}</p>

                    <button
                        type="button"
                        onClick={loadProfile}
                        className="profile-retry-button"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">

            {/* NAVBAR */}

            <nav className="profile-navbar">

                <button
                    type="button"
                    className="profile-back-button"
                    onClick={() => navigate("/home")}
                    title="Back to Home"
                >
                    <ArrowLeft size={19} />
                    <span>Home</span>
                </button>

                <div className="profile-logo">
                    <div className="profile-logo-icon">
                        <Music2 size={20} />
                    </div>

                    <span>TUNED</span>
                </div>

                <button
                    type="button"
                    className="profile-logout-button"
                    onClick={handleLogout}
                    title="Logout"
                >
                    <LogOut size={19} />
                </button>

            </nav>


            {/* MAIN */}

            <main className="profile-content">

                {/* PROFILE HEADER */}

                <section className="profile-header-card">

                    <div className="profile-avatar">
                        <User size={34} />
                    </div>

                    <div className="profile-header-info">

                        <p className="profile-section-label">
                            YOUR PROFILE
                        </p>

                        <h1>
                            {user?.name || "Tuned User"}
                        </h1>

                        <div className="profile-email">
                            <Mail size={16} />
                            <span>
                                {user?.email || "No email available"}
                            </span>
                        </div>

                    </div>

                    <div className="profile-role">
                        {(user?.role || "user").toUpperCase()}
                    </div>

                </section>


                {/* STATS */}

                <section className="profile-stats">

                    <div className="profile-stat-card">
                        <div className="profile-stat-icon">
                            <Star size={20} />
                        </div>

                        <div>
                            <strong>{ratings.length}</strong>
                            <span>Ratings</span>
                        </div>
                    </div>


                    <div className="profile-stat-card">
                        <div className="profile-stat-icon">
                            <Music2 size={20} />
                        </div>

                        <div>
                            <strong>{reviews.length}</strong>
                            <span>Reviews</span>
                        </div>
                    </div>


                    <div className="profile-stat-card">
                        <div className="profile-stat-icon">
                            <Heart size={20} />
                        </div>

                        <div>
                            <strong>{likedSongs.length}</strong>
                            <span>Liked</span>
                        </div>
                    </div>

                </section>


                {/* RATINGS */}

                <section className="profile-section">

                    <div className="profile-section-heading">
                        <div>
                            <p className="profile-section-label">
                                YOUR RATINGS
                            </p>

                            <h2>
                                Songs you've rated
                            </h2>
                        </div>

                        <span className="profile-section-count">
                            {ratings.length}
                        </span>
                    </div>


                    {ratings.length === 0 ? (
                        <div className="profile-empty-card">
                            <Star size={24} />

                            <h3>No ratings yet</h3>

                            <p>
                                Rate songs you listen to and they'll appear here.
                            </p>

                            <button
                                type="button"
                                onClick={() => navigate("/home")}
                            >
                                Discover music
                            </button>
                        </div>
                    ) : (
                        <div className="profile-song-list">

                            {ratings.map((rating) => {
                                const songId = getSongId(rating);

                                return (
                                    <article
                                        className="profile-song-card"
                                        key={rating._id || songId}
                                        onClick={() => openSong(rating)}
                                    >

                                        <div className="profile-song-image">

                                            {getSongThumbnail(rating) ? (
                                                <img
                                                    src={getSongThumbnail(rating)}
                                                    alt={getSongTitle(rating)}
                                                />
                                            ) : (
                                                <Music2 size={24} />
                                            )}

                                        </div>

                                        <div className="profile-song-details">

                                            <h3>
                                                {getSongTitle(rating)}
                                            </h3>

                                            <p>
                                                {getSongArtist(rating)}
                                            </p>

                                        </div>

                                        <div className="profile-rating">

                                            <Star
                                                size={17}
                                                fill="currentColor"
                                            />

                                            <span>
                                                {rating.rating}/5
                                            </span>

                                        </div>

                                    </article>
                                );
                            })}

                        </div>
                    )}

                </section>


                {/* REVIEWS */}

                <section className="profile-section">

                    <div className="profile-section-heading">
                        <div>
                            <p className="profile-section-label">
                                YOUR REVIEWS
                            </p>

                            <h2>
                                What you've written
                            </h2>
                        </div>

                        <span className="profile-section-count">
                            {reviews.length}
                        </span>
                    </div>


                    {reviews.length === 0 ? (
                        <div className="profile-empty-card">
                            <Music2 size={24} />

                            <h3>No reviews yet</h3>

                            <p>
                                Share what you think about the music you listen to.
                            </p>

                            <button
                                type="button"
                                onClick={() => navigate("/home")}
                            >
                                Find a song
                            </button>
                        </div>
                    ) : (
                        <div className="profile-review-list">

                            {reviews.map((review) => {
                                const songId = getSongId(review);

                                return (
                                    <article
                                        className="profile-review-card"
                                        key={review._id || songId}
                                        onClick={() => openSong(review)}
                                    >

                                        <div className="profile-review-top">

                                            <div className="profile-review-song">

                                                <div className="profile-review-image">

                                                    {getSongThumbnail(review) ? (
                                                        <img
                                                            src={getSongThumbnail(review)}
                                                            alt={getSongTitle(review)}
                                                        />
                                                    ) : (
                                                        <Music2 size={20} />
                                                    )}

                                                </div>

                                                <div>
                                                    <h3>
                                                        {getSongTitle(review)}
                                                    </h3>

                                                    <p>
                                                        {getSongArtist(review)}
                                                    </p>
                                                </div>

                                            </div>

                                            <span className="profile-review-date">
                                                {review.createdAt
                                                    ? new Date(
                                                        review.createdAt
                                                    ).toLocaleDateString()
                                                    : ""}
                                            </span>

                                        </div>

                                        <p className="profile-review-text">
                                            {review.text}
                                        </p>

                                    </article>
                                );
                            })}

                        </div>
                    )}

                </section>


                {/* LIKED SONGS */}

                <section className="profile-section">

                    <div className="profile-section-heading">
                        <div>
                            <p className="profile-section-label">
                                YOUR MUSIC
                            </p>

                            <h2>
                                Liked songs
                            </h2>
                        </div>

                        <span className="profile-section-count">
                            {likedSongs.length}
                        </span>
                    </div>


                    {likedSongs.length === 0 ? (
                        <div className="profile-empty-card">
                            <Heart size={24} />

                            <h3>No liked songs</h3>

                            <p>
                                Songs you like will be collected here.
                            </p>

                            <button
                                type="button"
                                onClick={() => navigate("/home")}
                            >
                                Explore music
                            </button>
                        </div>
                    ) : (
                        <div className="profile-song-grid">

                            {likedSongs.map((like) => {
                                const songId = getSongId(like);

                                return (
                                    <article
                                        className="profile-liked-card"
                                        key={like._id || songId}
                                        onClick={() => openSong(like)}
                                    >

                                        <div className="profile-liked-image">

                                            {getSongThumbnail(like) ? (
                                                <img
                                                    src={getSongThumbnail(like)}
                                                    alt={getSongTitle(like)}
                                                />
                                            ) : (
                                                <Music2 size={28} />
                                            )}

                                            <div className="profile-liked-overlay">
                                                <Heart
                                                    size={18}
                                                    fill="currentColor"
                                                />
                                            </div>

                                        </div>

                                        <div className="profile-liked-info">

                                            <h3 title={getSongTitle(like)}>
                                                {getSongTitle(like)}
                                            </h3>

                                            <p>
                                                {getSongArtist(like)}
                                            </p>

                                        </div>

                                    </article>
                                );
                            })}

                        </div>
                    )}

                </section>

            </main>

        </div>
    );
}

export default Profile;