const mongoose = require("mongoose");

const songSchema = new mongoose.Schema(
    {
        youtubeVideoId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: /^[A-Za-z0-9_-]{11}$/
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300
        },

        artist: {
            type: String,
            trim: true,
            maxlength: 200
        },

        // https only - blocks javascript: / data: URLs from reaching the frontend
        thumbnail: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
            match: /^https:\/\//
        }
    },
    {
        timestamps: true
    }
);

const Song = mongoose.model("Song", songSchema);

module.exports = Song;