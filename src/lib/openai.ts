
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function reformulateForTask(transcription: string): Promise<{ title: string; content: string; assignee_name?: string; due_date?: string }> {
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
                        "3. Extraire le NOM du responsable si mentionné explicitement (Ex: 'à faire par Paul'). Si doute -> null.\n" +
                        "4. Extraire la date d'échéance si mentionnée (Ex: 'pour mardi prochain'). Convertir au format YYYY-MM-DD. Si doute -> null.\n" +
                        "\n" +
                        "Réponds UNIQUEMENT au format JSON : { \"title\": \"...\", \"content\": \"...\", \"assignee_name\": \"...\" | null, \"due_date\": \"YYYY-MM-DD\" | null }"
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
            content: result.content || transcription,
            assignee_name: result.assignee_name,
            due_date: result.due_date
        };
    } catch (error) {
        console.error("OpenAI Reformulation Error:", error);
        return { title: "Note Photo", content: transcription, assignee_name: undefined, due_date: undefined };
    }
}
