"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, User, Shield, Eye, X, Check } from "lucide-react";

interface UserData {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
    _count: {
        reports: number;
    };
}

export default function AdminUsersPage() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "USER",
    });
    const [formError, setFormError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur lors de la création");
            }

            setShowCreateModal(false);
            setFormData({ name: "", email: "", password: "", role: "USER" });
            fetchUsers();
        } catch (error: any) {
            setFormError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setFormError("");
        setIsSubmitting(true);

        try {
            const updateData: any = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
            };
            if (formData.password) {
                updateData.password = formData.password;
            }

            const res = await fetch(`/api/admin/users/${editingUser.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur lors de la mise à jour");
            }

            setEditingUser(null);
            setFormData({ name: "", email: "", password: "", role: "USER" });
            fetchUsers();
        } catch (error: any) {
            setFormError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm("Supprimer cet utilisateur et tous ses rapports ?")) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                fetchUsers();
            }
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };

    const openEditModal = (user: UserData) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: "",
            role: user.role,
        });
        setFormError("");
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingUser(null);
        setFormData({ name: "", email: "", password: "", role: "USER" });
        setFormError("");
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "ADMIN": return <Shield className="w-4 h-4 text-purple-400" />;
            case "RESPONSABLE": return <Eye className="w-4 h-4 text-green-400" />;
            default: return <User className="w-4 h-4 text-zinc-400" />;
        }
    };

    const getRoleName = (role: string) => {
        switch (role) {
            case "ADMIN": return "Administrateur";
            case "RESPONSABLE": return "Responsable";
            default: return "Utilisateur";
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-zinc-800">
                <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
                    <Link href="/dashboard" className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-semibold">Gestion des utilisateurs</h1>
                    <button
                        onClick={() => setShowCreateModal(true)}
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
                ) : (
                    <div className="space-y-3">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {getRoleIcon(user.role)}
                                            <span className="font-medium">{user.name}</span>
                                        </div>
                                        <p className="text-sm text-zinc-500 mt-1">{user.email}</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                                            <span>{getRoleName(user.role)}</span>
                                            <span>•</span>
                                            <span>{user._count.reports} rapport{user._count.reports !== 1 ? "s" : ""}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="p-2 hover:bg-zinc-800 rounded-lg transition"
                                        >
                                            <Edit2 className="w-4 h-4 text-zinc-400" />
                                        </button>
                                        {user.id !== session?.user?.id && (
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="p-2 hover:bg-red-500/10 rounded-lg transition"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create/Edit Modal */}
            {(showCreateModal || editingUser) && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-zinc-900 rounded-2xl w-full max-w-md p-6 border border-zinc-800">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold">
                                {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
                            </h2>
                            <button onClick={closeModal} className="p-1 hover:bg-zinc-800 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={editingUser ? handleUpdate : handleCreate} className="space-y-4">
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
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">
                                    {editingUser ? "Nouveau mot de passe (laisser vide pour garder l'actuel)" : "Mot de passe"}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500"
                                    required={!editingUser}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">Rôle</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500"
                                >
                                    <option value="USER">Utilisateur</option>
                                    <option value="RESPONSABLE">Responsable</option>
                                    <option value="ADMIN">Administrateur</option>
                                </select>
                            </div>

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
                                            {editingUser ? "Enregistrer" : "Créer"}
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
