const mongoose = require('mongoose');

const dailyRoadmapSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    formattedDate: { type: String, required: true },

    recordingCountText: { type: String, default: 'Built from 0 recordings, refreshes every midnight' },
    titleAvatar: { type: String, default: 'AI' },

    // pending obosthay faka thake, tai required na
    mainTitle: { type: String, default: '' },
    summary: { type: String, default: '' },
    roadmapItem1: { type: String, default: '' },
    roadmapItem2: { type: String, default: '' },
    roadmapItem3: { type: String, default: '' },

    sessionItems: [{
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
        title: { type: String, required: true }
    }],

    // ===== Queue fields =====
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    attempts: { type: Number, default: 0 },
    lockedAt: { type: Date, default: null },      // kokhon worker dhorse (stuck recovery er jonno)
    nextRunAt: { type: Date, default: Date.now }, // backoff: er age job dhora jabe na
    lastError: { type: String, default: '' },
    periodStart: { type: Date },                  // cron e save kora "gotokal" er shuru
    periodEnd: { type: Date }                     // cron e save kora "gotokal" er shesh

}, { timestamps: true });

dailyRoadmapSchema.index({ userId: 1, formattedDate: 1 }, { unique: true });
dailyRoadmapSchema.index({ status: 1, nextRunAt: 1 });   // worker er claim query fast korbe
dailyRoadmapSchema.index({ status: 1, lockedAt: 1 });    // stuck recovery query

module.exports = mongoose.model('DailyRoadmap', dailyRoadmapSchema);