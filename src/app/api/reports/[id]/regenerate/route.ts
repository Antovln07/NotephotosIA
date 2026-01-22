
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import OpenAI from "openai";

export const maxDuration = 120;

function getDefaultPrompt(transcriptions: string[], entryCount: number): string {
    const entryDescriptions = transcriptions.map((t, i) => `Photo ${i + 1}: "${t}"`).join("\n");

    return `Tu es un rédacteur professionnel expert. Tu reçois des photos accompagnées de commentaires vocaux transcrits.
    
    CRÉE UN RAPPORT EN MARKDOWN avec :
    1. **Titre** : Un titre professionnel
    2. **Résumé** : 2-3 phrases
    3. **Pour chaque photo** (${entryCount} au total) :
       - Utilise [[IMAGE_{numéro}]] comme emplacement de l'image
       - Réécris le commentaire
       - Ajoute tes observations visuelles basées sur l'image
    
    TRANSCRIPTIONS :
    ${entryDescriptions}`;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        console.log(`[Regenerate] Request for report ${id}, PromptId: ${body.promptId}`);
        const { promptId } = body;

        // 1. Fetch Report & Entries
        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                entries: {
                    orderBy: { order: "asc" },
                },
            },
        });

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Check ownership/permissions
        const canEdit = report.userId === session.user.id || session.user.role === "ADMIN";
        if (!canEdit) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // 2. Prepare Data for OpenAI
        const entryCount = report.entries.length;
        const transcriptions = report.entries.map(e => e.transcription);

        // Prepare image contents for Vision API
        const imageContents = await Promise.all(report.entries.map(async (entry) => {
            // We assume photoData is already a base64 Data URL (data:image/xyz;base64,...)
            // OpenAI needs just the URL object
            return {
                type: "image_url" as const,
                image_url: { url: entry.photoData },
            };
        }));

        // 3. Get System Prompt
        let systemPromptContent: string;
        if (promptId) {
            const customPrompt = await prisma.systemPrompt.findUnique({
                where: { id: promptId },
            });

            if (customPrompt) {
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

        // 4. Call OpenAI
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
                        { type: "text", text: "Voici les photos à analyser pour régénérer le rapport :" },
                        ...imageContents,
                    ],
                },
            ],
        });

        const newNoteContent = response.choices[0].message.content || "";

        // Extract title
        const titleMatch = newNoteContent.match(/^#\s*(.+)/m);
        const newTitle = titleMatch ? titleMatch[1].trim().substring(0, 50) : report.title;

        // 5. Update Database
        const updatedReport = await prisma.report.update({
            where: { id },
            data: {
                content: newNoteContent,
                title: newTitle,
            },
            include: { // Return updated structure including entries for frontend to re-render
                entries: { orderBy: { order: "asc" } },
                user: { select: { name: true, email: true } }
            }
        });

        return NextResponse.json(updatedReport);

    } catch (error: any) {
        console.error("Regeneration error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
