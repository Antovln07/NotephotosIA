
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const simplePromptContent = `
Rôle : Tu es un assistant précis chargé de nettoyer des notes vocales.

OBJECTIF : 
Pour chaque photo fournie (de 1 à {{entryCount}}), tu dois présenter l'image et sa note associée.

Règles de rédaction :
- Ne modifie PAS le sens de la phrase.
- Corrige uniquement la syntaxe, les hésitations ("euh", "bah") et la grammaire.
- Rends le texte fluide et lisible.
- N'ajoute PAS de titre, d'intro, ou de conclusion générale.

FORMAT DE SORTIE (Répéter pour chaque photo) :

[[IMAGE_{i}]]
**Note :** [Ta reformulation ici]

---
`;

    await prisma.systemPrompt.create({
        data: {
            name: "Photo + Note (Simple)",
            description: "Juste la photo et le texte reformulé. Pas d'analyse.",
            content: simplePromptContent,
            isDefault: false,
        },
    });

    console.log("Prompt 'Photo + Note (Simple)' ajouté avec succès !");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
