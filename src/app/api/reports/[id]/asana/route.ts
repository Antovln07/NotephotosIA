
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAsanaTask } from "@/lib/asana";
import { reformulateForTask } from "@/lib/openai";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Fix for Next.js 15+ params
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { entryIds } = await req.json();
        const { id } = await context.params;

        if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
            return NextResponse.json({ error: "No entries selected" }, { status: 400 });
        }

        // 1. Get User Config
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { asanaAccessToken: true, asanaProjectId: true }
        });

        if (!user?.asanaAccessToken || !user?.asanaProjectId) {
            return NextResponse.json({ error: "Asana not configured" }, { status: 400 });
        }

        // 2. Fetch Entries
        const entries = await prisma.reportEntry.findMany({
            where: {
                reportId: id,
                id: { in: entryIds }
            },
            include: { report: { select: { title: true } } }
        });

        // 3. Process Sync
        const results = await Promise.allSettled(entries.map(async (entry: any) => {
            // Reformulate text
            const reformulatedContent = await reformulateForTask(entry.transcription);

            return createAsanaTask({
                token: user.asanaAccessToken!,
                projectId: user.asanaProjectId!,
                title: `${entry.report.title} - Note ${(entry.order as number) + 1}`,
                content: reformulatedContent,
                photoBase64: entry.photoData
            });
        }));

        const successCount = results.filter(r => r.status === "fulfilled").length;

        return NextResponse.json({
            success: true,
            synced: successCount,
            total: entryIds.length
        });

    } catch (error: any) {
        console.error("Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
