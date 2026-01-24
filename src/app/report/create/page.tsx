"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Mic, Square, ArrowRight, Check, X, Loader2, RotateCcw, ImageIcon, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface PhotoEntry {
    photo: File;
    photoPreview: string;
    audioBlob: Blob;
}

type Step = "capture" | "record" | "preview" | "finalize";

interface PromptOption {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
}

export default function CreateReportPage() {
    const router = useRouter();
    const [entries, setEntries] = useState<PhotoEntry[]>([]);
    const [currentPhoto, setCurrentPhoto] = useState<{ file: File; preview: string } | null>(null);
    const [currentAudio, setCurrentAudio] = useState<Blob | null>(null);
    const [step, setStep] = useState<Step>("capture");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [prompts, setPrompts] = useState<PromptOption[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState<string>("");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Fetch available prompts on mount
    useEffect(() => {
        fetch("/api/prompts")
            .then(res => res.json())
            .then((data: PromptOption[]) => {
                setPrompts(data);
                const defaultPrompt = data.find(p => p.isDefault);
                if (defaultPrompt) setSelectedPromptId(defaultPrompt.id);
            })
            .catch(console.error);
    }, []);

    // --- Photo Logic ---
    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);

            if (files.length > 1) {
                // Bulk upload: bypass recording
                const newEntries: PhotoEntry[] = files.map(file => ({
                    photo: file,
                    photoPreview: URL.createObjectURL(file),
                    audioBlob: new Blob([], { type: "audio/webm" }) // Empty blob for silence
                }));

                setEntries(prev => [...prev, ...newEntries]);

                // Optional: Show immediate feedback or just stay on capture step
                // alert(`${files.length} photos added!`); 
            } else {
                // Single photo: standard flow
                const file = files[0];
                const preview = URL.createObjectURL(file);
                setCurrentPhoto({ file, preview });
                setStep("record");
            }
        }
    };

    const retakePhoto = () => {
        if (currentPhoto) URL.revokeObjectURL(currentPhoto.preview);
        setCurrentPhoto(null);
        setCurrentAudio(null);
        setStep("capture");
    };

    // --- Audio Logic ---
    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            alert("Microphone not supported in this browser.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                setCurrentAudio(blob);
                stream.getTracks().forEach((track) => track.stop());
                setStep("preview");
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            const startTime = Date.now();
            timerRef.current = setInterval(() => {
                setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } catch (err) {
            console.error("Microphone error:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const reRecord = () => {
        setCurrentAudio(null);
        setStep("record");
    };

    // --- Entry Management ---
    const saveCurrentEntry = () => {
        if (currentPhoto && currentAudio) {
            setEntries(prev => [...prev, {
                photo: currentPhoto.file,
                photoPreview: currentPhoto.preview,
                audioBlob: currentAudio,
            }]);
            setCurrentPhoto(null);
            setCurrentAudio(null);
            setStep("capture");
        }
    };

    const removeEntry = (index: number) => {
        setEntries(prev => {
            const entry = prev[index];
            URL.revokeObjectURL(entry.photoPreview);
            return prev.filter((_, i) => i !== index);
        });
    };

    // --- Submit ---
    const finishReport = async () => {
        if (entries.length === 0) {
            alert("Please add at least one photo with a comment.");
            return;
        }

        setIsProcessing(true);

        try {
            const formData = new FormData();
            formData.append("mode", "report");

            entries.forEach((entry, i) => {
                formData.append(`photo_${i}`, entry.photo);
                formData.append(`audio_${i}`, entry.audioBlob, `audio_${i}.webm`);
            });
            formData.append("entryCount", entries.length.toString());
            if (selectedPromptId) {
                formData.append("promptId", selectedPromptId);
            }

            const res = await fetch("/api/process", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();

            // Convert photos to base64 for storage
            const photoEntries = await Promise.all(entries.map(async (entry, i) => {
                return new Promise<{ photoBase64: string; transcription: string }>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({
                        photoBase64: reader.result as string,
                        transcription: data.transcriptions[i] || "",
                    });
                    reader.readAsDataURL(entry.photo);
                });
            }));

            // Save to database via API
            const saveRes = await fetch("/api/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: data.title || "Photo Report",
                    content: data.note,
                    entries: photoEntries,
                }),
            });

            if (!saveRes.ok) throw new Error("Failed to save report");

            const savedReport = await saveRes.json();
            router.push(`/report/${savedReport.id}`);
        } catch (error) {
            console.error(error);
            alert("Error processing report: " + error);
        } finally {
            setIsProcessing(false);
        }
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="flex flex-col min-h-screen bg-black text-white">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-zinc-800">
                <button onClick={() => router.back()} className="text-zinc-400 hover:text-white">
                    Annuler
                </button>
                <h1 className="text-lg font-semibold">Nouveau Rapport</h1>
                <div className="text-sm text-zinc-500">{entries.length} photo{entries.length !== 1 ? 's' : ''}</div>
            </header>

            {/* Entries Preview Strip - hidden during finalize */}
            {entries.length > 0 && step !== "finalize" && (
                <div className="flex gap-2 p-3 overflow-x-auto bg-zinc-900/50 border-b border-zinc-800">
                    {entries.map((entry, i) => (
                        <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden group">
                            <img src={entry.photoPreview} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={() => removeEntry(i)}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                            >
                                <X className="w-5 h-5 text-red-400" />
                            </button>
                            <div className="absolute bottom-0.5 right-0.5 bg-black/70 rounded px-1 text-[10px]">
                                {i + 1}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
                {step === "capture" && (
                    <>
                        <div className="text-center space-y-2">
                            <Camera className="w-16 h-16 mx-auto text-zinc-600" />
                            <h2 className="text-xl font-medium">Prendre une photo</h2>
                            <p className="text-sm text-zinc-500">Capturez l'élément à documenter</p>
                        </div>
                        <div className="flex gap-4">
                            <label className="flex flex-col items-center gap-2 p-6 bg-zinc-900 rounded-2xl border border-zinc-700 hover:border-blue-500 transition cursor-pointer">
                                <Camera className="w-10 h-10 text-blue-400" />
                                <span className="text-sm">Caméra</span>
                                <input
                                    ref={photoInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handlePhotoCapture}
                                />
                            </label>
                            <label className="flex flex-col items-center gap-2 p-6 bg-zinc-900 rounded-2xl border border-zinc-700 hover:border-purple-500 transition cursor-pointer">
                                <ImageIcon className="w-10 h-10 text-purple-400" />
                                <span className="text-sm">Galerie</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handlePhotoCapture}
                                />
                            </label>
                        </div>
                    </>
                )}

                {step === "record" && currentPhoto && (
                    <>
                        <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-700">
                            <img src={currentPhoto.preview} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={retakePhoto}
                                className="absolute top-3 right-3 p-2 bg-black/60 rounded-full hover:bg-black/80"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="text-center space-y-3">
                            {isRecording ? (
                                <div className="text-red-400 text-4xl font-mono animate-pulse">
                                    {formatTime(recordingTime)}
                                </div>
                            ) : (
                                <p className="text-zinc-400">Enregistrez votre commentaire</p>
                            )}
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording
                                    ? 'bg-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                                    : 'bg-white text-black hover:scale-105'
                                    }`}
                            >
                                {isRecording ? (
                                    <Square className="w-8 h-8 fill-current" />
                                ) : (
                                    <Mic className="w-8 h-8" />
                                )}
                            </button>
                        </div>
                    </>
                )}

                {step === "preview" && currentPhoto && currentAudio && (
                    <>
                        <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-700">
                            <img src={currentPhoto.preview} alt="" className="w-full h-full object-cover" />
                            <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur rounded-xl p-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium">Audio enregistré</div>
                                    <div className="text-xs text-zinc-400">{formatTime(recordingTime)}</div>
                                </div>
                                <button onClick={reRecord} className="p-2 hover:bg-white/10 rounded-full">
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={saveCurrentEntry}
                            className="w-full max-w-sm py-4 bg-blue-600 rounded-xl font-semibold text-lg hover:bg-blue-500 transition flex items-center justify-center gap-2"
                        >
                            Suivant
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </>
                )}

                {step === "finalize" && (
                    <div className="w-full max-w-md space-y-6">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold">Finaliser le rapport</h2>
                            <p className="text-sm text-zinc-500 mt-1">{entries.length} photo{entries.length !== 1 ? 's' : ''} prêtes à générer</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {entries.map((entry, i) => (
                                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                                    <img src={entry.photoPreview} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                        {i + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {step === "capture" && entries.length > 0 && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur">
                    <button
                        onClick={() => setStep("finalize")}
                        className="w-full py-4 bg-green-600 rounded-xl font-semibold text-lg hover:bg-green-500 transition flex items-center justify-center gap-2"
                    >
                        Terminer le rapport
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {step === "finalize" && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur space-y-4">
                    {prompts.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Sélectionner votre prompt système</label>
                            <div className="relative">
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
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep("capture")}
                            className="flex-1 py-4 bg-zinc-800 rounded-xl font-medium hover:bg-zinc-700 transition"
                        >
                            Retour
                        </button>
                        <button
                            onClick={finishReport}
                            disabled={isProcessing}
                            className="flex-1 py-4 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Génération...
                                </>
                            ) : (
                                <>
                                    Générer
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
            {/* Loading Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-zinc-200/95 backdrop-blur text-zinc-900">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                    <p className="font-medium animate-pulse text-lg">Génération en cours</p>
                </div>
            )}
        </div>
    );
}
