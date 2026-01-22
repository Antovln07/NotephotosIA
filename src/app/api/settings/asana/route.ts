import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAsanaProjects } from "@/lib/asana";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { asanaProjectId: true, asanaAccessToken: true }
    });

    return NextResponse.json({
        projectId: user?.asanaProjectId,
        isConnected: !!user?.asanaAccessToken
    });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { token } = await req.json();
        if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

        const projects = await getAsanaProjects(token);
        return NextResponse.json({ projects });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { token, projectId, workspaceId } = await req.json();

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                asanaAccessToken: token,
                asanaProjectId: projectId,
                asanaWorkspaceId: workspaceId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
