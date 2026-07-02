import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useNavigate } from 'react-router-dom';
import { signOut } from "firebase/auth";
import { deleteUser } from "firebase/auth";
import { FaCamera } from 'react-icons/fa';
import { motion } from "framer-motion";
import { db, auth } from "../firebase";
import { getAuth } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, updateDoc, increment } from "firebase/firestore";

export default function EcoFeastApp() {

    const navigate = useNavigate();
    const [pantryItems, setPantryItems] = useState([]);
    const [co2Saved, setCo2Saved] = useState(0);
    const [itemsSaved, setItemsSaved] = useState(0);
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [aiRecipe, setAiRecipe] = useState(null);
    const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
    const [wasteInput, setWasteInput] = useState('');
    const [wasteResult, setWasteResult] = useState(null);
    const [isClassifyingWaste, setIsClassifyingWaste] = useState(false);
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [scannedResult, setScannedResult] = useState(null);
    const [isAnalyzingCamera, setIsAnalyzingCamera] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    // EFFECT 1: Cleanup kamera saat unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, []);

    // EFFECT 2: Kontrol Kamera Scanner
    useEffect(() => {
        if (!isScanModalOpen) return;
        let cancelled = false;

        const openCamera = async () => {
            setIsCameraActive(false);
            setIsAnalyzingCamera(false);
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error("Browser tidak mendukung akses kamera.");
                }
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } }
                });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                    await videoRef.current.play().catch(() => undefined);
                    setIsCameraActive(true);
                } else {
                    stream.getTracks().forEach((track) => track.stop());
                    throw new Error("Elemen video belum siap.");
                }
            } catch (err) {
                console.error("Gagal membuka kamera perangkat:", err);
                alert(`Gagal mengakses kamera: ${err.message}`);
                setIsScanModalOpen(false);
            }
        };

        openCamera();
        return () => { cancelled = true; };
    }, [isScanModalOpen]);

    // EFFECT 3: Sinkronisasi Real-Time Firestore (Pantry & Utama)
    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
            if (!currentUser) {
                console.log("Menunggu sesi login user siap...");
                return;
            }

            console.log("User aktif detected. UID:", currentUser.uid);

            // A. Sinkronisasi Sub-koleksi Bahan Makanan
            const pantryRef = collection(db, "users", currentUser.uid, "bahan makanan");
            const unsubscribePantry = onSnapshot(pantryRef, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                setPantryItems(items);
                console.log("Data pantry berhasil disinkronisasi:", items);
            }, (error) => console.error("Gagal sinkronisasi pantry:", error));

            // B. Sinkronisasi Dokumen Utama (Dampak Lingkungan)
            // B. Sinkronisasi Dokumen Utama (Dampak Lingkungan & Grafik Sampah)
            const userMainRef = doc(db, "users", currentUser.uid);
            unsubscribeMainData = onSnapshot(userMainRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();

                    // Sinkronisasi CO2 dan Bahan makanan
                    setCo2Saved(data.co2Saved || 0);
                    setItemsSaved(data.itemsSaved || 0);

                    // SINKRONISASI DATA GRAFIK SAMPAH DARI FIRESTORE
                    setWasteCount({
                        organic: data.wasteOrganic || 0,
                        inorganic: data.wasteInorganic || 0
                    });

                    console.log("Data dampak & grafik berhasil disinkronisasi:", data);
                } else {
                    console.log("Dokumen utama belum ada di Cloud Firestore.");
                }
            }, (error) => console.error("Gagal sinkronisasi data utama:", error));

            return () => {
                if (unsubscribePantry) unsubscribePantry();
                if (unsubscribeMainData) unsubscribeMainData();
            };
        });

        return () => unsubscribeAuth();
    }, []);

    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    const startCamera = () => {
        setIsScanModalOpen(true);
        setScannedResult(null);
        setIsAnalyzingCamera(false);
    };

    const captureAndAnalyze = async (e) => {
        if (e) e.preventDefault();
        if (!isCameraActive || !videoRef.current) {
            alert("Kamera belum aktif atau belum siap.");
            return;
        }
        setIsAnalyzingCamera(true);

        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

            const promptInstructions = `
                Analisis gambar bahan makanan ini. Berikan respons HANYA dalam format JSON mentah berstruktur seperti ini, tanpa penjelasan tambahan lainnya:
                {
                    "name": "Nama bahan makanan hasil deteksianmu dalam Bahasa Indonesia",
                    "detectedStorage": "Kulkas / Freezer / Suhu Ruang",
                    "predictedExpiryDays": 5
                }
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    promptInstructions,
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
                ],
                config: { responseMimeType: "application/json" }
            });

            const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!responseText) throw new Error("API Gemini mengembalikan data kosong.");

            const resultJson = JSON.parse(responseText.trim());
            setScannedResult({
                name: resultJson.name || "Bahan Tidak Dikenali",
                detectedStorage: resultJson.detectedStorage || "Kulkas",
                predictedExpiryDays: Number(resultJson.predictedExpiryDays) || 3
            });
        } catch (err) {
            console.error("Detail Error Sistem Scan AI:", err);
            if (err.message?.includes("503") || err.status === 503) {
                alert("🤖 Server AI Gemini sedang penuh sesak (503). Silakan coba ambil gambar lagi dalam beberapa saat.");
            } else {
                alert(`Gagal memproses gambar: ${err.message}`);
            }
        } finally {
            setIsAnalyzingCamera(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsCameraActive(false);
        setIsAnalyzingCamera(false);
        setIsScanModalOpen(false);
    };

    const toggleSelectIngredient = (name) => {
        setSelectedIngredients((prev) =>
            prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
        );
    };

    const handleAddToPantry = async () => {
        if (!scannedResult?.name) return;
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert("Anda harus login terlebih dahulu.");
            return;
        }

        const normalizedName = scannedResult.name.toLowerCase();
        const existing = pantryItems.some((item) => item.name.toLowerCase() === normalizedName);

        if (!existing) {
            const stringId = Date.now().toString();
            const newItem = {
                name: scannedResult.name,
                daysLeft: scannedResult.predictedExpiryDays,
                status: scannedResult.predictedExpiryDays <= 2 ? 'danger' : scannedResult.predictedExpiryDays <= 5 ? 'warning' : 'safe',
                storage: scannedResult.detectedStorage,
                createdAt: new Date().toISOString()
            };

            try {
                await setDoc(doc(db, "users", currentUser.uid, "bahan makanan", stringId), newItem);
                alert(`${scannedResult.name} berhasil ditambahkan ke Inventaris.`);
            } catch (error) {
                console.error("Gagal menyimpan ke Firestore:", error);
                alert("Gagal menyimpan data ke cloud.");
            }
        } else {
            alert("Bahan makanan sudah ada di Inventaris.");
        }

        stopCamera();
        setScannedResult(null);
    };

    const INGREDIENT_IMPACT_DB = {
        'dada ayam': { co2: 1.2, water: 350, equivalencyFactor: 8 },
        'bayam organik': { co2: 0.2, water: 40, equivalencyFactor: 1.5 },
        'tomat ceri': { co2: 0.3, water: 30, equivalencyFactor: 2 },
        'bawang bombay': { co2: 0.1, water: 20, equivalencyFactor: 0.5 },
        'default': { co2: 0.2, water: 30, equivalencyFactor: 1.5 }
    };

    const calculateCurrentCo2Saved = (ingredients) => {
        let total = 0;
        ingredients.forEach(ingredient => {
            const normalizedName = ingredient.toLowerCase();
            const matchedKey = Object.keys(INGREDIENT_IMPACT_DB).find(key => normalizedName.includes(key));
            const impact = INGREDIENT_IMPACT_DB[matchedKey] || INGREDIENT_IMPACT_DB['default'];
            total += impact.co2;
        });
        return +total.toFixed(1);
    };

    const generateRecipe = async () => {
        if (selectedIngredients.length === 0) return;
        setIsGeneratingRecipe(true);

        let totalCo2Saved = 0;
        let totalWaterSaved = 0;
        let totalHoursEquivalency = 0;

        selectedIngredients.forEach(ingredient => {
            const normalizedName = ingredient.toLowerCase();
            const matchedKey = Object.keys(INGREDIENT_IMPACT_DB).find(key => normalizedName.includes(key));
            const impact = INGREDIENT_IMPACT_DB[matchedKey] || INGREDIENT_IMPACT_DB['default'];
            totalCo2Saved += impact.co2;
            totalWaterSaved += impact.water;
            totalHoursEquivalency += impact.equivalencyFactor;
        });

        totalCo2Saved = +totalCo2Saved.toFixed(1);
        totalHoursEquivalency = Math.round(totalHoursEquivalency);

        try {
            const promptText = `Kamu adalah chef profesional ahli zero-waste. Buatlah SATU resep hidangan yang lezat dengan bahan: ${selectedIngredients.join(', ')}. Wajib mengembalikan respon dalam format JSON objek dengan struktur persis seperti berikut: {"title": "Nama resep", "time": "15 Menit", "difficulty": "Mudah", "zeroWasteTip": "Tips dapur", "steps": [{"tahap": "Tahap 1", "instruksi": "Detail"}]}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: promptText,
                config: { responseMimeType: 'application/json', temperature: 0.3 }
            });

            const recipeData = JSON.parse(response.text);
            setAiRecipe({
                title: recipeData.title,
                time: recipeData.time,
                difficulty: recipeData.difficulty,
                ecoMetrics: {
                    co2Saved: `${totalCo2Saved} kg CO₂`,
                    waterSaved: `${totalWaterSaved} Liter`,
                    impactEquivalency: `Setara mematikan lampu selama ${totalHoursEquivalency} jam`
                },
                zeroWasteTip: recipeData.zeroWasteTip,
                ingredientsUsed: selectedIngredients,
                steps: recipeData.steps
            });
        } catch (error) {
            console.error("Gagal mendapatkan resep dari Gemini:", error);
            if (error.message?.includes("503") || error.status === 503) {
                alert("🤖 Server AI Gemini sedang sibuk menerima lonjakan traffic. Silakan coba klik tombol ramu resep kembali.");
            } else {
                alert("Gagal meramu resep otomatis: " + error.message);
            }
        } finally {
            setIsGeneratingRecipe(false);
        }
    };

    // FUNGSI UTAMA: MENYIMPAN DATA DAMPAK LINGKUNGAN KE FIRESTORE SECARA AMAN
    const handleCompleteCooking = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const dynamicCo2Saved = calculateCurrentCo2Saved(selectedIngredients);
        const itemsToDelete = pantryItems.filter(item => selectedIngredients.includes(item.name));

        try {
            // 1. Hapus bahan masakan dari sub-koleksi
            const deletePromises = itemsToDelete.map(item =>
                deleteDoc(doc(db, "users", currentUser.uid, "bahan makanan", item.id.toString()))
            );
            await Promise.all(deletePromises);

            // 2. Gunakan setDoc + merge: true sebagai pengaman mutlak akumulasi data cloud
            const userDocRef = doc(db, "users", currentUser.uid);
            await setDoc(userDocRef, {
                co2Saved: increment(dynamicCo2Saved),
                itemsSaved: increment(selectedIngredients.length),
                lastCookingAt: new Date()
            }, { merge: true });

            // 3. Reset state form UI
            setSelectedIngredients([]);
            setAiRecipe(null);

            alert(`Selamat! Kamu berhasil memasak tanpa sisa makanan dan mengurangi jejak karbon sebesar ${dynamicCo2Saved} kg CO₂!`);
        } catch (error) {
            console.error("Gagal memperbarui pantry setelah memasak:", error);
            alert("Terjadi kesalahan saat memperbarui data dampak ke database.");
        }
    };

    const handleDeleteItem = async (id) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const itemYangDihapus = pantryItems.find((item) => item.id === id);
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "bahan makanan", id.toString()));
            if (itemYangDihapus) {
                setSelectedIngredients((prevSelected) =>
                    prevSelected.filter((name) => name !== itemYangDihapus.name)
                );
            }
        } catch (error) {
            console.error("Gagal menghapus dari Firestore:", error);
        }
    };

    const [wasteCount, setWasteCount] = useState({ organic: 0, inorganic: 0 });
    const totalWaste = wasteCount.organic + wasteCount.inorganic;
    const organicPercentage = totalWaste > 0 ? Math.round((wasteCount.organic / totalWaste) * 100) : 0;
    const inorganicPercentage = totalWaste > 0 ? Math.round((wasteCount.inorganic / totalWaste) * 100) : 0;

    const classifyWaste = async (e) => {
        e.preventDefault();
        if (!wasteInput.trim()) return;

        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert("Anda harus login untuk mencatat data sampah.");
            return;
        }

        setIsClassifyingWaste(true);
        try {
            const isOrganicKeyword = /kulit|telur|sisa|sayur|buah|bumbu/i.test(wasteInput);
            const categoryResult = isOrganicKeyword ? 'Organik' : 'Anorganik';

            const mockAIResult = {
                category: categoryResult,
                instruction: isOrganicKeyword ? 'Buang ke komposter atau lubang biopori untuk dijadikan pupuk organik.' : 'Bilas jika kotor, kumpulkan, lalu salurkan ke bank sampah terdekat.',
                color: isOrganicKeyword ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200',
                badge: isOrganicKeyword ? 'bg-emerald-500' : 'bg-amber-400'
            };

            setWasteResult(mockAIResult);

            // UPDATE DATA GRAFIK LANGSUNG KE CLOUD FIRESTORE
            const userDocRef = doc(db, "users", currentUser.uid);
            if (categoryResult === 'Organik') {
                await setDoc(userDocRef, {
                    wasteOrganic: increment(1)
                }, { merge: true });
            } else {
                await setDoc(userDocRef, {
                    wasteInorganic: increment(1)
                }, { merge: true });
            }

            setWasteInput('');
        } catch (error) {
            console.error("Gagal menganalisis dan menyimpan data sampah:", error);
            alert("Terjadi kesalahan saat menyimpan data sampah ke cloud.");
        } finally {
            setIsClassifyingWaste(false);
        }
    };

    const handleLogout = async () => {
        if (window.confirm("Apakah Anda yakin ingin keluar dari aplikasi?")) {
            try {
                await signOut(auth);
                navigate('/login');
            } catch (error) {
                console.error("Gagal logout:", error);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">

            <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/30 shadow-lg transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

                    <div className="flex items-center gap-3 cursor-pointer group">

                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center text-white font-bold text-xl shadow-lg transition-all duration-300 group-hover:rotate-12 group-hover:scale-110">E</div>

                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-slate-800">Eco</span>
                            <span className="text-emerald-600">Feast</span>
                        </h1>

                    </div>

                    <div className="flex items-center gap-8">

                        <div className="hidden md:flex items-center gap-8 text-sm font-semibold">

                            <a href="#inventaris" className="relative text-slate-600 hover:text-emerald-600 transition after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-emerald-500 after:transition-all hover:after:w-full">Daftar Inventaris</a>

                            <a href="#resep" className="relative text-slate-600 hover:text-emerald-600 transition after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-emerald-500 after:transition-all hover:after:w-full">AI Asisten</a>

                            <a href="#waste" className="relative text-slate-600 hover:text-emerald-600 transition after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-emerald-500 after:transition-all hover:after:w-full">Pemilahan sampah</a>

                        </div>

                        <div className="hidden md:block w-px h-6 bg-slate-300"></div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-red-400 to-rose-400 text-white font-semibold shadow-md transition-all duration-300 hover:from-red-500 hover:to-rose-500 hover:shadow-lg hover:shadow-red-200 hover:scale-105 active:scale-95"
                        >

                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                                stroke="currentColor"
                                className="w-5 h-5"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3l3-3m0 0l-3-3m3 3H9"
                                />
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-linear-to-br from-emerald-800 to-emerald-950 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between border-slate-200 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:ring-4 hover:ring-emerald-200 hover:shadow-[0_0_30px_rgba(16,185,129,0.30)] hover:-translate-y-1"><div>
                        <span className="bg-emerald-700/50 text-emerald-200 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-600/30">Dashboard EcoFeast</span>
                        <h1 className="text-2xl sm:text-3xl font-bold mt-3 leading-tight">Dapur Minim Sampah, Bumi Lebih Sehat.</h1>
                        <p className="text-emerald-100/80 text-sm mt-2 max-w-xl">Ayo cegah penumpukan sampah makanan di TPA dengan memantau kedaluwarsa bahan masakan secara cerdas bersama AI.</p>
                    </div>
                        <div className="mt-6 flex gap-6 border-t border-emerald-700/40 pt-4">
                            <div>
                                <span className="text-xs text-emerald-200/70 block">CO₂ Diselamatkan</span>
                                <span className="text-2xl font-bold">{co2Saved} kg</span>
                            </div>
                            <div className="border-l border-emerald-700/40 pl-6">
                                <span className="text-xs text-emerald-200/70 block">Total Bahan Makanan Selamat</span>
                                <span className="text-2xl font-bold">{itemsSaved} Bahan</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between border-slate-200 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:ring-4 hover:ring-emerald-200 hover:shadow-[0_0_30px_rgba(16,185,129,0.30)] hover:-translate-y-1">
                        <h3 className="text-sm font-bold text-slate-900  transition-all">Grafik Pengolahan Sampah</h3>

                        <div className="flex items-end justify-center gap-6 h-32 my-4 border-b border-slate-100 pb-1">

                            <div className="flex flex-col items-center gap-2 w-full h-full justify-end">
                                <div
                                    className="bg-emerald-500 w-12 rounded-t-lg transition-all duration-500 ease-out"
                                    style={{ height: `${organicPercentage}%` }}
                                ></div>
                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                    Organik ({organicPercentage}%)
                                </span>
                            </div>

                            <div className="flex flex-col items-center gap-2 w-full h-full justify-end">
                                <div
                                    className="bg-amber-400 w-12 rounded-t-lg transition-all duration-500 ease-out"
                                    style={{ height: `${inorganicPercentage}%` }}
                                ></div>
                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                    Anorganik ({inorganicPercentage}%)
                                </span>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    <div className="lg:col-span-2 space-y-8">

                        <section
                            id="inventaris"
                            className="bg-white rounded-2xl p-6 shadow-sm border-slate-200 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:ring-4 hover:ring-emerald-200 hover:shadow-[0_0_30px_rgba(16,185,129,0.30)] hover:-translate-y-1"
                        >
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Daftar Inventaris Bahan Makanan</h2>
                                    <p className="text-xs text-slate-500">Ketuk bahan makanan untuk mengolahnya menjadi makanan siap santap.</p>
                                </div>
                                <button
                                    onClick={startCamera}
                                    className="group relative overflow-hidden flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-700 text-white font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(16,185,129,0.45)] active:scale-95"
                                >

                                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700"></span>

                                    <span className="relative z-10">
                                        Scan Dengan Kamera
                                    </span>

                                    <FaCamera className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {pantryItems.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleSelectIngredient(item.name)}
                                        className={`p-4 rounded-xl border transition cursor-pointer flex justify-between items-center ${selectedIngredients.includes(item.name)
                                            ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600'
                                            : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                                            }`}
                                    >
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-800">{item.name}</h4>
                                            <span className="text-xs text-slate-400">Tempat: {item.storage}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${item.status === 'danger' ? 'bg-red-50 text-red-700 border border-red-100' :
                                                    item.status === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                        'bg-slate-50 text-slate-600 border border-slate-100'
                                                    }`}>
                                                    {item.daysLeft} Hari Lagi
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item.id);
                                                }}
                                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                                                title="Hapus item"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18"></path>
                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section
                            id="resep"
                            className="bg-white rounded-2xl p-6 shadow-sm border-slate-200 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:ring-4 hover:ring-emerald-200 hover:shadow-[0_0_30px_rgba(16,185,129,0.30)] hover:-translate-y-1"
                        >
                            <h2 className="text-lg font-bold text-slate-900 mb-1">Asisten Memasak AI EcoFeast</h2>
                            <p className="text-xs text-slate-500 mb-4">Sistem AI akan menyusun resep kreatif demi menekan potensi limbah makanan terbuang.</p>

                            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200/60">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Bahan yang Akan Dimasak:</span>
                                {selectedIngredients.length === 0 ? (
                                    <span className="text-sm text-slate-400 italic">Silakan pilih bahan di atas terlebih dahulu.</span>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedIngredients.map((ing, i) => (
                                            //baris ini masih butuh validasi, nanti di di rumah gua lanjudin #azzam
                                            <span key={i} className="bg-white border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-semibold shadow-sm">
                                                {ing}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={generateRecipe}
                                disabled={selectedIngredients.length === 0 || isGeneratingRecipe}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm py-3 px-4 rounded-xl transition shadow-sm flex justify-center items-center"
                            >
                                {isGeneratingRecipe ? 'Kecerdasan AI Sedang Meracik Resep...' : 'Generate Resep Kreatif No-Waste'}
                            </button>

                            {aiRecipe && (
                                <div className="mt-6 border border-emerald-500/20 rounded-2xl bg-linear-to-b from-emerald-50/30 to-white p-5 sm:p-6 shadow-sm animate-fade-in">

                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-slate-100 pb-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-md uppercase track    ing-wider">
                                                Rekomendasi Optimal AI
                                            </span>
                                            <h3 className="text-lg font-bold text-slate-900 mt-1.5">{aiRecipe.title}</h3>
                                            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1 font-medium">
                                                <span>⏱️ {aiRecipe.time}</span>
                                                <span>•</span>
                                                <span>🔥 {aiRecipe.difficulty}</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-900 text-white p-3 rounded-xl text-right shrink-0 shadow-sm w-full sm:w-auto">
                                            <span className="text-[10px] text-slate-400 block font-medium">Eco-Impact Score:</span>
                                            <span className="text-sm font-bold text-emerald-400">-{aiRecipe.ecoMetrics.co2Saved}</span>
                                            <span className="text-[10px] text-slate-300 block border-t border-slate-800 mt-1 pt-1">
                                                💧 {aiRecipe.ecoMetrics.waterSaved} Air Selamat
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-medium shadow-inner">
                                        <span>💡</span>
                                        <span>{aiRecipe.ecoMetrics.impactEquivalency}</span>
                                    </div>

                                    <div className="mt-4 bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex gap-3">
                                        <span className="text-xl shrink-0">🌿</span>
                                        <div>
                                            <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Tips Nol-Limbah Dapur:</h5>
                                            <p className="text-slate-700 text-xs mt-1 leading-relaxed font-medium">{aiRecipe.zeroWasteTip}</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Langkah Pembuatan:</h4>
                                        {aiRecipe.steps.map((step, idx) => (
                                            <div key={idx} className="flex gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition">
                                                <span className="font-bold text-white bg-emerald-600 w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 shadow-sm">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-900 leading-none">{step.tahap}</h5>
                                                    <p className="text-slate-600 text-xs mt-1.5 leading-relaxed">{step.instruksi}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleCompleteCooking}
                                        className="group relative w-full mt-6 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-700 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95"
                                    >

                                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700"></span>

                                        <span className="relative flex items-center justify-center gap-2">
                                            <span className="text-lg transition-transform duration-300 group-hover:scale-125">
                                                ✓
                                            </span>

                                            Saya Selesai Memasak & Habis Tanpa Sisa
                                        </span>
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="lg:col-span-1">
                        <section
                            id="waste"
                            className="bg-white rounded-2xl p-6 shadow-sm sticky top-24 border-slate-200 shadow-sm transition-all duration-300 hover:border-emerald-500 hover:ring-4 hover:ring-emerald-200 hover:shadow-[0_0_30px_rgba(16,185,129,0.30)] hover:-translate-y-1"
                        >
                            <div className="w-10 h-10 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center text-lg mb-3 shadow-sm animate-bounce">♻️</div>
                            <h2 className="text-lg font-bold text-slate-900">Pemilah Sampah Rumah Tangga</h2>
                            <p className="text-xs text-slate-500 mt-1 mb-4">Tanyakan pengelompokan sampah sisa bumbu dapur atau bungkus bahan di sini.</p>

                            <form onSubmit={classifyWaste} className="space-y-3">
                                <input
                                    type="text"
                                    value={wasteInput}
                                    onChange={(e) => setWasteInput(e.target.value)}
                                    placeholder="Contoh: kulit telur, mika plastik..."
                                    className="w-full text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                                />
                                <button
                                    type="submit"
                                    disabled={isClassifyingWaste}
                                    className={`
                                        group relative w-full overflow-hidden rounded-xl py-3 px-4 font-semibold text-white transition-all duration-300
                                        ${isClassifyingWaste
                                            ? "bg-slate-500 cursor-not-allowed"
                                            : "bg-gradient-to-r from-slate-800 via-slate-900 to-black hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(15,23,42,0.35)] active:scale-95"
                                        }
                                    `}
                                >

                                    {!isClassifyingWaste && (
                                        <span className="absolute inset-0-translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                                    )}

                                    <span className="relative flex items-center justify-center gap-3">

                                        {isClassifyingWaste && (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        )}

                                        {isClassifyingWaste
                                            ? "AI Sedang Menganalisis..."
                                            : "Analisis Kategori Sampah"}

                                    </span>
                                </button>
                            </form>

                            {wasteResult && (
                                <div className={`mt-4 p-4 rounded-xl border ${wasteResult.color} text-sm leading-relaxed shadow-sm animate-fade-in`}>
                                    <div className="flex items-center gap-2 font-bold mb-2 text-slate-900">
                                        <span className={`w-2.5 h-2.5 rounded-full ${wasteResult.badge}`}></span>
                                        Kategori: {wasteResult.category}
                                    </div>
                                    <p className="text-slate-700 text-xs leading-relaxed">{wasteResult.instruction}</p>
                                </div>
                            )}
                        </section>
                    </div>

                </div>
            </main>

            {isScanModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
                    <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-scale-up">

                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm">AI Smart Scanner Kamera</h3>
                            <button onClick={stopCamera} className="text-slate-400 hover:text-slate-600 font-bold text-sm transition">✕</button>
                        </div>

                        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />

                            {!isCameraActive && (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-sm px-4">
                                    <div className="mb-3">Menunggu kamera siap...</div>
                                    <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}

                            {isCameraActive && !scannedResult && (
                                <div className="absolute inset-8 border-2 border-dashed border-emerald-400 rounded-xl pointer-events-none opacity-70 animate-pulse flex items-center justify-center">
                                    <span className="text-white text-[10px] bg-black/50 px-2 py-0.5 rounded shadow-sm">Posisikan bahan baku di kotak ini</span>
                                </div>
                            )}

                            {isAnalyzingCamera && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-xs gap-3">
                                    <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="font-semibold tracking-wide">Computer Vision menganalisis objek...</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4">
                            {!scannedResult ? (
                                <button
                                    type="button"
                                    onClick={captureAndAnalyze}
                                    disabled={isAnalyzingCamera || !isCameraActive}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold text-sm transition shadow-sm"
                                >
                                    {isAnalyzingCamera ? 'Membaca Data Gambar...' : 'Ambil Gambar & Pindai'}
                                </button>
                            ) : (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">Terdeteksi Otomatis:</span>
                                        <h4 className="font-bold text-emerald-900 text-base mt-0.5">🥕 {scannedResult.name}</h4>
                                        <p className="text-slate-600 mt-2 leading-relaxed">
                                            AI menyarankan penyimpanan dilakukan di dalam <span className="font-bold text-emerald-800">{scannedResult.detectedStorage}</span>. Bahan makanan ini diprediksi memiliki ketahanan hingga <span className="font-bold text-emerald-800">{scannedResult.predictedExpiryDays} hari</span> sebelum rusak.
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setScannedResult(null)}
                                            className="w-1/3 border border-slate-200 hover:bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-bold transition"
                                        >
                                            Ulangi Foto
                                        </button>
                                        <button
                                            onClick={handleAddToPantry}
                                            className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition shadow-sm"
                                        >
                                            Konfirmasi Masuk Pantry
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}