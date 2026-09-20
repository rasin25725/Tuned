import { useEffect, useState } from "react";
import {
    ArrowLeft,
    Heart,
    Play,
    Star,
    Send,
    Music2,
    User,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import API_URL from "../api";

function Song() {
    const { youtubeVideoId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const selectedSong = location.state?.song;

    const [song, setSong] = useState(selectedSong || null);
    const [songId, setSongId] = useState(null);

    const [averageRating, setAverageRating] = useState(0);
    const [myRating, setMyRating] = useState(0);

    const [likeCount, setLikeCount] = useState(0);
    const [liked, setLiked] = useState(false);

    const [reviews, setReviews] = useState([]);
    const [reviewText, setReviewText] = useState("");

    const [loading, setLoading] = useState(true);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [error, setError] = useState("");

    const token = localStorage.getItem("token");

    const authConfig = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };

    useEffect(() => {
        if (!token) {
            navigate("/login");
            return;
        }

        loadSong();
    }, [youtubeVideoId]);

    const loadSong = async () => {
        try {
            setLoading(true);
            setError("");

            /*
             * The search result already contains the YouTube information.
             * We save/find the song in our own database so that
             * ratings, likes and reviews can be connected to it.
             */

            let currentSong = selectedSong;

            if (!currentSong) {
                setError("Song information is missing.");
                setLoading(false);
                return;
            }

            const saveResponse = await axios.post(
                `${API_URL}/api/songs`,
                {
                    youtubeVideoId: currentSong.youtubeVideoId,
                    title: currentSong.title,
                    artist: currentSong.channel,
                    thumbnail: currentSong.thumbnail,
                },
                authConfig
            );

            const savedSong =
                saveResponse.data.song ||
                saveResponse.data;

            setSong(savedSong);
            setSongId(savedSong._id);

            await loadLikeData(savedSong._id);
            await loadSongData(savedSong._id);

        } catch (err) {
            console.error("SONG LOAD ERROR:", err);

            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login");
                return;
            }

            setError(
                err.response?.data?.message ||
                "Unable to load this song."
            );

        } finally {
            setLoading(false);
        }
    };

    const loadLikeData = async (id) => {
        try {
            const token = localStorage.getItem("token");

            const response = await axios.get(
                `${API_URL}/api/likes/${id}/count`
            );

            setLikeCount(response.data.likes || 0);

            const likedResponse = await axios.get(
                `${API_URL}/api/likes/${id}/check`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setLiked(likedResponse.data.liked);
        } catch (error) {
            console.error("Failed to load like data:", error);
        }
    };

    const loadSongData = async (id) => {
        try {
            const [
                ratingResponse,
                myRatingResponse,
                reviewsResponse,
            ] = await Promise.all([
                axios.get(
                    `${API_URL}/api/ratings/song/${id}/average`
                ),

                axios.get(
                    `${API_URL}/api/ratings/my`,
                    authConfig
                ),

                axios.get(
                    `${API_URL}/api/reviews/song/${id}`
                ),
            ]);

            setAverageRating(
                Number(
                    ratingResponse.data.average ||
                    ratingResponse.data.averageRating ||
                    0
                )
            );

            const myRatings =
                myRatingResponse.data.ratings ||
                myRatingResponse.data ||
                [];

            const currentRating = myRatings.find(
                (item) =>
                    String(item.song?._id || item.song) ===
                    String(id)
            );

            setMyRating(currentRating?.rating || 0);

            setReviews(
                reviewsResponse.data.reviews ||
                reviewsResponse.data ||
                []
            );

        } catch (err) {
            console.error(
                "SONG DATA ERROR:",
                err
            );
        }
    };

    const handleRating = async (rating) => {
        if (!songId) return;

        try {
            setMyRating(rating);

            const response = await axios.post(
                `${API_URL}/api/ratings`,
                {
                    song: songId,
                    rating,
                },
                authConfig
            );

            const newAverage =
                response.data.averageRating ??
                response.data.average ??
                null;

            if (newAverage !== null) {
                setAverageRating(Number(newAverage));
            } else {
                const averageResponse =
                    await axios.get(
                        `${API_URL}/api/ratings/song/${songId}/average`
                    );

                setAverageRating(
                    Number(
                        averageResponse.data.average ||
                        averageResponse.data.averageRating ||
                        0
                    )
                );
            }

        } catch (err) {
            console.error(
                "RATING ERROR:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Could not save your rating."
            );
        }
    };

    const handleLike = async () => {
        if (!songId) return;

        try {
            let likeResponse;

            if (liked) {
                likeResponse = await axios.delete(
                    `${API_URL}/api/likes/${songId}`,
                    authConfig
                );

                setLiked(false);

            } else {
                likeResponse = await axios.post(
                    `${API_URL}/api/likes/${songId}`,
                    {},
                    authConfig
                );

                setLiked(true);
            }

            setLikeCount(likeResponse.data.likes || 0);

        } catch (err) {
            console.error(
                "LIKE ERROR:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Could not update your like."
            );
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();

        const text = reviewText.trim();

        if (!text) {
            return;
        }

        if (!songId) {
            return;
        }

        try {
            setSubmittingReview(true);
            setError("");

            const response = await axios.post(
                `${API_URL}/api/reviews`,
                {
                    song: songId,
                    text,
                },
                authConfig
            );

            const newReview =
                response.data.review ||
                response.data;

            setReviews((current) => [
                newReview,
                ...current,
            ]);

            setReviewText("");

        } catch (err) {
            console.error(
                "REVIEW ERROR:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Could not post your review."
            );

        } finally {
            setSubmittingReview(false);
        }
    };

    const getUserName = (review) => {
        if (review.user?.name) {
            return review.user.name;
        }

        return "Tuned user";
    };

    if (loading) {
        return (
            <div className="song-loading-page">

                <div className="song-loading-content">

                    <div className="loading-icon">
                        <Music2 size={28} />
                    </div>

                    <p>
                        Loading song...
                    </p>

                </div>

            </div>
        );
    }

    if (error && !song) {
        return (
            <div className="song-error-page">

                <Music2 size={30} />

                <h2>
                    Something went wrong
                </h2>

                <p>
                    {error}
                </p>

                <button
                    onClick={() => navigate("/home")}
                >
                    Back to Discover
                </button>

            </div>
        );
    }

    if (!song) {
        return null;
    }

    return (
        <div className="song-page">

            {/* =========================
                NAVBAR
            ========================= */}

            <nav className="song-navbar">

                <button
                    className="back-button"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft size={19} />
                    <span>Back</span>
                </button>

                <div className="song-page-logo">

                    <div className="song-page-logo-icon">
                        <Music2 size={19} />
                    </div>

                    <span>TUNED</span>

                </div>

            </nav>


            {/* =========================
                MAIN
            ========================= */}

            <main className="song-page-content">

                {error && (
                    <div className="song-page-error">
                        {error}
                    </div>
                )}


                {/* =========================
                    PLAYER
                ========================= */}

                <section className="song-player-section">

                    <div className="youtube-player">

                        <iframe
                            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                            title={song.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />

                    </div>

                </section>


                {/* =========================
                    SONG INFORMATION
                ========================= */}

                <section className="song-information">

                    <div className="song-main-info">

                        <p className="song-page-label">
                            NOW PLAYING
                        </p>

                        <h1>
                            {song.title}
                        </h1>

                        <p className="song-artist">
                            {song.artist || song.channel}
                        </p>

                    </div>


                    <button
                        className={`large-like-button ${
                            liked ? "liked" : ""
                        }`}
                        onClick={handleLike}
                    >

                        <Heart
                            size={21}
                            fill={
                                liked
                                    ? "currentColor"
                                    : "none"
                            }
                        />

                        <span>
                            {likeCount}
                        </span>

                    </button>

                </section>


                {/* =========================
                    RATING
                ========================= */}

                <section className="rating-section">

                    <div className="rating-summary">

                        <div className="rating-number">
                            {averageRating
                                ? averageRating.toFixed(1)
                                : "—"}
                        </div>

                        <div>

                            <div className="rating-stars-display">

                                {[1, 2, 3, 4, 5].map(
                                    (star) => (
                                        <Star
                                            key={star}
                                            size={18}
                                            fill={
                                                star <=
                                                Math.round(
                                                    averageRating
                                                )
                                                    ? "currentColor"
                                                    : "none"
                                        }
                                            />
                                    )
                                )}

                            </div>

                            <p>
                                Community rating
                            </p>

                        </div>

                    </div>


                    <div className="my-rating">

                        <p>
                            YOUR RATING
                        </p>

                        <div className="rating-buttons">

                            {[1, 2, 3, 4, 5].map(
                                (rating) => (
                                    <button
                                        key={rating}
                                        className={
                                            rating <= myRating
                                                ? "active"
                                                : ""
                                        }
                                        onClick={() =>
                                            handleRating(
                                                rating
                                            )
                                        }
                                        title={`Rate ${rating} out of 5`}
                                    >
                                        <Star
                                            size={22}
                                            fill={
                                                rating <=
                                                myRating
                                                    ? "currentColor"
                                                    : "none"
                                            }
                                        />
                                    </button>
                                )
                            )}

                        </div>

                    </div>

                </section>


                {/* =========================
                    REVIEWS
                ========================= */}

                <section className="reviews-section">

                    <div className="reviews-heading">

                        <div>

                            <p className="song-page-label">
                                COMMUNITY
                            </p>

                            <h2>
                                Reviews
                            </h2>

                        </div>

                        <span>
                            {reviews.length}
                        </span>

                    </div>


                    {/* Write review */}

                    <form
                        className="review-form"
                        onSubmit={handleReviewSubmit}
                    >

                        <textarea
                            value={reviewText}
                            onChange={(e) =>
                                setReviewText(
                                    e.target.value
                                )
                            }
                            placeholder="What do you think about this song?"
                            maxLength={2000}
                        />

                        <div className="review-form-bottom">

                            <span>
                                {reviewText.length}/2000
                            </span>

                            <button
                                type="submit"
                                disabled={
                                    submittingReview ||
                                    !reviewText.trim()
                                }
                            >
                                <Send size={17} />

                                {submittingReview
                                    ? "Posting..."
                                    : "Post review"}
                            </button>

                        </div>

                    </form>


                    {/* Review list */}

                    <div className="review-list">

                        {reviews.length === 0 ? (

                            <div className="no-reviews">

                                <div>
                                    <User size={23} />
                                </div>

                                <h3>
                                    No reviews yet
                                </h3>

                                <p>
                                    Be the first person to
                                    share what you think.
                                </p>

                            </div>

                        ) : (

                            reviews.map((review) => (

                                <article
                                    className="review-card"
                                    key={review._id}
                                >

                                    <div className="review-avatar">
                                        <User size={17} />
                                    </div>

                                    <div className="review-content">

                                        <div className="review-top">

                                            <strong>
                                                {getUserName(
                                                    review
                                                )}
                                            </strong>

                                            <span>
                                                {review.createdAt
                                                    ? new Date(
                                                        review.createdAt
                                                    ).toLocaleDateString()
                                                    : ""}
                                            </span>

                                        </div>

                                        <p>
                                            {review.text}
                                        </p>

                                    </div>

                                </article>

                            ))

                        )}

                    </div>

                </section>

            </main>

        </div>
    );
}

export default Song;