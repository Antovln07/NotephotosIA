import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prompts = await prisma.systemPrompt.findMany({
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, content, isDefault } = await req.json();

    if (!name || !content) {
        return NextResponse.json({ error: "Nom et contenu requis" }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
        await prisma.systemPrompt.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
        });
    }

    const prompt = await prisma.systemPrompt.create({
        data: {
            name,
            description: description || null,
            content,
            isDefault: isDefault || false,
        },
    });

    return NextResponse.json(prompt, { status: 201 });
}
