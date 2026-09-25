const DailyRoadmap = require('../models/DailyRoadmap');
const Note = require('../models/model.note'); // 👈 tomar asol path
const { generateRoadmapFromAI } = require('./aiService');

const CONCURRENCY = 5;               // ekshathe koto ta AI call (Gemini quota onujayi thik koro)
const POLL_INTERVAL_MS = 5000;       // job na thakle koto por por check
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 30 * 1000;   // fail hole 30s, 60s, 120s...
const STUCK_AFTER_MS = 10 * 60 * 1000; // 10 min processing e thakle stuck dhora hobe

let isRunning = false;

// ---------- 1. Atomic claim: ekta job ekbar-i ekjon worker pabe ----------
const claimJob = () => {
    return DailyRoadmap.findOneAndUpdate(
        {
            status: 'pending',
            attempts: { $lt: MAX_ATTEMPTS },
            nextRunAt: { $lte: new Date() }
        },
        {
            $set: { status: 'processing', lockedAt: new Date() },
            $inc: { attempts: 1 }
        },
        { sort: { nextRunAt: 1 }, returnDocument: 'after' }   // 👈 age chilo: new: true
    ).lean();
};


// ---------- 2. Stuck job recovery ----------
const recoverStuckJobs = async () => {
    const threshold = new Date(Date.now() - STUCK_AFTER_MS);

    // attempts sesh hoye gele failed
    await DailyRoadmap.updateMany(
        { status: 'processing', lockedAt: { $lt: threshold }, attempts: { $gte: MAX_ATTEMPTS } },
        { $set: { status: 'failed', lockedAt: null, lastError: 'Stuck: max attempts reached' } }
    );

    // baki gulo abar pending
    const res = await DailyRoadmap.updateMany(
        { status: 'processing', lockedAt: { $lt: threshold } },
        { $set: { status: 'pending', lockedAt: null, nextRunAt: new Date() } }
    );

    if (res.modifiedCount > 0) {
        console.log(`♻️ Recovered ${res.modifiedCount} stuck roadmap job(s)`);
    }
};

// ---------- 3. Fail hole retry (backoff) ba failed ----------
const markFailedOrRetry = async (job, message) => {
    if (job.attempts >= MAX_ATTEMPTS) {
        await DailyRoadmap.findByIdAndUpdate(job._id, {
            status: 'failed', lockedAt: null, lastError: message
        });
        console.error(`💀 Roadmap ${job._id} permanently failed: ${message}`);
    } else {
        const delay = BASE_BACKOFF_MS * Math.pow(2, job.attempts - 1);
        await DailyRoadmap.findByIdAndUpdate(job._id, {
            status: 'pending',
            lockedAt: null,
            nextRunAt: new Date(Date.now() + delay),
            lastError: message
        });
        console.warn(`🔁 Roadmap ${job._id} retry in ${delay / 1000}s (attempt ${job.attempts}/${MAX_ATTEMPTS})`);
    }
};

// ---------- 4. Ekta job process kora ----------
const processJob = async (job) => {
    try {
        const notes = await Note.find({
            userId: job.userId,
            status: 'completed',
            createdAt: { $gte: job.periodStart, $lte: job.periodEnd }
        }).lean();

        if (notes.length === 0) {
            await DailyRoadmap.deleteOne({ _id: job._id });
            return;
        }

        const sessionItems = notes.map(n => ({ sessionId: n._id, title: n.title }));
        const count = notes.length;
        const countText = `Built from ${count} recording${count > 1 ? 's' : ''}, refreshes every midnight`;

        const combinedText = notes.map((n, i) =>
            `Recording ${i + 1}: Title: ${n.title}\nSummary: ${n.summary}\nTranscription: ${n.transcription}`
        ).join('\n\n---\n\n');

        const aiResult = await generateRoadmapFromAI(combinedText);

        if (!aiResult) {
            return markFailedOrRetry(job, 'AI returned no result');
        }

        await DailyRoadmap.findByIdAndUpdate(job._id, {
            recordingCountText: countText,
            titleAvatar: aiResult.titleAvatar || 'AI',
            mainTitle: aiResult.mainTitle,
            summary: aiResult.summary,
            roadmapItem1: aiResult.roadmapItem1,
            roadmapItem2: aiResult.roadmapItem2,
            roadmapItem3: aiResult.roadmapItem3,
            sessionItems,
            status: 'completed',
            lockedAt: null,
            lastError: ''
        });

        console.log(`✅ Roadmap generated for job ${job._id}`);

    } catch (err) {
        console.error(`❌ Worker error for job ${job._id}:`, err.message);
        await markFailedOrRetry(job, err.message);
    }
};

// ---------- 5. Main loop ----------
const processRoadmapQueue = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
        await recoverStuckJobs();

        // job thakte thakte batch e batch e cholte thakbe
        while (true) {
            const jobs = [];
            for (let i = 0; i < CONCURRENCY; i++) {
                const job = await claimJob();
                if (!job) break;
                jobs.push(job);
            }

            if (jobs.length === 0) break;

            await Promise.allSettled(jobs.map(processJob));
        }
    } catch (error) {
        console.error('❌ Roadmap Queue Loop Error:', error);
    } finally {
        isRunning = false;
    }
};

const startRoadmapWorker = () => {
    console.log('⚙️ MongoDB Native Roadmap Worker Started...');
    processRoadmapQueue();
    setInterval(processRoadmapQueue, POLL_INTERVAL_MS);
};

module.exports = { startRoadmapWorker };