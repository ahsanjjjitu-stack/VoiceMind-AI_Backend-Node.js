const ffmpeg = require("fluent-ffmpeg");
const ffprobeStatic = require('ffprobe-static');
const ffmpegInstaller = require('ffmpeg-static');
const path = require("path");
const fs = require('fs-extra');
const { GoogleGenAI } = require("@google/genai");
const FcmToken = require('../models/FcmToken');
const sendPushNotification = require('../utils/sendNotification');
const User = require('../models/model.user');


ffmpeg.setFfmpegPath(ffmpegInstaller);
ffmpeg.setFfprobePath(ffprobeStatic.path);


const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});





// audio chunk 

const splitAudioIntoChunks = (inputPath, outputDir, chunkDurationSec = 600) => {


    return new Promise((resolve, reject) => {

        ffmpeg.ffprobe(inputPath, (err, metadata) => {

            if (err) {
                reject(err);
            }




            const totalDuration = metadata.format.duration || 0;
            const chunkPaths = [];
            let currentStart = 0;
            let index = 0;





            const processNextchunk = () => {

                if (currentStart >= totalDuration && index > 0) {
                    return resolve(chunkPaths);
                }




                const outputPath = path.join(outputDir, `chunk_${index}.mp3`);



                ffmpeg(inputPath)
                    .setStartTime(currentStart)
                    .setDuration(chunkDurationSec)
                    .output(outputPath)
                    .on('end', () => {
                        chunkPaths.push(outputPath);
                        currentStart += chunkDurationSec;
                        index++;
                        processNextchunk();
                    })
                    .on('error', (ffmpegError) => {
                        reject(ffmpegError);
                    })
                    .run();

            };




            processNextchunk();


        });





    });



};






// retry wrapper - 503 (overloaded) o 429 (rate limit) er jonno exponential backoff diye retry kore
// eita just ai.models.generateContent() call ke wrap kore, kono existing logic change kore na

const generateContentWithRetry = async (params, maxRetries = 4, baseDelayMs = 1000) => {

    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {

        try {

            return await ai.models.generateContent(params);

        } catch (error) {

            lastError = error;

            const status = error?.status || error?.code;
            const isRetryable = status === 503 || status === 429 || status === 'UNAVAILABLE';

            if (isRetryable && attempt < maxRetries - 1) {

                const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s, 8s...
                console.warn(`Gemini model overloaded/rate-limited (status: ${status}). Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;

            }

            throw error;

        }

    }

    throw lastError;

};



















// processing with ai model 

const processAudioWithAI = async (filePath, noteId, NoteModel, audioUrl, userId) => {


    const tempDir = path.join(__dirname, `../temp_${noteId}`);



    try {



        await fs.ensureDir(tempDir);



        // 1. audio 10 min chunk device

        const chunkFiles = await splitAudioIntoChunks(filePath, tempDir);
        let fullTranscription = '';




        // 2. chunk to text speech 

        for (const chunkPath of chunkFiles) {

            const audioBuffer = await fs.readFile(chunkPath);


            const response = await generateContentWithRetry({
                model: 'gemini-3.6-flash',
                contents: [
                    {
                        inlineData: {
                            mimeType: 'audio/mp3',
                            data: audioBuffer.toString('base64')
                        }
                    },
                    `Transcribe this audio clip exactly as spoken, in the ORIGINAL language of the speaker.
        Rules:
        - Detect the language automatically and write the transcription in that same language and its native script (e.g. Bangla audio → Bangla script, Hindi audio → Devanagari, Arabic audio → Arabic script).
        - Do NOT translate to English or any other language.
        - If multiple languages are mixed, keep each part in the language it was spoken in.
        - Output only the transcribed text, with no extra comments, labels, or explanations.`
                ]
            });


            if (response.text) {

                fullTranscription += response.text + ' ';
            }


            await fs.remove(chunkPath);


        }









        // 3. generate summary 

        const summaryResponse = await generateContentWithRetry({
            model: 'gemini-3.6-flash',
            contents: `You are an expert AI note-taker. Process the transcript below and return JSON ONLY.

    IMPORTANT LANGUAGE RULE:
    - Detect the language of the transcript.
    - Write the "summary" and every item in "keyPoints" in the SAME language and script as the transcript.
    - Do NOT translate to English unless the transcript itself is in English.
    - Keep the JSON keys ("summary", "keyPoints") exactly in English.

    Transcript:
    """
    ${fullTranscription}
    """

    JSON format required:
    {
      "summary": "Detailed overall summary in paragraph format",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }`,
            config: { responseMimeType: 'application/json' }
        });










        // 4. get ai json response

        const clearJsonText = summaryResponse.text.replace(/```json|```/g, '').trim();
        const parsedResult = JSON.parse(clearJsonText);






        const durationInSeconds = await new Promise((resolve) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (!err && metadata && metadata.format && metadata.format.duration) {
                    resolve(Math.round(metadata.format.duration)); // সেকেন্ডে রাউন্ড করে ফেরত দেবে
                } else {
                    console.error("FFprobe error or duration missing:", err);
                    resolve(0); // এরর হলে ডিফল্ট ০ রিটার্ন করবে
                }
            });
        });






        // 5. MongoDB তে সেভ ও Status: completed আপডেট
        await NoteModel.findByIdAndUpdate(noteId, {
            audioUrl: audioUrl || '',
            transcription: fullTranscription.trim(),
            summary: parsedResult.summary || '',
            keyPoints: parsedResult.keyPoints || [],
            status: 'completed',
            duration: durationInSeconds,
        });








        // 🟢 6. Check User Notification Preference & send notification

        const user = await User.findById(userId).select('isNotificationEnabled');

        if (user && user.isNotificationEnabled) {
            const userFcm = await FcmToken.findOne({ userId });
            console.log("FCM TOKEN FOUND:", userFcm);

            if (userFcm && userFcm.token) {
                await sendPushNotification(
                    userFcm.token,
                    "Processing Complete 🎉",
                    "Your audio note processing is complete. Tap to view!",
                    { noteId: noteId.toString(), status: "completed" }
                );
            }
        } else {
            console.log(`Notification skipped for user ${userId} because preference is OFF.`);
        }









    }




    catch (error) {

        console.error(`Error processing note ${noteId}:`, error);

        // কোনো কারণে ব্যর্থ হলে DB-তে Status: failed করে দেওয়া
        await NoteModel.findByIdAndUpdate(noteId, { status: 'failed' });




        // 🔴 FCM Push Notification (Failed)
        try {


            const user = await User.findById(userId).select('isNotificationEnabled');

            if (user && user.isNotificationEnabled) {
                const userFcm = await FcmToken.findOne({ userId });
                if (userFcm && userFcm.token) {
                    await sendPushNotification(
                        userFcm.token,
                        "Processing Failed ❌",
                        "Sorry, we couldn't process your audio note. Please try again.",
                        { noteId: noteId.toString(), status: "failed" }
                    );
                }
            }


        } catch (fcmErr) {
            console.error("Error sending failure push notification:", fcmErr);
        }






    } finally {
        // অস্থায়ী ফোল্ডার ও মূল ফাইল ক্লিনআপ করা
        await fs.remove(tempDir).catch(() => { });
        await fs.remove(filePath).catch(() => { });
    }





};



module.exports = { processAudioWithAI };