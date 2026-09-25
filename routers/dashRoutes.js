const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getDashboardStats, getYesterdayRoadmap } = require("../controllers/dashController");


// GET /api/audio/dashboard-stats
router.get("/dashboard-stats", authMiddleware, getDashboardStats);
router.get("/dashboard-roadmap", authMiddleware, getYesterdayRoadmap);


module.exports = router;