"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Save } from "lucide-react";
import Link from "next/link";

interface Project {
    gid: string;
    name: string;
    workspaceName: string;
}

export default function SettingsPage() {
    const router = useRouter();
    const [token, setToken] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Fetch current status
        fetch("/api/settings/asana")
            .then(res => res.json())
            .then(data => {
                if (data.isConnected) {
                    setIsConnected(true);
                    if (data.projectId) setSelectedProject(data.projectId);
                }
            });
    }, []);

    const handleVerify = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/settings/asana", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setProjects(data.projects);
            if (data.projects.length > 0) {
                setSelectedProject(data.projects[0].gid);
            }
        } catch (err: any) {
            setError(err.message || "Erreur de connexion à Asana");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const project = projects.find(p => p.gid === selectedProject);
            const res = await fetch("/api/settings/asana", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    projectId: selectedProject,
                    // If we have projects loaded, we assume we are saving new config. 
                    // Use workspace name or ID if available, but for now ID is enough if my helper handles it.
                    // Wait, helper uses workspace ID to filter? No, helper fetches projects.
                    // My PUT API expects workspaceId? Yes, I added it in schema, but not strictly required if we just use projects.
                    // The create task API needs project ID.
                })
            });

            if (!res.ok) throw new Error("Erreur sauvegarde");

            setIsConnected(true);
            router.refresh();
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-md mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="p-2 hover:bg-zinc-800 rounded-full transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold">Intégration Asana</h1>
                </div>

                <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Personal Access Token (PAT)</label>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Insérez votre token ici..."
                                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-600 transition"
                            />
                            <p className="text-xs text-zinc-500">
                                Récupérez votre token dans la <a href="https://app.asana.com/0/my-apps" target="_blank" className="text-blue-400 hover:underline">console développeur Asana</a>.
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleVerify}
                            disabled={loading || !token}
                            className="w-full py-3 px-4 bg-white text-black font-medium rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier le Token"}
                        </button>
                    </div>

                    {projects.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-400">Projet de destination</label>
                                <select
                                    value={selectedProject}
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-600 transition"
                                >
                                    {projects.map(p => (
                                        <option key={p.gid} value={p.gid}>
                                            {p.name} ({p.workspaceName})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                                    <Save className="w-4 h-4" />
                                    Sauvegarder et Activer
                                </>}
                            </button>
                        </div>
                    )}

                    {isConnected && projects.length === 0 && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                                <p className="font-medium text-green-400">Compte connecté</p>
                                <p className="text-sm text-green-500/60">Entrez un nouveau token pour modifier la configuration.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
