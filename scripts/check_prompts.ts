
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const prompts = await prisma.systemPrompt.findMany();
    console.log("Existing Prompts:");
    prompts.forEach(p => {
        console.log(`- ${p.name} (ID: ${p.id}, Default: ${p.isDefault})`);
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
