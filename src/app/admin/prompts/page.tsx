"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, FileText, Star, X, Check } from "lucide-react";

interface PromptData {
    id: string;
    name: string;
    description: string | null;
    content: string;
    isDefault: boolean;
    createdAt: string;
}

export default function AdminPromptsPage() {
    const [prompts, setPrompts] = useState<PromptData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PromptData | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        content: "",
        isDefault: false,
    });
    const [formError, setFormError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchPrompts();
    }, []);

    const fetchPrompts = async () => {
        try {
            const res = await fetch("/api/admin/prompts");
            if (res.ok) {
                const data = await res.json();
                setPrompts(data);
            }
        } catch (error) {
            console.error("Error fetching prompts:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        setIsSubmitting(true);

        try {
            const url = editingPrompt
                ? `/api/admin/prompts/${editingPrompt.id}`
                : "/api/admin/prompts";

            const res = await fetch(url, {
                method: editingPrompt ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur");
            }

            closeModal();
            fetchPrompts();
        } catch (error: any) {
            setFormError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce prompt système ?")) return;

        try {
            const res = await fetch(`/api/admin/prompts/${id}`, {
                method: "DELETE",
            });
            if (res.ok) fetchPrompts();
        } catch (error) {
            console.error("Error deleting prompt:", error);
        }
    };

    const openEditModal = (prompt: PromptData) => {
        setEditingPrompt(prompt);
        setFormData({
            name: prompt.name,
            description: prompt.description || "",
            content: prompt.content,
            isDefault: prompt.isDefault,
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingPrompt(null);
        setFormData({ name: "", description: "", content: "", isDefault: false });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingPrompt(null);
        setFormData({ name: "", description: "", content: "", isDefault: false });
        setFormError("");
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-zinc-800">
                <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
                    <Link href="/dashboard" className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-semibold">Prompts Système</h1>
                    <button
                        onClick={openCreateModal}
                        className="p-2 bg-blue-600 rounded-full hover:bg-blue-500 transition"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-2xl mx-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                    </div>
                ) : prompts.length === 0 ? (
                    <div className="text-center py-20 text-zinc-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Aucun prompt système</p>
                        <p className="text-sm mt-1">Créez-en un pour personnaliser les rapports</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {prompts.map((prompt) => (
                            <div
                                key={prompt.id}
                                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-400" />
                                            <span className="font-medium">{prompt.name}</span>
                                            {prompt.isDefault && (
                                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                                                    <Star className="w-3 h-3" />
                                                    Défaut
                                                </span>
                                            )}
                                        </div>
                                        {prompt.description && (
                                            <p className="text-sm text-zinc-500 mt-1">{prompt.description}</p>
                                        )}
                                        <p className="text-xs text-zinc-600 mt-2 line-clamp-2">
                                            {prompt.content.substring(0, 150)}...
                                        </p>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => openEditModal(prompt)}
                                            className="p-2 hover:bg-zinc-800 rounded-lg transition"
                                        >
                                            <Edit2 className="w-4 h-4 text-zinc-400" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(prompt.id)}
                                            className="p-2 hover:bg-red-500/10 rounded-lg transition"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-zinc-800">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold">
                                {editingPrompt ? "Modifier le prompt" : "Nouveau prompt"}
                            </h2>
                            <button onClick={closeModal} className="p-1 hover:bg-zinc-800 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                    {formError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">Nom</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ex: Rapport technique"
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">Description (optionnel)</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Format détaillé pour les audits techniques"
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">Contenu du prompt</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Tu es un assistant expert..."
                                    rows={8}
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500 resize-none"
                                    required
                                />
                                <p className="text-xs text-zinc-600">
                                    Variables disponibles: {"{{transcriptions}}"}, {"{{entryCount}}"}
                                </p>
                            </div>

                            <label className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="w-5 h-5 rounded"
                                />
                                <div>
                                    <span className="font-medium">Définir par défaut</span>
                                    <p className="text-xs text-zinc-500">Sera sélectionné automatiquement</p>
                                </div>
                            </label>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-3 bg-zinc-800 rounded-xl font-medium hover:bg-zinc-700 transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 bg-blue-600 rounded-xl font-medium hover:bg-blue-500 transition flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="w-5 h-5" />
                                            {editingPrompt ? "Enregistrer" : "Créer"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
