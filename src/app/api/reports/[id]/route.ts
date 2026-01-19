import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/reports/[id] - Get single report
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await prisma.report.findUnique({
        where: { id },
        include: {
            entries: {
                orderBy: { order: "asc" },
            },
            user: {
                select: {
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check access: owner, RESPONSABLE, or ADMIN
    const canView =
        report.userId === session.user.id ||
        session.user.role === "ADMIN" ||
        session.user.role === "RESPONSABLE";

    if (!canView) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(report);
}

// DELETE /api/reports/[id] - Delete report
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await prisma.report.findUnique({
        where: { id },
        select: { userId: true },
    });

    if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Only owner or ADMIN can delete
    const canDelete = report.userId === session.user.id || session.user.role === "ADMIN";

    if (!canDelete) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.report.delete({ where: { id } });

    return NextResponse.json({ success: true });
}

// PUT /api/reports/[id] - Update report entry transcription
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await prisma.report.findUnique({
        where: { id },
        select: { userId: true },
    });

    if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Only owner can update
    if (report.userId !== session.user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    try {
        const { entries } = await req.json();

        // Update each entry's transcription
        for (const entry of entries) {
            await prisma.reportEntry.update({
                where: { id: entry.id },
                data: { transcription: entry.transcription },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
