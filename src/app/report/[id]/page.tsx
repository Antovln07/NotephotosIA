"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Trash2, Download, FileText, Calendar, Edit3, Check, X, Loader2, User, RefreshCw, Sparkles } from "lucide-react";

interface ReportEntry {
    id: string;
    photoData: string;
    transcription: string;
    order: number;
}

interface Report {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    user: {
        name: string;
        email: string;
    };
    entries: ReportEntry[];
}

export default function ReportDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const [report, setReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editedText, setEditedText] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
    const [syncStatus, setSyncStatus] = useState<{ synced: number, total: number } | null>(null);

    // Regeneration state
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [showRegenModal, setShowRegenModal] = useState(false);
    const [prompts, setPrompts] = useState<{ id: string, name: string, isDefault: boolean }[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState("");

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await fetch(`/api/reports/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setReport(data);
                } else if (res.status === 404) {
                    router.push("/reports");
                }
            } catch (error) {
                console.error("Error fetching report:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchReport();
        if (id) fetchReport();

        // Fetch prompts
        fetch("/api/prompts")
            .then(res => res.json())
            .then(data => {
                setPrompts(data);
                const def = data.find((p: any) => p.isDefault);
                if (def) setSelectedPromptId(def.id);
            })
            .catch(console.error);
    }, [id, router]);

    const handleRegenerate = async () => {
        if (!process.env.NEXT_PUBLIC_DEMO_MODE && !confirm("Cela va écraser le contenu actuel du rapport. Continuer ?")) return;

        setIsRegenerating(true);
        setShowRegenModal(false);

        try {
            const res = await fetch(`/api/reports/${id}/regenerate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promptId: selectedPromptId }),
            });

            if (!res.ok) throw new Error(await res.text());

            const updatedReport = await res.json();
            setReport(updatedReport);
            alert("Rapport régénéré avec succès !");
        } catch (error) {
            console.error("Regeneration error:", error);
            alert("Erreur lors de la régénération : " + error);
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Supprimer ce rapport ?")) return;

        try {
            const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
            if (res.ok) {
                router.push("/reports");
            }
        } catch (error) {
            console.error("Error deleting:", error);
        }
    };

    const handleSyncAsana = async () => {
        if (selectedEntries.length === 0) return;
        setIsSyncing(true);
        setSyncStatus(null);

        try {
            const res = await fetch(`/api/reports/${id}/asana`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entryIds: selectedEntries })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Erreur lors de la synchronisation");

            setSyncStatus({ synced: data.synced, total: data.total });
            alert(`Synchronisation réussie : ${data.synced}/${data.total} tâches créées.`);
            setSelectedEntries([]); // Reset selection
        } catch (error: any) {
            console.error("Sync error:", error);
            alert("Erreur Sync Asana: " + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const toggleSelection = (entryId: string) => {
        if (selectedEntries.includes(entryId)) {
            setSelectedEntries(selectedEntries.filter(id => id !== entryId));
        } else {
            setSelectedEntries([...selectedEntries, entryId]);
        }
    };

    const selectAll = () => {
        if (!report) return;
        if (selectedEntries.length === report.entries.length) {
            setSelectedEntries([]);
        } else {
            setSelectedEntries(report.entries.map(e => e.id));
        }
    };

    const startEditing = (index: number, text: string) => {
        setEditingIndex(index);
        setEditedText(text);
    };

    const saveEdit = async () => {
        if (!report || editingIndex === null) return;

        const updatedEntries = [...report.entries];
        updatedEntries[editingIndex] = {
            ...updatedEntries[editingIndex],
            transcription: editedText,
        };

        // Create a lightweight payload without photoData to avoid 413 errors
        const payloadEntries = updatedEntries.map(({ id, transcription, order }) => ({
            id,
            transcription,
            order
        }));

        try {
            await fetch(`/api/reports/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries: payloadEntries }),
            });

            setReport({ ...report, entries: updatedEntries });
            setEditingIndex(null);
        } catch (error) {
            console.error("Error saving:", error);
        }
    };

    const cancelEdit = () => {
        setEditingIndex(null);
        setEditedText("");
    };

    const normalizeImage = (base64Str: string): Promise<{ base64: string; width: number; height: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    resolve({
                        base64: canvas.toDataURL("image/jpeg", 0.95),
                        width: img.width,
                        height: img.height
                    });
                } else {
                    reject(new Error("Canvas context error"));
                }
            };
            img.onerror = reject;
            img.src = base64Str;
        });
    };

    const exportToPDF = async () => {
        if (!report) return;
        setIsExporting(true);

        try {
            const { jsPDF } = await import("jspdf");
            const pdf = new jsPDF();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 20;
            const contentWidth = pageWidth - 2 * margin;
            let yPosition = margin;

            // Title
            pdf.setFontSize(20);
            pdf.setFont("helvetica", "bold");
            pdf.text(report.title || "Photo Report", margin, yPosition);
            yPosition += 15;

            // Date
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(100);
            pdf.text(new Date(report.createdAt).toLocaleDateString("fr-FR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }), margin, yPosition);
            yPosition += 15;
            pdf.setTextColor(0);

            // Parse content: Split by [[IMAGE_N]] tags
            const parts = report.content.split(/(\[\[IMAGE_\d+\]\])/g);

            for (const part of parts) {
                const imageMatch = part.match(/\[\[IMAGE_(\d+)\]\]/);

                if (imageMatch) {
                    // It's an image placeholder
                    const imageIndex = parseInt(imageMatch[1]) - 1; // 1-based to 0-based
                    const entry = report.entries.find((e, i) => i === imageIndex || e.order === imageIndex); // Try both index match

                    if (entry) {
                        if (yPosition > pdf.internal.pageSize.getHeight() - 80) {
                            pdf.addPage();
                            yPosition = margin;
                        }

                        try {
                            const { base64, width, height } = await normalizeImage(entry.photoData);

                            // Max height 100mm to avoid taking too much page space
                            const maxWidth = contentWidth * 0.8;
                            const maxHeight = 120; // limit height

                            const ratio = width / height;
                            let imgWidth = maxWidth;
                            let imgHeight = maxWidth / ratio;

                            // Adjust if too tall
                            if (imgHeight > maxHeight) {
                                imgHeight = maxHeight;
                                imgWidth = maxHeight * ratio;
                            }

                            // Center image
                            const xPos = margin + (contentWidth - imgWidth) / 2;

                            pdf.addImage(base64, "JPEG", xPos, yPosition, imgWidth, imgHeight);
                            yPosition += imgHeight + 10;
                        } catch (err) {
                            console.error("Image error", err);
                        }
                    }
                } else {
                    // It's text
                    const text = part.trim();
                    if (!text) continue;

                    pdf.setFontSize(11);
                    pdf.setFont("helvetica", "normal");

                    // Basic Markdown cleaning (remove #, **, etc mostly)
                    // Note: proper markdown parsing in jsPDF is hard, doing basic cleanup
                    const cleanText = text
                        .replace(/^#+\s/gm, '') // Remove headers
                        .replace(/\*\*/g, '');  // Remove bold markers

                    const lines = pdf.splitTextToSize(cleanText, contentWidth);
                    const lineHeight = 6;

                    for (const line of lines) {
                        if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
                            pdf.addPage();
                            yPosition = margin;
                        }
                        pdf.text(line, margin, yPosition);
                        yPosition += lineHeight;
                    }
                    yPosition += 5; // Paragraph spacing
                }
            }

            pdf.save(`rapport_${report.id.slice(0, 8)}.pdf`);
        } catch (error) {
            console.error("PDF export error:", error);
            alert("Erreur export PDF: " + error);
        } finally {
            setIsExporting(false);
        }
    };

    const exportToWord = async () => {
        if (!report) return;
        setIsExporting(true);

        try {
            const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } = await import("docx");
            const { saveAs } = await import("file-saver");

            const children: any[] = [
                new Paragraph({
                    text: report.title || "Photo Report",
                    heading: HeadingLevel.HEADING_1,
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: new Date(report.createdAt).toLocaleDateString("fr-FR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            }),
                            italics: true,
                            color: "666666",
                        }),
                    ],
                }),
                new Paragraph({ text: "" }),
            ];

            // Parse content: Split by [[IMAGE_N]] tags
            const parts = report.content.split(/(\[\[IMAGE_\d+\]\])/g);

            for (const part of parts) {
                const imageMatch = part.match(/\[\[IMAGE_(\d+)\]\]/);

                if (imageMatch) {
                    // It's an image placeholder
                    const imageIndex = parseInt(imageMatch[1]) - 1; // 1-based to 0-based
                    const entry = report.entries.find((e, i) => i === imageIndex || e.order === imageIndex);

                    if (entry) {
                        try {
                            const { base64, width, height } = await normalizeImage(entry.photoData);
                            const base64Data = base64.split(",")[1];
                            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

                            // Calculate dimensions for Word (max width around 400px equivalent)
                            const maxWidth = 400;
                            const ratio = width / height;
                            const imgWidth = maxWidth;
                            const imgHeight = maxWidth / ratio;

                            children.push(
                                new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: imageBuffer,
                                            transformation: { width: imgWidth, height: imgHeight },
                                            type: "jpg",
                                        }),
                                    ],
                                    alignment: "center",
                                    spacing: { before: 200, after: 200 },
                                })
                            );
                        } catch (err) {
                            console.error("Image error", err);
                        }
                    }
                } else {
                    // Text content
                    const text = part.trim();
                    if (!text) continue;

                    // Naive markdown handling: Split by newlines to preserve basic paragraph structure
                    const paragraphs = text.split('\n');

                    for (const pText of paragraphs) {
                        if (!pText.trim()) continue;

                        let cleanText = pText.trim();
                        let headingLevel: any = undefined;
                        let isBold = false;

                        // Check for headers
                        if (cleanText.startsWith('# ')) {
                            headingLevel = HeadingLevel.HEADING_1;
                            cleanText = cleanText.replace('# ', '');
                        } else if (cleanText.startsWith('## ')) {
                            headingLevel = HeadingLevel.HEADING_2;
                            cleanText = cleanText.replace('## ', '');
                        } else if (cleanText.startsWith('### ')) {
                            headingLevel = HeadingLevel.HEADING_3;
                            cleanText = cleanText.replace('### ', '');
                        }

                        // Check for bold (simple check for **wrapper**)
                        // Note: docx handling of inline formatting is complex, doing simple paragraph level for now
                        // or just simple strip
                        cleanText = cleanText.replace(/\*\*/g, '');

                        children.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: cleanText,
                                        bold: isBold
                                    }),
                                ],
                                heading: headingLevel,
                                spacing: { after: 120 },
                            })
                        );
                    }
                }
            }

            const doc = new Document({
                sections: [{ properties: {}, children }],
            });

            const blob = await Packer.toBlob(doc);
            saveAs(blob, `rapport_${report.id.slice(0, 8)}.docx`);
        } catch (error) {
            console.error("Word export error:", error);
            alert("Erreur export Word: " + error);
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (!report) return null;

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-zinc-800">
                <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
                    <Link href="/reports" className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-semibold truncate px-4">{report.title}</h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowRegenModal(true)}
                            className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-full transition"
                            title="Régénérer avec l'IA"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition"
                            title="Supprimer"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Regeneration Modal */}
            {showRegenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-6">
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                                <Sparkles className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-semibold">Régénérer le rapport</h3>
                            <p className="text-sm text-zinc-400 mt-2">
                                Choisissez un style pour réécrire entièrement le rapport.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-500 uppercase">Prompt Système</label>
                            <select
                                value={selectedPromptId}
                                onChange={(e) => setSelectedPromptId(e.target.value)}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl appearance-none focus:outline-none focus:border-blue-500"
                            >
                                {prompts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}{p.isDefault ? " ★" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRegenModal(false)}
                                className="flex-1 py-3 bg-zinc-800 rounded-xl font-medium hover:bg-zinc-700 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleRegenerate}
                                className="flex-1 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition"
                            >
                                Régénérer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Check overlay for regenerating loader */}
            {isRegenerating && (
                <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-zinc-200/95 backdrop-blur text-zinc-900">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                    <p className="font-medium animate-pulse text-lg">Génération en cours</p>
                </div>
            )}

            {/* Content */}
            <main className="max-w-2xl mx-auto p-4 pb-32">
                {/* Meta */}
                <div className="flex items-center gap-4 text-sm text-zinc-500 mb-6">
                    <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                    <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {report.user.name}
                    </span>
                </div>

                {/* Entries */}
                <div className="space-y-8">
                    {report.entries.map((entry, i) => (
                        <div key={entry.id} className="space-y-4">
                            {/* Photo */}
                            <div className="rounded-2xl overflow-hidden border border-zinc-800 relative group">
                                <img
                                    src={entry.photoData}
                                    alt={`Photo ${i + 1}`}
                                    className="w-full aspect-[4/3] object-cover"
                                />
                                <div className="absolute top-2 right-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedEntries.includes(entry.id)}
                                        onChange={() => toggleSelection(entry.id)}
                                        className="w-6 h-6 rounded-md border-zinc-500 bg-black/50 checked:bg-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Transcription */}
                            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                                {editingIndex === i ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={editedText}
                                            onChange={(e) => setEditedText(e.target.value)}
                                            className="w-full bg-zinc-800 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={4}
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={cancelEdit}
                                                className="p-2 hover:bg-zinc-700 rounded-lg transition"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={saveEdit}
                                                className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3">
                                        <p className="flex-1 text-sm text-zinc-300 leading-relaxed">
                                            {entry.transcription || <span className="italic text-zinc-600">Pas de commentaire</span>}
                                        </p>
                                        <button
                                            onClick={() => startEditing(i, entry.transcription)}
                                            className="p-1.5 hover:bg-zinc-700 rounded-lg transition flex-shrink-0"
                                        >
                                            <Edit3 className="w-4 h-4 text-zinc-500" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Export Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 p-4">
                <div className="flex gap-3 max-w-2xl mx-auto flex-col sm:flex-row">
                    <div className="flex-1 flex gap-3">
                        <button
                            onClick={exportToPDF}
                            disabled={isExporting}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Download className="w-5 h-5" />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            onClick={exportToWord}
                            disabled={isExporting}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <FileText className="w-5 h-5" />
                            <span className="hidden sm:inline">Word</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 border-l border-zinc-700 pl-3">
                        <button
                            onClick={selectAll}
                            className="text-xs text-zinc-400 hover:text-white underline"
                        >
                            {selectedEntries.length === report?.entries.length ? "Tout désélect." : "Tout sélect."}
                        </button>
                        <button
                            onClick={handleSyncAsana}
                            disabled={isSyncing || selectedEntries.length === 0}
                            className="py-3 px-6 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-zinc-800"
                        >
                            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                            Sync Asana ({selectedEntries.length})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
