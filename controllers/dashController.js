const mongoose = require('mongoose');
const Note = require("../models/model.note");
const DailyRoadmap = require('../models/DailyRoadmap');


exports.getDashboardStats = async (req, res) => {
    try {
       
        const userId = req.user.id;

        
        const now = new Date();
        const startOfWeek = new Date();
        startOfWeek.setDate(now.getDate() - 7);
        startOfWeek.setHours(0, 0, 0, 0);

       
        const stats = await Note.aggregate([
            {
                $match: { userId: new mongoose.Types.ObjectId(userId) }
            },
            {
                $facet: {
                
                    weeklyStats: [
                        {
                            $match: { createdAt: { $gte: startOfWeek } }
                        },
                        {
                            $group: {
                                _id: null,
                                weeklySessionCount: { $sum: 1 },
                                weeklyTotalDuration: { $sum: "$duration" }
                            }
                        }
                    ],
                   
                    totalStats: [
                        {
                            $group: {
                                _id: null,
                                totalRecordings: { $sum: 1 },
                                totalDuration: { $sum: "$duration" },
                                totalSummaries: {
                                    $sum: {
                                        $cond: [
                                            { 
                                                $and: [
                                                    { $ne: ["$summary", ""] }, 
                                                    { $ne: ["$summary", null] }
                                                ] 
                                            }, 
                                            1, 
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        ]);

       
        const weekly = stats[0].weeklyStats[0] || { weeklySessionCount: 0, weeklyTotalDuration: 0 };
        const total = stats[0].totalStats[0] || { totalRecordings: 0, totalDuration: 0, totalSummaries: 0 };

        return res.status(200).json({
            success: true,
            data: {
                weekly: {
                    sessionCount: weekly.weeklySessionCount,
                    totalDuration: weekly.weeklyTotalDuration 
                },
                overall: {
                    totalRecordings: total.totalRecordings,
                    totalDuration: total.totalDuration, 
                    totalSummaries: total.totalSummaries
                }
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error fetching dashboard statistics" 
        });
    }
};













exports.getYesterdayRoadmap = async (req, res) => {
    try {
        const userId = req.user.id;


        const roadmapData = await DailyRoadmap.findOne({
            userId: userId,
            status: "completed"
        }).sort({ createdAt: -1 });


        if (!roadmapData) {
            return res.status(200).json({
                success: true,
                hasData: false,
                message: "No daily roadmap available."
            });
        }


        return res.status(200).json({
            success: true,
            hasData: true,
            data: {
                formattedDate: roadmapData.formattedDate,
                recordingCountText: roadmapData.recordingCountText,
                titleAvatar: roadmapData.titleAvatar,
                mainTitle: roadmapData.mainTitle,
                summary: roadmapData.summary,
                roadmapItem1: roadmapData.roadmapItem1,
                roadmapItem2: roadmapData.roadmapItem2,
                roadmapItem3: roadmapData.roadmapItem3,
                sessionItems: roadmapData.sessionItems
            }
        });

    } catch (error) {
        console.error("Error fetching yesterday's roadmap:", error);
        return res.status(500).json({ success: false, message: "Server error fetching yesterday's roadmap" });
    }
}


