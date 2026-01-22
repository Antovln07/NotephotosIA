
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const simplePromptContent = `
Rôle : Tu es un assistant administratif précis.

OBJECTIF : 
Mettre en forme un rapport de visite propre et structuré basé sur {{entryCount}} photos et leurs notes vocales.

RÈGLES IMPORTANTES :
1. **PAS D'ANALYSE D'IMAGE** : Ne décris jamais ce que tu vois sur la photo. Contente-toi de la note vocale.
2. **REFORMULATION** : Transforme le langage oral (hésitations, fautes) en langage écrit professionnel, sans changer le sens.
3. **STRUCTURE** : Commence par un En-tête (Titre + Date).

FORMAT DU RAPPORT (Markdown) :

# Rapport de Visite
*Généré le [Date du jour]*

---

[Répéter pour chaque photo de 1 à {{entryCount}}]

### Observation n°{i}
[[IMAGE_{i}]]

**Note :**
[Texte reformulé ici]

---
`;

    // Update by name to avoid needing the ID
    // Note: If multiple exists, this might only update one, but we assume unique names or just update many.
    // Actually, updateMany is safer if we don't have unique constraint, but findFirst + update is fine.

    const existing = await prisma.systemPrompt.findFirst({
        where: { name: "Photo + Note (Simple)" }
    });

    if (existing) {
        await prisma.systemPrompt.update({
            where: { id: existing.id },
            data: {
                content: simplePromptContent,
                description: "Titre + Date + Photo + Note (Reformulée). Aucune analyse visuelle."
            }
        });
        console.log("Prompt mis à jour avec succès !");
    } else {
        console.log("Prompt introuvable, création...");
        await prisma.systemPrompt.create({
            data: {
                name: "Photo + Note (Simple)",
                description: "Titre + Date + Photo + Note (Reformulée). Aucune analyse visuelle.",
                content: simplePromptContent,
                isDefault: false
            }
        });
        console.log("Prompt créé !");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
