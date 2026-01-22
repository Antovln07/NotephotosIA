
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const prompts = await prisma.systemPrompt.findMany();
    console.log("Existing Prompts Content:");
    prompts.forEach(p => {
        console.log(`\n--- Prompt: ${p.name} ---`);
        console.log(p.content.substring(0, 500) + "..."); // Preview first 500 chars
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
