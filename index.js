require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const authRouter = require("./routers/authRoutes");
const uploadRouter = require("./routers/noteRoutes");
const dashRouter = require("./routers/dashRoutes");
const initDailyRoadmapCron = require("./services/cronService");
const { startRoadmapWorker } = require("./services/roadmapWorker");



const app = express();
app.use(express.json());


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((error) => console.error("Error connecting to MongoDB:", error));




app.use("/api/auth", authRouter);
app.use("/api/audio", uploadRouter);
app.use("/api/audio/dash", dashRouter);



initDailyRoadmapCron();

startRoadmapWorker();



app.use((err, req, res, next) => {
    if (err) {
        console.error(err.stack);
        res.status(500).json({ message: "Internal server error" });
    }
});




// Start the server
app.listen(process.env.PORT, () => {
    console.log("Server started on http://localhost:" + process.env.PORT);
});