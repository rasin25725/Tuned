const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
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

        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        }
    },
    {
        timestamps: true
    }
);

reviewSchema.index({ song: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

const Reviews = mongoose.model("Review", reviewSchema);

module.exports = Reviews;