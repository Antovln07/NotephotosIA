"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, FileText, User, Loader2 } from "lucide-react";

interface Report {
    id: string;
    title: string;
    createdAt: string;
    user: {
        name: string;
        email: string;
    };
    _count: {
        entries: number;
    };
}

function ReportsContent() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const showAll = searchParams.get("all") === "true";
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const canViewAll = session?.user?.role === "ADMIN" || session?.user?.role === "RESPONSABLE";

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const url = showAll && canViewAll ? "/api/reports?all=true" : "/api/reports";
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setReports(data);
                }
            } catch (error) {
                console.error("Error fetching reports:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReports();
    }, [showAll, canViewAll]);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-zinc-800">
                <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
                    <Link href="/dashboard" className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-semibold">
                        {showAll && canViewAll ? "Tous les rapports" : "Mes rapports"}
                    </h1>
                    <div className="w-9" />
                </div>
            </header>

            {/* Content */}
            <main className="max-w-2xl mx-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-20">
                        <FileText className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
                        <h2 className="text-xl font-medium mb-2">Aucun rapport</h2>
                        <p className="text-zinc-500 mb-6">Créez votre premier rapport photo</p>
                        <Link
                            href="/report/create"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-xl font-medium hover:bg-blue-500 transition"
                        >
                            Nouveau rapport
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map((report) => (
                            <Link
                                key={report.id}
                                href={`/report/${report.id}`}
                                className="block p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate">{report.title}</h3>
                                        <div className="flex items-center gap-3 mt-2 text-sm text-zinc-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(report.createdAt).toLocaleDateString("fr-FR")}
                                            </span>
                                            <span>{report._count.entries} photo{report._count.entries > 1 ? "s" : ""}</span>
                                        </div>
                                        {showAll && canViewAll && (
                                            <div className="flex items-center gap-1 mt-2 text-xs text-zinc-600">
                                                <User className="w-3 h-3" />
                                                {report.user.name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        }>
            <ReportsContent />
        </Suspense>
    );
}
