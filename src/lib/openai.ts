
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function reformulateForTask(transcription: string): Promise<string> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Tu es un assistant qui prépare des descriptions de tâches pour un outil de gestion de projet (Asana). Ta mission est de reformuler une transcription vocale informelle en une description de tâche claire, professionnelle et actionnable. Ne mets pas de titre, juste le contenu reformulé."
                },
                {
                    role: "user",
                    content: `Voici la transcription : "${transcription}"`
                }
            ]
        });

        return response.choices[0].message.content || transcription;
    } catch (error) {
        console.error("OpenAI Reformulation Error:", error);
        return transcription; // Fallback to original text
    }
}
