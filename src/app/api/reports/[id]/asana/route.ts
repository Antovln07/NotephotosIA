
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAsanaTask, getWorkspaceUsers } from "@/lib/asana";
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

        // 3. Fetch Workspace Users (for smart assignment)
        // We only fetch if we have a workspace ID, or we assume the helper finds it via projects? 
        // Actually getWorkspaceUsers needs workspace ID. 
        // We stored `asanaWorkspaceId` in User table, usually. 
        // If not, we might need to fetch it or iterate. 
        // For simplicity, let's assume if we have asanaWorkspaceId we use it. 
        // If not, we might skip assignment or try to get it from a project lookup (expensive).
        // Let's rely on `user.asanaWorkspaceId`.

        let asanaUsers: any[] = [];
        const userConfig = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { asanaAccessToken: true, asanaProjectId: true, asanaWorkspaceId: true }
        });

        if (userConfig?.asanaWorkspaceId) {
            asanaUsers = await getWorkspaceUsers(userConfig.asanaAccessToken!, userConfig.asanaWorkspaceId);
        }

        // 4. Process Sync
        const results = await Promise.allSettled(entries.map(async (entry: any) => {
            // Reformulate text and get extraction data
            const { title, content, assignee_name, due_date } = await reformulateForTask(entry.transcription);

            let assigneeId: string | undefined = undefined;

            // Try to match assignee
            if (assignee_name && asanaUsers.length > 0) {
                // Simple fuzzy match: check if name is included in user name
                const lowerAssignee = assignee_name.toLowerCase();
                const matchedUser = asanaUsers.find(u => u.name.toLowerCase().includes(lowerAssignee));
                if (matchedUser) {
                    assigneeId = matchedUser.gid;
                }
            }

            return createAsanaTask({
                token: user.asanaAccessToken!,
                projectId: user.asanaProjectId!,
                title: title,
                content: content,
                photoBase64: entry.photoData,
                assigneeId: assigneeId,
                dueOn: due_date
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
