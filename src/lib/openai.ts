
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function reformulateForTask(transcription: string): Promise<{ title: string; content: string }> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Tu es un expert en gestion de tâches. Tu reçois une transcription vocale. \n" +
                        "Ta mission : \n" +
                        "1. Reformuler le contenu pour en faire une description de tâche Asana claire et actionnable.\n" +
                        "2. Générer un titre court et précis pour cette tâche (max 5-6 mots).\n" +
                        "\n" +
                        "Réponds UNIQUEMENT au format JSON : { \"title\": \"...\", \"content\": \"...\" }"
                },
                {
                    role: "user",
                    content: `Transcription : "${transcription}"`
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");
        return {
            title: result.title || "Nouvelle note",
            content: result.content || transcription
        };
    } catch (error) {
        console.error("OpenAI Reformulation Error:", error);
        return { title: "Note Photo", content: transcription };
    }
}
