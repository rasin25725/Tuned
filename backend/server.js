require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const Song = require("./models/Song");
const User = require("./models/User");
const Rating = require("./models/Rating");
const Reviews = require("./models/Reviews");
const Like = require("./models/Like");
const Activity = require("./models/Activity");

const authMiddleware = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");


// =============================
// STARTUP CHECKS
// =============================

const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET", "YOUTUBE_API_KEY"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
    console.error("Missing required environment variables:", missingEnv.join(", "));
    process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
    console.warn("WARNING: JWT_SECRET is short. Use a random string of 32+ characters.");
}

const PORT = process.env.PORT || 5000;
const BCRYPT_ROUNDS = 12;

// Used to keep login timing the same whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync("songshare-dummy-password", BCRYPT_ROUNDS);


// =============================
// APP SETUP
// =============================

const app = express();

app.set("trust proxy", 1);

// If deployed behind a proxy (Nginx, Render, Railway, Heroku...), uncomment
// so rate limiting sees the real client IP:
// app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = (
    process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000"
)
    .split(",")
    .map((origin) => origin.trim());

app.use(
    cors({
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

app.use(express.json({ limit: "10kb" }));

// Express 5 leaves req.body undefined when a request has no JSON body,
// which would crash every "const { x } = req.body" with a 500
app.use((req, res, next) => {
    if (req.body === undefined) {
        req.body = {};
    }
    next();
});


// =============================
// RATE LIMITERS
// =============================

const makeLimiter = (windowMs, max, message) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message }
    });

const globalLimiter = makeLimiter(15 * 60 * 1000, 500, "Too many requests, please try again later");
const authLimiter = makeLimiter(15 * 60 * 1000, 20, "Too many attempts, please try again later");
const writeLimiter = makeLimiter(60 * 1000, 60, "Too many requests, slow down");
const youtubeLimiter = makeLimiter(60 * 1000, 20, "Too many searches, slow down");

app.use(globalLimiter);

// Limit every non-GET request under /api
app.use("/api", (req, res, next) => {
    if (req.method === "GET") {
        return next();
    }
    return writeLimiter(req, res, next);
});


// =============================
// HELPERS
// =============================

// Forwards async errors to the error handler at the bottom
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const isObjectId = (value) =>
    typeof value === "string" && OBJECT_ID_RE.test(value);

const isHttpsUrl = (value) => {
    if (typeof value !== "string" || value.length > 500) {
        return false;
    }
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
};

// Rejects invalid ObjectIds in route params with a clean 400
const validateObjectId = (...params) => (req, res, next) => {
    for (const param of params) {
        if (!isObjectId(req.params[param])) {
            return res.status(400).json({
                message: `Invalid ${param}`
            });
        }
    }
    next();
};

const getPagination = (req, defaultLimit = 20, maxLimit = 100) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1),
        maxLimit
    );
    return { limit, skip: (page - 1) * limit };
};

const normalizeEmail = (email) => {
    if (typeof email !== "string") {
        return null;
    }
    const cleaned = email.trim().toLowerCase();
    return cleaned.length > 0 && cleaned.length <= 254 ? cleaned : null;
};

const songExists = async (songId) => {
    return !!(await Song.exists({ _id: songId }));
};

const decodeHtml = (text) =>
    text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");


// =============================
// HOME
// =============================

app.get("/", (req, res) => {
    res.send("SongShare Backend is running");
});


// =============================
// SONG ROUTES
// =============================

// GET all songs (paginated: ?page=1&limit=20)
app.get(
    "/api/songs",
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 20, 100);

        const songs = await Song.find()
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit);

        res.json(songs);
    })
);


// GET one song
app.get(
    "/api/songs/:id",
    validateObjectId("id"),
    asyncHandler(async (req, res) => {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({
                message: "Song not found"
            });
        }

        res.json(song);
    })
);


// POST a new song (any logged-in user; idempotent per YouTube video)
app.post(
    "/api/songs",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { youtubeVideoId, title, artist, thumbnail } = req.body;

        if (typeof youtubeVideoId !== "string" || !YT_ID_RE.test(youtubeVideoId)) {
            return res.status(400).json({
                message: "Valid youtubeVideoId is required"
            });
        }

        if (typeof title !== "string" || !title.trim() || title.length > 300) {
            return res.status(400).json({
                message: "Title is required (max 300 characters)"
            });
        }

        if (
            artist !== undefined &&
            (typeof artist !== "string" || artist.length > 200)
        ) {
            return res.status(400).json({
                message: "Artist must be a string (max 200 characters)"
            });
        }

        if (!isHttpsUrl(thumbnail)) {
            return res.status(400).json({
                message: "Thumbnail must be a valid https URL"
            });
        }

        // Same video already saved -> return it instead of creating a duplicate
        const existing = await Song.findOne({ youtubeVideoId });

        if (existing) {
            return res.json(existing);
        }

        try {
            const savedSong = await Song.create({
                youtubeVideoId,
                title,
                artist,
                thumbnail
            });

            return res.status(201).json(savedSong);
        } catch (error) {
            // Two users saved the same video at the same moment
            if (error.code === 11000) {
                const winner = await Song.findOne({ youtubeVideoId });
                return res.json(winner);
            }
            throw error;
        }
    })
);


// UPDATE a song (admin only)
app.put(
    "/api/songs/:id",
    authMiddleware,
    roleMiddleware("admin"),
    validateObjectId("id"),
    asyncHandler(async (req, res) => {
        const updates = {};

        for (const field of ["youtubeVideoId", "title", "artist", "thumbnail"]) {
            if (req.body[field] !== undefined) {
                if (typeof req.body[field] !== "string") {
                    return res.status(400).json({
                        message: `${field} must be a string`
                    });
                }
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: "Nothing to update"
            });
        }

        const updatedSong = await Song.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedSong) {
            return res.status(404).json({
                message: "Song not found"
            });
        }

        res.json(updatedSong);
    })
);


// DELETE a song (admin only) + remove everything attached to it
app.delete(
    "/api/songs/:id",
    authMiddleware,
    roleMiddleware("admin"),
    validateObjectId("id"),
    asyncHandler(async (req, res) => {
        const deletedSong = await Song.findByIdAndDelete(req.params.id);

        if (!deletedSong) {
            return res.status(404).json({
                message: "Song not found"
            });
        }

        await Promise.all([
            Rating.deleteMany({ song: deletedSong._id }),
            Reviews.deleteMany({ song: deletedSong._id }),
            Like.deleteMany({ song: deletedSong._id }),
            Activity.deleteMany({ song: deletedSong._id })
        ]);

        res.json({
            message: "Song deleted",
            song: deletedSong
        });
    })
);


// =============================
// YOUTUBE SEARCH
// =============================

// Small in-memory cache: YouTube search costs 100 quota units per call
// (default daily quota is 10,000 -> only ~100 uncached searches per day)
const ytCache = new Map();
const YT_CACHE_TTL = 10 * 60 * 1000;
const YT_CACHE_MAX = 200;

// Max song length we accept (5 minutes)
const MAX_DURATION_SECONDS = 5 * 60;

// "PT3M32S" -> 212. Returns null if the string doesn't parse.
function parseIsoDuration(iso) {
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
    if (!match) return null;

    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);

    return hours * 3600 + minutes * 60 + seconds;
}

// Strips "(Official Video)", "[Lyrics]", "official audio", punctuation, etc.
// so that different uploads of the same song collapse to the same key.
// Heuristic, not exact - occasional over/under-merge is expected and fine here.
function normalizeTitle(title) {
    return (title || "")
        .toLowerCase()
        .replace(/[([][^)\]]*[)\]]/g, " ") // (...) and [...]
        .replace(
            /\b(official\s*(music\s*)?video|official\s*audio|lyrics?\s*video|audio|visualizer|explicit|clean|remaster(ed)?|hd|4k)\b/g,
            " "
        )
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

app.get(
    "/api/youtube/search",
    authMiddleware,
    youtubeLimiter,
    asyncHandler(async (req, res) => {
        const query =
            typeof req.query.q === "string" ? req.query.q.trim() : "";

        if (!query) {
            return res.status(400).json({
                message: "Search query is required"
            });
        }

        if (query.length > 100) {
            return res.status(400).json({
                message: "Search query too long (max 100 characters)"
            });
        }

        const cacheKey = query.toLowerCase();
        const cached = ytCache.get(cacheKey);

        if (cached && Date.now() - cached.time < YT_CACHE_TTL) {
            return res.json(cached.data);
        }

        let response;

        try {
            response = await axios.get(
                "https://www.googleapis.com/youtube/v3/search",
                {
                    timeout: 8000,
                    params: {
                        part: "snippet",
                        q: query,
                        type: "video",
                        videoEmbeddable: "true",
                        maxResults: 10,
                        key: process.env.YOUTUBE_API_KEY
                    }
                }
            );
        } catch (error) {
            // Log only the message - the full axios error contains the API key
            console.error(
                "YouTube API error:",
                error.response?.data?.error?.message || error.message
            );

            return res.status(502).json({
                message: "YouTube search is unavailable right now"
            });
        }

        const rawResults = (response.data.items || [])
            .filter((item) => item.id && item.id.videoId && item.snippet)
            .map((item) => ({
                youtubeVideoId: item.id.videoId,
                title: decodeHtml(item.snippet.title || ""),
                channel: decodeHtml(item.snippet.channelTitle || ""),
                thumbnail:
                    item.snippet.thumbnails?.high?.url ||
                    item.snippet.thumbnails?.medium?.url ||
                    item.snippet.thumbnails?.default?.url ||
                    ""
            }));

        let songs = rawResults;

        if (rawResults.length) {
            try {
                const statsResponse = await axios.get(
                    "https://www.googleapis.com/youtube/v3/videos",
                    {
                        timeout: 8000,
                        params: {
                            part: "contentDetails,statistics",
                            id: rawResults
                                .map((r) => r.youtubeVideoId)
                                .join(","),
                            key: process.env.YOUTUBE_API_KEY
                        }
                    }
                );

                const statsById = new Map(
                    (statsResponse.data.items || []).map((v) => [
                        v.id,
                        {
                            duration: parseIsoDuration(
                                v.contentDetails?.duration
                            ),
                            views: parseInt(
                                v.statistics?.viewCount || "0",
                                10
                            )
                        }
                    ])
                );

                // Attach stats, drop anything missing/unembeddable/too long
                const enriched = rawResults
                    .map((r) => ({
                        ...r,
                        ...(statsById.get(r.youtubeVideoId) || {
                            duration: null,
                            views: 0
                        })
                    }))
                    .filter(
                        (r) =>
                            r.duration !== null &&
                            r.duration <= MAX_DURATION_SECONDS
                    );

                // Collapse same-song duplicates, keeping the highest view count
                // and the earliest position among the group
                const dedupedByKey = new Map();
                for (const item of enriched) {
                    const key =
                        normalizeTitle(item.title) || item.youtubeVideoId;
                    const existing = dedupedByKey.get(key);
                    if (!existing || item.views > existing.views) {
                        dedupedByKey.set(key, item);
                    }
                }

                // Preserve original relevance order
                const kept = new Set(
                    [...dedupedByKey.values()].map((v) => v.youtubeVideoId)
                );
                songs = enriched
                    .filter((r) => kept.has(r.youtubeVideoId))
                    .filter(
                        (r, i, arr) =>
                            arr.findIndex(
                                (x) => x.youtubeVideoId === r.youtubeVideoId
                            ) === i
                    )
                    .map(({ youtubeVideoId, title, channel, thumbnail }) => ({
                        youtubeVideoId,
                        title,
                        channel,
                        thumbnail
                    }));
            } catch (error) {
                // Quota for search.list is already spent - degrade to
                // unfiltered results instead of failing the whole search
                console.error(
                    "YouTube videos.list error:",
                    error.response?.data?.error?.message || error.message
                );
                songs = rawResults;
            }
        }

        if (ytCache.size >= YT_CACHE_MAX) {
            ytCache.delete(ytCache.keys().next().value);
        }
        ytCache.set(cacheKey, { time: Date.now(), data: songs });

        res.json(songs);
    })
);


// =============================
// AUTHENTICATION
// =============================

// REGISTER
app.post(
    "/api/register",
    authLimiter,
    asyncHandler(async (req, res) => {
        const { name, password } = req.body;
        const email = normalizeEmail(req.body.email);

        if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
            return res.status(400).json({
                message: "Name is required (max 50 characters)"
            });
        }

        if (!email || !EMAIL_RE.test(email)) {
            return res.status(400).json({
                message: "A valid email is required"
            });
        }

        // bcrypt only uses the first 72 bytes, so cap the length
        if (
            typeof password !== "string" ||
            password.length < 8 ||
            password.length > 72
        ) {
            return res.status(400).json({
                message: "Password must be 8-72 characters"
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        let savedUser;

        try {
            savedUser = await User.create({
                name: name.trim(),
                email,
                password: hashedPassword
            });
        } catch (error) {
            // Unique index caught a simultaneous registration
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "Email already registered"
                });
            }
            throw error;
        }

        res.status(201).json({
            message: "Registration successful",
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email,
                role: savedUser.role
            }
        });
    })
);


// LOGIN
app.post(
    "/api/login",
    authLimiter,
    asyncHandler(async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;

        if (!email || typeof password !== "string" || !password || password.length > 128) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({ email }).select("+password");

        // Always run bcrypt so response time doesn't reveal if the email exists
        const passwordMatch = await bcrypt.compare(
            password,
            user ? user.password : DUMMY_HASH
        );

        if (!user || !passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: "1h"
            }
        );

        res.json({
            message: "Login successful",
            token: token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role
            }
        });
    })
);


// PROFILE
app.get(
    "/api/profile",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.userId).select(
            "name email role createdAt"
        );

        if (!user) {
            return res.status(401).json({
                message: "User no longer exists"
            });
        }

        res.json({
            message: "You are authenticated",
            user: user
        });
    })
);


// =============================
// RATING ROUTES
// =============================

// ADD OR UPDATE rating
app.post(
    "/api/ratings",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { song } = req.body;

        // Accept 4 or "4", reject 3.5, "abc", null, true, arrays...
        const rating =
            typeof req.body.rating === "string" && req.body.rating.trim() !== ""
                ? Number(req.body.rating)
                : req.body.rating;

        if (!isObjectId(song)) {
            return res.status(400).json({
                message: "A valid song id is required"
            });
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({
                message: "Rating must be a whole number between 1 and 5"
            });
        }

        if (!(await songExists(song))) {
            return res.status(404).json({
                message: "Song not found"
            });
        }

        const alreadyRated = !!(await Rating.exists({
            user: req.user.userId,
            song: song
        }));

        // Atomic upsert - no race between "check" and "save"
        const savedRating = await Rating.findOneAndUpdate(
            { user: req.user.userId, song: song },
            { $set: { rating: rating } },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        await Activity.findOneAndUpdate(
            { user: req.user.userId, song: song, type: "rating" },
            { $set: { rating: rating } },
            { upsert: true, new: true }
        );

        res.status(alreadyRated ? 200 : 201).json({
            message: alreadyRated ? "Rating updated" : "Rating added",
            rating: savedRating
        });
    })
);


// GET all ratings for a song
app.get(
    "/api/ratings/song/:songId",
    validateObjectId("songId"),
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 50, 100);

        const ratings = await Rating.find({ song: req.params.songId })
            .populate("user", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(ratings);
    })
);


// GET average rating
app.get(
    "/api/ratings/song/:songId/average",
    validateObjectId("songId"),
    asyncHandler(async (req, res) => {
        const result = await Rating.aggregate([
            {
                $match: {
                    song: new mongoose.Types.ObjectId(req.params.songId)
                }
            },
            {
                $group: {
                    _id: "$song",
                    averageRating: { $avg: "$rating" },
                    totalRatings: { $sum: 1 }
                }
            }
        ]);

        if (result.length === 0) {
            return res.json({
                averageRating: 0,
                totalRatings: 0
            });
        }

        res.json({
            averageRating: Number(result[0].averageRating.toFixed(1)),
            totalRatings: result[0].totalRatings
        });
    })
);


// GET my ratings
app.get(
    "/api/ratings/my",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 50, 100);

        const ratings = await Rating.find({ user: req.user.userId })
            .populate("song", "title thumbnail youtubeVideoId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(ratings);
    })
);


// DELETE my rating
app.delete(
    "/api/ratings/:id",
    authMiddleware,
    validateObjectId("id"),
    asyncHandler(async (req, res) => {
        const rating = await Rating.findById(req.params.id);

        if (!rating) {
            return res.status(404).json({
                message: "Rating not found"
            });
        }

        if (rating.user.toString() !== req.user.userId) {
            return res.status(403).json({
                message: "You can only delete your own rating"
            });
        }

        await Rating.findByIdAndDelete(req.params.id);

        await Activity.findOneAndDelete({
            user: req.user.userId,
            song: rating.song,
            type: "rating"
        });

        res.json({
            message: "Rating deleted"
        });
    })
);


// =============================
// REVIEW ROUTES
// =============================

const MAX_REVIEW_LENGTH = 2000;

const validateReviewText = (text) => {
    if (typeof text !== "string" || text.trim() === "") {
        return "Review cannot be empty";
    }
    if (text.trim().length > MAX_REVIEW_LENGTH) {
        return `Review cannot exceed ${MAX_REVIEW_LENGTH} characters`;
    }
    return null;
};


// ADD review
app.post(
    "/api/reviews",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { song, text } = req.body;

        if (!isObjectId(song)) {
            return res.status(400).json({
                message: "A valid song id is required"
            });
        }

        const textError = validateReviewText(text);

        if (textError) {
            return res.status(400).json({
                message: textError
            });
        }

        if (!(await songExists(song))) {
            return res.status(404).json({
                message: "Song not found"
            });
        }

        const savedReview = await Reviews.create({
            user: req.user.userId,
            song: song,
            text: text
        });

        await Activity.create({
            user: req.user.userId,
            song: song,
            type: "review",
            review: savedReview._id
        });

        res.status(201).json({
            message: "Review added",
            review: savedReview
        });
    })
);


// GET reviews for a song
app.get(
    "/api/reviews/song/:songId",
    validateObjectId("songId"),
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 20, 100);

        const reviews = await Reviews.find({ song: req.params.songId })
            .populate("user", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(reviews);
    })
);


// GET my reviews
app.get(
    "/api/reviews/my",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 20, 100);

        const reviews = await Reviews.find({ user: req.user.userId })
            .populate("song", "title thumbnail youtubeVideoId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(reviews);
    })
);


// UPDATE my review
app.put(
    "/api/reviews/:id",
    authMiddleware,
    validateObjectId("id"),
    asyncHandler(async (req, res) => {
        const { text } = req.body;

        const review = await Reviews.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                message: "Review not found"
            });
        }

        if (review.user.toString() !== req.user.userId) {
            return res.status(403).json({
                message: "You can only edit your own review"
            });
        }

        const textError = validateReviewText(text);

        if (textError) {
            return res.status(400).json({
                message: textError
            });
        }

        review.text = text;

        const updatedReview = await review.save();

        res.json({
            message: "Review updated",
            review: updatedReview
        });
    })
);


// DELETE my review
app.delete(
    "/api/reviews/:id",
    authMiddleware,
    validateObjectId("id"),
    asyncHandler(async (req, res) => {
        const review = await Reviews.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                message: "Review not found"
            });
        }

        if (review.user.toString() !== req.user.userId) {
            return res.status(403).json({
                message: "You can only delete your own review"
            });
        }

        await Reviews.findByIdAndDelete(req.params.id);

        await Activity.findOneAndDelete({
            user: req.user.userId,
            song: review.song,
            type: "review",
            review: review._id
        });

        res.json({
            message: "Review deleted"
        });
    })
);


// =============================
// LIKE ROUTES
// =============================

// LIKE a song
app.post(
    "/api/likes/:songId",
    authMiddleware,
    validateObjectId("songId"),
    asyncHandler(async (req, res) => {
        const songId = req.params.songId;

        if (!(await songExists(songId))) {
            return res.status(404).json({
                message: "Song not found"
            });
        }

        let savedLike;

        try {
            // Unique index (user + song) is the real guard against duplicates
            savedLike = await Like.create({
                user: req.user.userId,
                song: songId
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "Song already liked"
                });
            }
            throw error;
        }

        await Activity.create({
            user: req.user.userId,
            song: songId,
            type: "like"
        });

        const likeCount = await Like.countDocuments({
            song: songId
        });

        res.status(201).json({
            message: "Song liked",
            like: savedLike,
            likes: likeCount
        });
    })
);


// GET MY LIKES
app.get(
    "/api/likes/my",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 50, 100);

        const likes = await Like.find({ user: req.user.userId })
            .populate("song", "title thumbnail youtubeVideoId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(likes);
    })
);


// CHECK LIKE
app.get(
    "/api/likes/:songId/check",
    authMiddleware,
    validateObjectId("songId"),
    asyncHandler(async (req, res) => {
        const like = await Like.exists({
            user: req.user.userId,
            song: req.params.songId
        });

        res.json({
            liked: !!like
        });
    })
);


// GET LIKE COUNT
app.get(
    "/api/likes/:songId/count",
    validateObjectId("songId"),
    asyncHandler(async (req, res) => {
        const count = await Like.countDocuments({
            song: req.params.songId
        });

        res.json({
            likes: count
        });
    })
);


// REMOVE LIKE
app.delete(
    "/api/likes/:songId",
    authMiddleware,
    validateObjectId("songId"),
    asyncHandler(async (req, res) => {
        const deletedLike = await Like.findOneAndDelete({
            user: req.user.userId,
            song: req.params.songId
        });

        if (!deletedLike) {
            return res.status(404).json({
                message: "Like not found"
            });
        }

        await Activity.findOneAndDelete({
            user: req.user.userId,
            song: req.params.songId,
            type: "like"
        });

        const likeCount = await Like.countDocuments({
            song: req.params.songId
        });

        res.json({
            message: "Like removed",
            likes: likeCount
        });
    })
);


// =============================
// ACTIVITY / FEED
// =============================

// GET activity feed
app.get(
    "/api/feed",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 50, 50);

        const activities = await Activity.find()
            .populate("user", "name")
            .populate("song", "title thumbnail youtubeVideoId")
            .populate("review", "text")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(activities);
    })
);


// GET my activity
app.get(
    "/api/feed/my",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 50, 50);

        const activities = await Activity.find({ user: req.user.userId })
            .populate("song", "title thumbnail youtubeVideoId")
            .populate("review", "text")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(activities);
    })
);


// =============================
// ADMIN DASHBOARD APIs
// =============================

app.get(
    "/api/admin/stats",
    authMiddleware,
    roleMiddleware("admin"),
    asyncHandler(async (req, res) => {
        const [
            users,
            songs,
            ratings,
            reviews,
            likes
        ] = await Promise.all([
            User.countDocuments(),
            Song.countDocuments(),
            Rating.countDocuments(),
            Reviews.countDocuments(),
            Like.countDocuments()
        ]);

        res.json({
            users,
            songs,
            ratings,
            reviews,
            likes
        });
    })
);

app.get(
    "/api/admin/users",
    authMiddleware,
    roleMiddleware("admin"),
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 50, 100);

        const users = await User.find()
            .select("name email role createdAt")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(users);
    })
);

app.get(
    "/api/admin/songs",
    authMiddleware,
    roleMiddleware("admin"),
    asyncHandler(async (req, res) => {
        const { limit, skip } = getPagination(req, 50, 100);

        const songs = await Song.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(songs);
    })
);

// =============================
// ADMIN
// =============================

app.get(
    "/api/admin",
    authMiddleware,
    roleMiddleware("admin"),
    (req, res) => {
        res.json({
            message: "Welcome Admin"
        });
    }
);




// =============================
// 404 + ERROR HANDLING
// =============================

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

// Centralised error handler - never leaks internal error details to clients
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON body" });
    }

    if (err.type === "entity.too.large") {
        return res.status(413).json({ message: "Request body too large" });
    }

    if (err.name === "CastError") {
        return res.status(400).json({ message: "Invalid ID or value" });
    }

    if (err.name === "ValidationError") {
        return res.status(400).json({
            message: Object.values(err.errors)
                .map((e) => e.message)
                .join(", ")
        });
    }

    if (err.code === 11000) {
        return res.status(409).json({ message: "Duplicate entry" });
    }

    console.error(err);

    res.status(500).json({
        message: "Internal server error"
    });
});


// =============================
// MONGODB CONNECTION
// =============================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    });