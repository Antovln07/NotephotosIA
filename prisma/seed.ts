import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create default users
    const users = [
        {
            email: 'admin@notephotos.local',
            password: 'Admin2024!',
            name: 'Administrateur',
            role: 'ADMIN' as const,
        },
        {
            email: 'responsable@notephotos.local',
            password: 'Resp2024!',
            name: 'Responsable',
            role: 'RESPONSABLE' as const,
        },
        {
            email: 'user@notephotos.local',
            password: 'User2024!',
            name: 'Utilisateur Test',
            role: 'USER' as const,
        },
    ];

    for (const user of users) {
        const hashedPassword = await bcrypt.hash(user.password, 10);

        await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: {
                email: user.email,
                password: hashedPassword,
                name: user.name,
                role: user.role,
            },
        });

        console.log(`Created user: ${user.email} (${user.role})`);
    }

    console.log('Seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
