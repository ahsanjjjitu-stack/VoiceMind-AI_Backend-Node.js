const { GoogleGenAI, Type } = require("@google/genai");


const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});




// retry wrapper - 503 (overloaded) o 429 (rate limit) er jonno exponential backoff diye retry kore
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

















const generateRoadmapFromAI = async (combinedText) => {

    try {

        const prompt = `
You are an executive productivity assistant analyzing a user's audio session notes from yesterday.

IMPORTANT LANGUAGE RULE:
- Detect the language of the notes below.
- Write ALL text values (mainTitle, summary, roadmapItem1, roadmapItem2, roadmapItem3) in the SAME language and native script as the notes (e.g. Bangla notes → Bangla script, Hindi → Devanagari, Arabic → Arabic script).
- Do NOT translate to English unless the notes themselves are in English.
- If the notes contain multiple languages, use the dominant language.
- Keep the JSON keys exactly in English as specified in the schema.

Analyze the following transcriptions and summaries:

"""
${combinedText}
"""

Tasks to perform:
1. 'titleAvatar': Generate a 2-character short code representing the core theme (e.g., "PS" for Product Strategy, "VM" for VoiceMind, "DEV" -> "DV"). Use uppercase for Latin letters. For non-Latin languages, use the first letters of the key theme words in that language's script (exactly 2 characters).
2. 'mainTitle': Write a punchy, actionable headline (max 10 words) summarizing the most critical focus.
3. 'summary': Write a clear 2-3 sentence overview synthesizing what was discussed yesterday and the high-level path forward.
4. 'roadmapItem1': Write the most urgent #1 action item for TODAY (short and actionable).
5. 'roadmapItem2': Write the #2 follow-up action item (e.g. for mid-week/BY THURSDAY).
6. 'roadmapItem3': Write the #3 broader action item (e.g. for THIS WEEK).

Return ONLY raw JSON matching the required schema.
`;




        const response = await generateContentWithRetry({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        titleAvatar: { type: Type.STRING },
                        mainTitle: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        roadmapItem1: { type: Type.STRING },
                        roadmapItem2: { type: Type.STRING },
                        roadmapItem3: { type: Type.STRING }
                    },
                    required: ["titleAvatar", "mainTitle", "summary", "roadmapItem1", "roadmapItem2", "roadmapItem3"]
                }
            }
        });




        const jsonText = typeof response.text === 'function' ? response.text() : response.text;
        if (!jsonText) return null;
        const resultObject = JSON.parse(jsonText);
        return resultObject;






    }

    catch (error) {
        console.error("❌ Error generating roadmap from Gemini AI:", error);
        return null;
    }

}



module.exports = { generateRoadmapFromAI };