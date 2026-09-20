const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        song: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Song",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// One like per user per song
likeSchema.index(
    { user: 1, song: 1 },
    { unique: true }
);

// Fast like counts per song
likeSchema.index({ song: 1 });

const Like = mongoose.model("Like", likeSchema);

module.exports = Like;