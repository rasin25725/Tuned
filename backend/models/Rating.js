const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
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
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            validate: {
                validator: Number.isInteger,
                message: "Rating must be a whole number"
            }
        }
    },
    {
        timestamps: true
    }
);

// One user can rate a particular song only once
ratingSchema.index(
    { user: 1, song: 1 },
    { unique: true }
);

// Fast lookups / aggregation by song
ratingSchema.index({ song: 1 });

const Rating = mongoose.model("Rating", ratingSchema);

module.exports = Rating;