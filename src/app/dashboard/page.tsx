"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Camera, FileText, Users, LogOut, FolderOpen, Sparkles, Settings } from "lucide-react";

export default function DashboardPage() {
    const { data: session } = useSession();
    const role = session?.user?.role;

    const isAdmin = role === "ADMIN";
    const isResponsable = role === "RESPONSABLE" || isAdmin;

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="border-b border-zinc-800 p-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Notes MPH1865</h1>
                        <p className="text-sm text-zinc-500">
                            {session?.user?.name} • <span className="capitalize">{role?.toLowerCase()}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/settings"
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto p-6 space-y-8">
                {/* Quick Actions */}
                <section>
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                        Actions rapides
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <Link
                            href="/report/create"
                            className="p-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl hover:scale-[1.02] transition"
                        >
                            <Camera className="w-8 h-8 mb-3" />
                            <h3 className="font-semibold">Nouveau Rapport</h3>
                            <p className="text-sm text-blue-200 mt-1">Créer un rapport photo</p>
                        </Link>

                        <Link
                            href="/reports"
                            className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition"
                        >
                            <FolderOpen className="w-8 h-8 mb-3 text-zinc-400" />
                            <h3 className="font-semibold">Mes Rapports</h3>
                            <p className="text-sm text-zinc-500 mt-1">Voir l'historique</p>
                        </Link>
                    </div>
                </section>



                {/* Admin Section */}
                {isAdmin && (
                    <section>
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                            Administration
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <Link
                                href="/admin/users"
                                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition"
                            >
                                <Users className="w-6 h-6 mb-2 text-purple-400" />
                                <h3 className="font-medium">Utilisateurs</h3>
                                <p className="text-xs text-zinc-500">Gérer les comptes</p>
                            </Link>

                            <Link
                                href="/admin/prompts"
                                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition"
                            >
                                <Sparkles className="w-6 h-6 mb-2 text-yellow-400" />
                                <h3 className="font-medium">Prompts système</h3>
                                <p className="text-xs text-zinc-500">Formats de rapport</p>
                            </Link>

                            {isResponsable && (
                                <Link
                                    href="/reports?all=true"
                                    className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition"
                                >
                                    <FileText className="w-6 h-6 mb-2 text-green-400" />
                                    <h3 className="font-medium">Tous les rapports</h3>
                                    <p className="text-xs text-zinc-500">Vue globale</p>
                                </Link>
                            )}
                        </div>
                    </section>
                )}

                {/* Responsable extra view */}
                {isResponsable && !isAdmin && (
                    <section>
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                            Vue Responsable
                        </h2>
                        <Link
                            href="/reports?all=true"
                            className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition"
                        >
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-medium">Tous les rapports</h3>
                                <p className="text-sm text-zinc-500">Voir tous les rapports de l'équipe</p>
                            </div>
                        </Link>
                    </section>
                )}
            </main>
        </div>
    );
}
