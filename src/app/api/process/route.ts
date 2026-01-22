import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 120; // Allow 120 seconds for processing multiple items

// Used from process.env.OPENAI_API_KEY by default by the SDK
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function getDefaultPrompt(transcriptions: string[], entryCount: number): string {
    const entryDescriptions = transcriptions.map((t, i) => `Photo ${i + 1}: "${t}"`).join("\n");

    return `Tu es un rédacteur professionnel expert. Tu reçois des photos accompagnées de commentaires vocaux transcrits (souvent informels, avec des hésitations, répétitions ou langage familier).

⚠️ RÈGLE ABSOLUE : Tu ne dois JAMAIS recopier les transcriptions mot pour mot. Tu dois les RÉÉCRIRE entièrement dans un style professionnel et fluide.

Exemple de transformation attendue :
- Transcription brute : "Euh donc là on voit le le truc qui est cassé, la pièce là elle est vraiment abîmée quoi"
- Version reformulée : "La pièce visible sur cette photo présente des dommages significatifs nécessitant une intervention."

CRÉE UN RAPPORT EN MARKDOWN avec :

1. **Titre** : Un titre court (max 6 mots), percutant et descriptif du contenu global (Ex: "Inspection Toiture Batiment B").
2. **Résumé** : 2-3 phrases synthétisant l'ensemble du rapport
3. **Pour chaque photo** (${entryCount} au total) :
   - Utilise [[IMAGE_{numéro}]] comme emplacement de l'image (numéros de 1 à ${entryCount})
   - Réécris le commentaire de façon PROFESSIONNELLE et STRUCTURÉE
   - Ajoute tes observations visuelles basées sur l'image

TRANSCRIPTIONS À REFORMULER (ne les copie surtout pas telles quelles) :
${entryDescriptions}

Style attendu : professionnel, clair, sans familiarités ni hésitations.`;
}


export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const mode = formData.get("mode") as string;

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Handle new report mode with multiple entries
        if (mode === "report") {
            const entryCount = parseInt(formData.get("entryCount") as string) || 0;
            const transcriptions: string[] = [];
            const imageContents: { type: "image_url"; image_url: { url: string } }[] = [];

            // Process each entry
            for (let i = 0; i < entryCount; i++) {
                const photo = formData.get(`photo_${i}`) as File;
                const audio = formData.get(`audio_${i}`) as File;

                // Transcribe audio
                if (audio) {
                    console.log(`Transcribing audio ${i}...`);
                    const transcriptionResponse = await openai.audio.transcriptions.create({
                        file: audio,
                        model: "whisper-1",
                    });
                    transcriptions.push(transcriptionResponse.text);
                }

                // Convert photo to base64
                if (photo) {
                    const buffer = await photo.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString("base64");
                    imageContents.push({
                        type: "image_url",
                        image_url: { url: `data:${photo.type};base64,${base64}` },
                    });
                }
            }

            console.log(`Processing report with ${entryCount} entries...`);

            // Get prompt content (from DB or default)
            const promptId = formData.get("promptId") as string;
            let systemPromptContent: string;

            if (promptId) {
                const { prisma } = await import("@/lib/prisma");
                const customPrompt = await prisma.systemPrompt.findUnique({
                    where: { id: promptId },
                });
                if (customPrompt) {
                    // Replace template variables
                    const entryDescriptions = transcriptions.map((t, i) => `Photo ${i + 1}: "${t}"`).join("\n");
                    systemPromptContent = customPrompt.content
                        .replace("{{transcriptions}}", entryDescriptions)
                        .replace("{{entryCount}}", entryCount.toString());
                } else {
                    systemPromptContent = getDefaultPrompt(transcriptions, entryCount);
                }
            } else {
                systemPromptContent = getDefaultPrompt(transcriptions, entryCount);
            }

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: systemPromptContent,
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Voici les photos à analyser pour le rapport:" },
                            ...imageContents,
                        ],
                    },
                ],
            });

            const noteContent = response.choices[0].message.content || "";

            // Extract title from the generated content
            const titleMatch = noteContent.match(/^#\s*(.+)/m);
            const title = titleMatch ? titleMatch[1].trim().substring(0, 50) : "Photo Report";

            return NextResponse.json({
                note: noteContent,
                transcriptions,
                title,
            });
        }

        // Legacy mode: single audio with optional images
        const audioFile = formData.get("audio") as File;
        const images = formData.getAll("images") as File[];

        // 1. Transcribe Audio
        let transcription = "";
        if (audioFile) {
            console.log("Transcribing audio...", audioFile.name, audioFile.size);
            const transcriptionResponse = await openai.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-1",
            });
            transcription = transcriptionResponse.text;
        }

        // 2. Process with GPT-4o (Vision)
        console.log("Processing with GPT-4o...", transcription.length, "chars, ", images.length, "images");

        // Convert images to base64 for the API
        const imageContent = await Promise.all(
            images.map(async (img) => {
                const buffer = await img.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");
                return {
                    type: "image_url" as const,
                    image_url: {
                        url: `data:${img.type};base64,${base64}`,
                    },
                };
            })
        );

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert note-taker and editor. 
          Your task is to take a raw voice transcription and a set of photos, and create a structured, beautiful Markdown note.
          
          Rules:
          1.  Title: specific and catchy based on content.
          2.  Summary: A brief 2-3 sentence summary.
          3.  Structure: Use headers, bullet points, and bold text to organize the information content.
          4.  Images: The user has uploaded photos. You will receive them. 
              Reflect that photos exist in the text where relevant (e.g. "See attached photo of the whiteboard"). 
              You CANNOT embed the images directly effectively as we don't have URLs yet, 
              BUT you should insert a placeholder tag like [[IMAGE_1]], [[IMAGE_2]] where they should logically go based on the context.
              I will replace these tags with the actual images later.
          5.  Tone: Professional but personal.
          
          Raw Transcription: "${transcription}"
          `,
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Here is the transcription and the photos I took." },
                        ...imageContent,
                    ],
                },
            ],
        });

        const noteContent = response.choices[0].message.content;

        return NextResponse.json({
            note: noteContent,
            rawTranscription: transcription
        });

    } catch (error: any) {
        console.error("Error processing note:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

