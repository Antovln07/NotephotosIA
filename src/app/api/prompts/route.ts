import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint to get available prompts for users
export async function GET() {
    const prompts = await prisma.systemPrompt.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            isDefault: true,
        },
        orderBy: [
            { isDefault: "desc" },
            { name: "asc" },
        ],
    });

    return NextResponse.json(prompts);
}
