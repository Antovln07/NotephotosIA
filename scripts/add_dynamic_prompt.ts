
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const dynamicPromptContent = `
Tu es un expert en rédaction de rapports techniques.

OBJECTIF : 
Générer un rapport structuré basé sur {{entryCount}} photos et leurs transcriptions associées.

FORMAT DU RAPPORT (Markdown) :

# [Titre du Rapport]
*Date : [Date du jour]*

## Résumé Global
[Un paragraphe résumant la situation générale]

## Détail des Observations

---
[INSTRUCTION POUR L'IA : Répète le bloc ci-dessous pour chaque photo de 1 à {{entryCount}}]

### Observation #{{i}}
[[IMAGE_{{i}}]]

**Transcription reformulée :**
[Réécris ici la transcription de la photo {{i}} en langage professionnel]

**Analyse visuelle :**
[Ajoute une brève description de ce que tu vois sur l'image {{i}}]

---
[FIN DE LA BOUCLE]

## Conclusion
[Conclusion professionnelle]
`;

    /* 
       Note: In the actual prompt sent to OpenAI, the variable {{entryCount}} will be replaced by the number.
       The {{i}} loop is a logical instruction for the AI, not a variable replaced by code (unless we implemented a template engine, 
       but here we rely on the AI's ability to follow "Repeat for each..." instructions).
       
       Wait, to be safer with the current simple string replacement, we should give a clearer instruction to the AI 
       since our code only replaces {{transcriptions}} and {{entryCount}}.
    */

    const robustPromptContent = `
Rôle : Tu es un rédacteur de rapports d'inspection.
Tâche : Créer un rapport professionnel à partir de {{entryCount}} photos.

Voici les données d'entrée :
{{transcriptions}}

Règles de génération :
1. Crée un titre pertinent.
2. Rédige un court résumé.
3. Pour CHAQUE photo (de 1 à {{entryCount}}), génère une section structurée exactement comme suit :

   ### Point n°[Numéro]
   [[IMAGE_[Numéro]]]
   
   **Description :**
   [Texte reformulé professionnellement basé sur la transcription et l'image]

IMPORTANT : 
- Tu DOIS inclure le tag [[IMAGE_X]] pour CHAQUE photo, où X est le numéro de la photo.
- Le rapport doit contenir exactement {{entryCount}} sections d'image.
`;

    await prisma.systemPrompt.create({
        data: {
            name: "Rapport Dynamique (Universel)",
            description: "S'adapte automatiquement à n'importe quel nombre de photos.",
            content: robustPromptContent,
            isDefault: true,
        },
    });

    console.log("Prompt dynamique ajouté avec succès !");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
