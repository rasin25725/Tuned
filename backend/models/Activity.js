const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
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

        type: {
            type: String,
            enum: ["rating", "review", "like"],
            required: true
        },

        rating: {
            type: Number,
            min: 1,
            max: 5
        },

        review: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review"
        }
    },
    {
        timestamps: true
    }
);

// Feed queries
activitySchema.index({ createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });
// Cleanup / upsert lookups
activitySchema.index({ user: 1, song: 1, type: 1 });

const Activity = mongoose.model("Activity", activitySchema);

module.exports = Activity;