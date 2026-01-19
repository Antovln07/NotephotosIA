import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/reports - List reports
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";

    // Only ADMIN and RESPONSABLE can see all reports
    const canViewAll = session.user.role === "ADMIN" || session.user.role === "RESPONSABLE";

    const where = showAll && canViewAll ? {} : { userId: session.user.id };

    const reports = await prisma.report.findMany({
        where,
        select: {
            id: true,
            title: true,
            createdAt: true,
            user: {
                select: {
                    name: true,
                    email: true,
                },
            },
            _count: {
                select: { entries: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
}

// POST /api/reports - Create new report
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { title, content, entries } = await req.json();

        const report = await prisma.report.create({
            data: {
                title,
                content,
                userId: session.user.id,
                entries: {
                    create: entries.map((entry: any, index: number) => ({
                        photoData: entry.photoBase64,
                        transcription: entry.transcription,
                        order: index,
                    })),
                },
            },
            include: {
                entries: true,
            },
        });

        return NextResponse.json(report, { status: 201 });
    } catch (error: any) {
        console.error("Error creating report:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
