"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Trash2, Download, FileText, Calendar, Edit3, Check, X, Loader2, User } from "lucide-react";

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
    }, [id, router]);

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

        try {
            await fetch(`/api/reports/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries: updatedEntries }),
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

            // Entries
            for (let i = 0; i < report.entries.length; i++) {
                const entry = report.entries[i];

                if (yPosition > pdf.internal.pageSize.getHeight() - 100) {
                    pdf.addPage();
                    yPosition = margin;
                }

                try {
                    // Normalize image to fix rotation issues and get dimensions
                    const { base64, width, height } = await normalizeImage(entry.photoData);

                    // Calculate dimensions to fit in PDF while maintaining aspect ratio
                    const maxWidth = contentWidth * 0.8;
                    const ratio = width / height;
                    const imgWidth = maxWidth;
                    const imgHeight = maxWidth / ratio;

                    pdf.addImage(base64, "JPEG", margin + (contentWidth - imgWidth) / 2, yPosition, imgWidth, imgHeight);
                    yPosition += imgHeight + 10;
                } catch (imgError) {
                    console.error("Error adding image:", imgError);
                }

                if (entry.transcription) {
                    pdf.setFontSize(11);
                    pdf.setFont("helvetica", "normal");
                    const lines = pdf.splitTextToSize(entry.transcription, contentWidth);

                    const textHeight = lines.length * 6;
                    if (yPosition + textHeight > pdf.internal.pageSize.getHeight() - margin) {
                        pdf.addPage();
                        yPosition = margin;
                    }

                    pdf.text(lines, margin, yPosition);
                    yPosition += textHeight + 20;
                } else {
                    yPosition += 10;
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
                            }),
                            italics: true,
                            color: "666666",
                        }),
                    ],
                }),
                new Paragraph({ text: "" }),
            ];

            for (let i = 0; i < report.entries.length; i++) {
                const entry = report.entries[i];

                try {
                    // Normalize image to fix rotation issues
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
                        })
                    );
                } catch (imgError) {
                    console.error("Error adding image to Word:", imgError);
                }

                if (entry.transcription) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: entry.transcription }),
                            ],
                            spacing: { before: 200, after: 400 },
                        })
                    );
                }

                children.push(new Paragraph({ text: "" }));
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
                    <button
                        onClick={handleDelete}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </header>

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
                            <div className="rounded-2xl overflow-hidden border border-zinc-800">
                                <img
                                    src={entry.photoData}
                                    alt={`Photo ${i + 1}`}
                                    className="w-full aspect-[4/3] object-cover"
                                />
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
                <div className="flex gap-3 max-w-2xl mx-auto">
                    <button
                        onClick={exportToPDF}
                        disabled={isExporting}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Download className="w-5 h-5" />
                        Export PDF
                    </button>
                    <button
                        onClick={exportToWord}
                        disabled={isExporting}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <FileText className="w-5 h-5" />
                        Export Word
                    </button>
                </div>
            </div>
        </div>
    );
}
