const cron = require('node-cron');
const Note = require('../models/model.note'); // 👈 tomar asol path
const DailyRoadmap = require('../models/DailyRoadmap');

const CHUNK_SIZE = 1000;

const initDailyRoadmapCron = () => {
    cron.schedule('1 0 * * *', async () => {
        console.log('🚀 Running Midnight AI Roadmap Producer Cron Job...');

        try {
            const periodStart = new Date();
            periodStart.setDate(periodStart.getDate() - 1);
            periodStart.setHours(0, 0, 0, 0);

            const periodEnd = new Date(periodStart);
            periodEnd.setHours(23, 59, 59, 999);

            const formattedDateStr = periodStart.toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric'
            });

            const activeUserIds = await Note.distinct('userId', {
                status: 'completed',
                createdAt: { $gte: periodStart, $lte: periodEnd }
            });

            console.log(`Found ${activeUserIds.length} active users with notes yesterday.`);

            for (let i = 0; i < activeUserIds.length; i += CHUNK_SIZE) {
                const chunk = activeUserIds.slice(i, i + CHUNK_SIZE);

                const operations = chunk.map(userId => ({
                    updateOne: {
                        filter: { userId, formattedDate: formattedDateStr },
                        update: {
                            $setOnInsert: {
                                status: 'pending',
                                attempts: 0,
                                nextRunAt: new Date(),
                                periodStart,
                                periodEnd
                            }
                        },
                        upsert: true
                    }
                }));

                await DailyRoadmap.bulkWrite(operations, { ordered: false });
            }

            console.log('✅ All pending roadmap tasks queued into MongoDB!');

        } catch (error) {
            console.error('❌ Critical Error in Roadmap Cron Job:', error);
        }
    }, { timezone: 'Asia/Dhaka' });
};

module.exports = initDailyRoadmapCron;