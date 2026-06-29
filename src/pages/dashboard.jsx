import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useNavigate } from 'react-router-dom';
import { signOut } from "firebase/auth";
import { auth } from "../firebase"; // Sesuaikan dengan jalur file konfigurasi Firebase Anda
import { deleteUser } from "firebase/auth";
import.meta.env.VITE_GEMINI_API_KEY

export default function EcoFeastApp() {

    const navigate = useNavigate();
    // ==============================================
    // 1. STATE MANAGEMENT GLOBAL (DIUBAH MENJADI DINAMIS)
    // ==============================================
    // 💡 Diubah: Mengosongkan isi pantry agar client memulai dengan daftar milik mereka sendiri
    const [pantryItems, setPantryItems] = useState([]);

    // 💡 Diubah: Mengubah nilai awal metrik menjadi 0 agar akumulasi dihitung dari awal oleh client
    const [co2Saved, setCo2Saved] = useState(0);
    const [itemsSaved, setItemsSaved] = useState(0);

    // State untuk Generator Resep AI (Tetap sama)
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [aiRecipe, setAiRecipe] = useState(null);
    const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
    const [wasteInput, setWasteInput] = useState('');
    const [wasteResult, setWasteResult] = useState(null);
    const [isClassifyingWaste, setIsClassifyingWaste] = useState(false);
    // State untuk Kontrol Kamera HP (Scanner)
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [scannedResult, setScannedResult] = useState(null);
    const [isAnalyzingCamera, setIsAnalyzingCamera] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);

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
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    alert("Akses Kamera Ditolak! Harap berikan izin kamera pada browser untuk situs ini.");
                } else {
                    alert(`Gagal mengakses kamera: ${err.message}`);
                }
                setIsScanModalOpen(false);
            }
        };

        openCamera();

        return () => {
            cancelled = true;
        };
    }, [isScanModalOpen]);

    // ==============================================
    // 2. LOGIKA & FUNGSI SMART PANTRY & KAMERA
    // ==============================================
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    // ==========================================
    // FUNGSI 1: MEMBUKA KAMERA PERANGKAT
    // ==========================================
    const startCamera = () => {
        setIsScanModalOpen(true);
        setScannedResult(null);
        setIsAnalyzingCamera(false);
    };

    // ==========================================
    // FUNGSI 2: MENJEPRET GAMBAR & ANALISIS AI
    // ==========================================
    const captureAndAnalyze = async (e) => {
        if (e) e.preventDefault(); // Menahan refresh halaman dashboard

        if (!isCameraActive || !videoRef.current) {
            alert("Kamera belum aktif atau belum siap.");
            return;
        }

        setIsAnalyzingCamera(true);

        try {
            // 2. Ambil gambar snapshot dari video menggunakan HTML5 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            // 3. Ubah hasil snapshot ke format base64
            const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

            // 4. Buat instruksi (Prompt) ketat untuk format JSON
            const promptInstructions = `
                Analisis gambar bahan makanan ini. Berikan respons HANYA dalam format JSON mentah berstruktur seperti ini, tanpa penjelasan tambahan lainnya:
                {
                    "name": "Nama bahan makanan hasil deteksianmu dalam Bahasa Indonesia",
                    "detectedStorage": "Kulkas / Freezer / Suhu Ruang",
                    "predictedExpiryDays": 5
                }
            `;

            // 5. Eksekusi pemanggilan ke model Gemini 2.5 Flash
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    promptInstructions,
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64Image
                        }
                    }
                ],
                config: {
                    responseMimeType: "application/json", // Mengunci output wajib JSON murni
                }
            });

            // Membaca teks hasil respon menggunakan properti candidates standar SDK terbaru
            const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log("Balasan Asli Gemini:", responseText);

            if (!responseText) {
                throw new Error("API Gemini gagal memproses gambar atau mengembalikan data kosong.");
            }

            // 6. Bersihkan spasi liar di sekitar JSON string
            const cleanJsonString = responseText.trim();

            // 7. Parsing string bersih menjadi Object Javascript
            let resultJson;
            try {
                resultJson = JSON.parse(cleanJsonString);
            } catch (parseError) {
                console.error("Gagal melakukan parsing JSON. Text asli:", cleanJsonString);
                throw new Error("Format data dari AI terdistorsi. Silakan coba foto ulang.");
            }

            // 8. Update State jika berhasil tanpa kendala
            setScannedResult({
                name: resultJson.name || "Bahan Tidak Dikenali",
                detectedStorage: resultJson.detectedStorage || "Kulkas",
                predictedExpiryDays: Number(resultJson.predictedExpiryDays) || 3
            });

        } catch (err) {
            console.error("Detail Error Sistem Scan AI:", err);
            alert(`Gagal memproses gambar: ${err.message}`);
        } finally {
            // Animasi loading pemindaian dimatikan baik saat sukses maupun gagal
            setIsAnalyzingCamera(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        setIsAnalyzingCamera(false);
        setIsScanModalOpen(false);
    };

    const toggleSelectIngredient = (name) => {
        setSelectedIngredients((prev) =>
            prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
        );
    };

    const handleAddToPantry = () => {
        if (!scannedResult?.name) return;

        const normalizedName = scannedResult.name.toLowerCase();
        const existing = pantryItems.some((item) => item.name.toLowerCase() === normalizedName);

        if (!existing) {
            const newItem = {
                id: Date.now(),
                name: scannedResult.name,
                daysLeft: scannedResult.predictedExpiryDays,
                status:
                    scannedResult.predictedExpiryDays <= 2
                        ? 'danger'
                        : scannedResult.predictedExpiryDays <= 5
                            ? 'warning'
                            : 'safe',
                storage: scannedResult.detectedStorage,
            };

            setPantryItems((prev) => [newItem, ...prev]);
            setItemsSaved((prev) => prev + 1);
        }

        stopCamera();
        setScannedResult(null);
        alert(`${scannedResult.name} berhasil ditambahkan ke pantry.`);
    };

    // ==============================================
    // 3. LOGIKA & FUNGSI GENERATOR RESEP AI
    // ==============================================
    // ==============================================================
    // DATABASE EMISI & AIR PER BAHAN (Perkiraan Dampak Food Waste)
    // ==============================================================
    const INGREDIENT_IMPACT_DB = {
        'dada ayam': { co2: 1.2, water: 350, equivalencyFactor: 8 },
        'bayam organik': { co2: 0.2, water: 40, equivalencyFactor: 1.5 },
        'tomat ceri': { co2: 0.3, water: 30, equivalencyFactor: 2 },
        'bawang bombay': { co2: 0.1, water: 20, equivalencyFactor: 0.5 },
        'default': { co2: 0.2, water: 30, equivalencyFactor: 1.5 }
    };

    // Fungsi pembantu untuk menghitung total CO2 dari bahan yang dipilih
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

    // 1. FUNGSI GENERATE RECIPE
    const generateRecipe = () => {
        if (selectedIngredients.length === 0) return;
        setIsGeneratingRecipe(true);

        // Hitung dampak secara dinamis berdasarkan bahan pilihan saat ini
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

        setTimeout(() => {
            setAiRecipe({
                title: "Eco-Stir Fry Premium (Kreasi Anti-Mubazir)",
                time: "12 Menit",
                difficulty: "Sangat Mudah",
                ecoMetrics: {
                    co2Saved: `${totalCo2Saved} kg CO₂`,
                    waterSaved: `${totalWaterSaved} Liter`,
                    impactEquivalency: `Setara mematikan lampu selama ${totalHoursEquivalency} jam`
                },
                zeroWasteTip: "Jangan buang batang bayam atau bonggol bawang! Iris tipis-tipis dan tumis di awal bersama bawang untuk memberikan tekstur renyah kaya serat.",
                ingredientsUsed: selectedIngredients,
                steps: [
                    {
                        tahap: "Persiapan Bahan Pintar",
                        instruksi: `Ambil bahan pilihanmu: ${selectedIngredients.join(', ')}. Cuci bersih. Jika ayam agak beku, rendam wadahnya di air dingin (jangan air mengalir untuk hemat air).`
                    },
                    {
                        tahap: "Ekstraksi Aroma No-Waste",
                        instruksi: "Panaskan 1 sendok makan minyak kelapa/sawit. Tumis irisan tipis bawang bombay beserta kulit ari terdalamnya yang bersih hingga mengalami karamelisasi ringan."
                    },
                    {
                        tahap: "Pemasakan Protein Efisien",
                        instruksi: "Masukkan potongan Dada Ayam. Masak dengan api sedang selama 4 menit hingga warnanya berubah memutih dan mengunci saripati dagingnya."
                    },
                    {
                        tahap: "Flash-Cooking Sayuran",
                        instruksi: "Masukkan Tomat Ceri (belah dua agar jusnya keluar menjadi saus alami) dan Bayam Organik. Besarkan api, tumis cepat selama maksimal 2 menit agar warna hijau klorofil dan vitaminnya tidak rusak."
                    }
                ]
            });
            setIsGeneratingRecipe(false);
        }, 1800);
    };

    // 2. FUNGSI COMPLETE COOKING
    const handleCompleteCooking = () => {
        // Hitung persis berapa CO2 yang diselamatkan dari bahan-bahan yang aktif diolah saat ini
        const dynamicCo2Saved = calculateCurrentCo2Saved(selectedIngredients);

        // Kurangi bahan yang dimasak dari pantry dan update dashboard dampak
        setPantryItems(pantryItems.filter(item => !selectedIngredients.includes(item.name)));

        // Tambahkan nilai dinamis ke akumulasi data CO2 global dashboard
        setCo2Saved(prev => +(prev + dynamicCo2Saved).toFixed(1));

        // Tambahkan juga jumlah item yang berhasil diselamatkan ke metric dashboard kamu
        setItemsSaved(prev => prev + selectedIngredients.length);

        setSelectedIngredients([]);
        setAiRecipe(null);
        alert(`Selamat! Kamu berhasil memasak tanpa sisa makanan dan mengurangi jejak karbon sebesar ${dynamicCo2Saved} kg CO₂!`);
    };

    // ==============================================
    // 4. LOGIKA & FUNGSI PEMILAH SAMPAH AI
    // ==============================================


    const handleDeleteItem = (id) => {
        // 1. Perbarui state pantryItems dengan membuang item yang dipilih
        setPantryItems((prevItems) => prevItems.filter((item) => item.id !== id));

        // 2. Opsional: Hapus juga dari daftar bahan yang sedang dipilih (selectedIngredients) 
        // agar sinkron jika item yang dihapus kebetulan sedang dalam kondisi 'terpilih'
        const itemYangDihapus = pantryItems.find((item) => item.id === id);
        if (itemYangDihapus) {
            setSelectedIngredients((prevSelected) =>
                prevSelected.filter((name) => name !== itemYangDihapus.name)
            );
        }
    };

    // realtime grafik rasio pengolahan sampah
    // STATE BARU: Menyimpan total hitungan sampah yang sudah dianalisis
    const [wasteCount, setWasteCount] = useState({
        organic: 0,    // Nilai default awal (biar grafik tidak kosong di awal)
        inorganic: 0   // Sesuaikan dengan rasio awal 70% dan 30%
    });

    // 3. LOGIKA KALKULASI: Menghitung persentase secara otomatis
    const totalWaste = wasteCount.organic + wasteCount.inorganic;
    const organicPercentage = totalWaste > 0 ? Math.round((wasteCount.organic / totalWaste) * 100) : 0;
    const inorganicPercentage = totalWaste > 0 ? Math.round((wasteCount.inorganic / totalWaste) * 100) : 0;

    const classifyWaste = async (e) => {
        e.preventDefault();
        if (!wasteInput.trim()) return;

        setIsClassifyingWaste(true);

        try {
            // --- SIMULASI ATAU HIT KE API AI ANDA ---
            // Di sini saya asumsikan AI mengembalikan data kategori "Organik" atau "Anorganik"
            // Contoh dummy response:
            const isOrganicKeyword = /kulit|telur|sisa|sayur|buah|bumbu/i.test(wasteInput);

            const mockAIResult = {
                category: isOrganicKeyword ? 'Organik' : 'Anorganik',
                instruction: isOrganicKeyword
                    ? 'Buang ke komposter atau lubang biopori untuk dijadikan pupuk organik.'
                    : 'Bilas jika kotor, kumpulkan, lalu salurkan ke bank sampah terdekat.',
                color: isOrganicKeyword ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200',
                badge: isOrganicKeyword ? 'bg-emerald-500' : 'bg-amber-400'
            };
            // ----------------------------------------

            setWasteResult(mockAIResult);

            // LOGIKA UPDATE GRAFIK: Tambahkan +1 ke kategori yang sesuai hasil AI
            setWasteCount((prev) => {
                if (mockAIResult.category === 'Organik') {
                    return { ...prev, organic: prev.organic + 1 };
                } else {
                    return { ...prev, inorganic: prev.inorganic + 1 };
                }
            });

            setWasteInput(''); // Reset input text field
        } catch (error) {
            console.error("Gagal menganalisis sampah:", error);
        } finally {
            setIsClassifyingWaste(false);
        }
    };

    // function untuk logout
    const handleLogout = async () => {
        // Berikan konfirmasi yang jelas karena aksi ini menghapus akun selamanya
        const konfirmasi = window.confirm(
            "Apakah Anda yakin ingin MENGHAPUS AKUN ini secara permanen dari sistem?"
        );

        if (konfirmasi) {
            try {
                // 2. Ambil data pengguna yang sedang login saat ini
                const currentUser = auth.currentUser;

                if (currentUser) {
                    console.log("Sedang menghapus akun:", currentUser.email);

                    // 3. KUNCI UTAMA: Hapus akun secara permanen dari Firebase Authentication
                    await deleteUser(currentUser);

                    alert("Akun Anda telah berhasil dihapus secara permanen.");

                    // 4. Alihkan kembali ke halaman login
                    navigate('/login');
                } else {
                    alert("Tidak ada sesi pengguna aktif yang ditemukan.");
                    navigate('/login');
                }
            } catch (error) {
                console.error("Gagal menghapus akun:", error);

                // Firebase melarang penghapusan akun jika user sudah login terlalu lama (keamanan)
                if (error.code === 'auth/requires-recent-login') {
                    alert("Sesi Anda telah kedaluwarsa demi keamanan. Silakan keluar, masuk kembali, lalu coba hapus akun lagi.");
                } else {
                    alert("Terjadi kesalahan: " + error.message);
                }
            }
        }
    };  
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">

            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                    {/* LOGO ECOFEAST */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">E</div>
                        <span className="text-xl font-bold tracking-tight text-slate-900">Eco<span className="text-emerald-600">Feast</span></span>
                    </div>

                    {/* MENU & TOMBOL LOGOUT */}
                    <div className="flex items-center gap-6">
                        {/* Link Navigasi Menu */}
                        <div className="hidden sm:flex gap-6 text-sm font-medium text-slate-600">
                            <a href="#pantry" className="text-emerald-600 hover:text-emerald-700 transition">Smart Pantry</a>
                            <a href="#resep" className="hover:text-emerald-600 transition">AI Recipe</a>
                            <a href="#waste" className="hover:text-emerald-600 transition">Waste Classifier</a>
                        </div>

                        {/* Garis Pembatas Vertikal Ringan (Hanya muncul di layar sm ke atas) */}
                        <span className="hidden sm:block h-5 w-px bg-slate-200" aria-hidden="true"></span>

                        {/* TOMBOL LOGOUT BARU */}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition duration-200"
                            title="Keluar dari akun"
                        >
                            {/* SVG Ikon Logout (Pintu Keluar) */}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                            </svg>
                            <span>Keluar</span>
                        </button>
                    </div>

                </div>
            </nav>

            {/* MAIN CONTAINER */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* HERO SECTION & METRICS DASHBOARD */}
                <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-linear-to-br from-emerald-800 to-emerald-950 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between">
                        <div>
                            <span className="bg-emerald-700/50 text-emerald-200 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-600/30">Dampak Lingkunganmu</span>
                            <h1 className="text-2xl sm:text-3xl font-bold mt-3 leading-tight">Dapur Minim Sampah, Bumi Lebih Sehat.</h1>
                            <p className="text-emerald-100/80 text-sm mt-2 max-w-xl">Ayo cegah penumpukan sampah makanan di TPA dengan memantau kedaluwarsa bahan masakan secara cerdas bersama AI.</p>
                        </div>
                        <div className="mt-6 flex gap-6 border-t border-emerald-700/40 pt-4">
                            <div>
                                <span className="text-xs text-emerald-200/70 block">CO₂ Diselamatkan</span>
                                <span className="text-2xl font-bold">{co2Saved} kg</span>
                            </div>
                            <div className="border-l border-emerald-700/40 pl-6">
                                <span className="text-xs text-emerald-200/70 block">Total Bahan Selamat</span>
                                <span className="text-2xl font-bold">{itemsSaved} Bahan</span>
                            </div>
                        </div>
                    </div>

                    {/* REALISTIC LIVE BAR CHART SIMULATION */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Rasio Pengolahan Sampah</h3>

                        {/* Box Container Grafik dengan tinggi statis h-32 */}
                        <div className="flex items-end justify-center gap-6 h-32 my-4 border-b border-slate-100 pb-1">

                            {/* Batang Organik */}
                            <div className="flex flex-col items-center gap-2 w-full h-full justify-end">
                                <div
                                    className="bg-emerald-500 w-12 rounded-t-lg transition-all duration-500 ease-out"
                                    style={{ height: `${organicPercentage}%` }} // Tinggi dinamis %
                                ></div>
                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                    Organik ({organicPercentage}%)
                                </span>
                            </div>

                            {/* Batang Anorganik */}
                            <div className="flex flex-col items-center gap-2 w-full h-full justify-end">
                                <div
                                    className="bg-amber-400 w-12 rounded-t-lg transition-all duration-500 ease-out"
                                    style={{ height: `${inorganicPercentage}%` }} // Tinggi dinamis %
                                ></div>
                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                    Anorganik ({inorganicPercentage}%)
                                </span>
                            </div>

                        </div>
                    </div>
                </div>

                {/* INTERACTIVE WORKSPACE GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* COLUMN 1 & 2: PANTRY AND RECIPE GENERATOR */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* PANTRY MANAGEMENT COMPONENT */}
                        <section id="pantry" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Daftar Inventaris Pantry</h2>
                                    <p className="text-xs text-slate-500">Ketuk bahan makanan untuk mengolahnya menjadi makanan siap santap.</p>
                                </div>
                                <button
                                    onClick={startCamera}
                                    //dari sini
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-2"
                                >
                                    <span>📷 Scan via Kamera HP</span>
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

                        {/* AI COOKING EXPERT (RECIPE GENERATOR) */}
                        <section id="resep" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
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

                            {/* TAMPILAN RESEP HASIL OLAHAN AI (PREMIUM VIEW) */}
                            {aiRecipe && (
                                <div className="mt-6 border border-emerald-500/20 rounded-2xl bg-linear-to-b from-emerald-50/30 to-white p-5 sm:p-6 shadow-sm animate-fade-in">

                                    {/* Header Resep */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-slate-100 pb-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                                Rekomendasi Optimal AI
                                            </span>
                                            <h3 className="text-lg font-bold text-slate-900 mt-1.5">{aiRecipe.title}</h3>
                                            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1 font-medium">
                                                <span>⏱️ {aiRecipe.time}</span>
                                                <span>•</span>
                                                <span>🔥 {aiRecipe.difficulty}</span>
                                            </div>
                                        </div>

                                        {/* Target Pencapaian Masak */}
                                        <div className="bg-slate-900 text-white p-3 rounded-xl text-right shrink-0 shadow-sm w-full sm:w-auto">
                                            <span className="text-[10px] text-slate-400 block font-medium">Eco-Impact Score:</span>
                                            <span className="text-sm font-bold text-emerald-400">-{aiRecipe.ecoMetrics.co2Saved}</span>
                                            <span className="text-[10px] text-slate-300 block border-t border-slate-800 mt-1 pt-1">
                                                💧 {aiRecipe.ecoMetrics.waterSaved} Air Selamat
                                            </span>
                                        </div>
                                    </div>

                                    {/* Green Equivalency Badge */}
                                    <div className="mt-3 bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-medium shadow-inner">
                                        <span>💡</span>
                                        <span>{aiRecipe.ecoMetrics.impactEquivalency}</span>
                                    </div>

                                    {/* AI Zero-Waste Tips Box */}
                                    <div className="mt-4 bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex gap-3">
                                        <span className="text-xl shrink-0">🌿</span>
                                        <div>
                                            <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Tips Nol-Limbah Dapur:</h5>
                                            <p className="text-slate-700 text-xs mt-1 leading-relaxed font-medium">{aiRecipe.zeroWasteTip}</p>
                                        </div>
                                    </div>

                                    {/* Alur Langkah Memasak Dinamis */}
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

                                    {/* Action Selesai */}
                                    <button
                                        onClick={handleCompleteCooking}
                                        className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3 rounded-xl transition shadow-md tracking-wide"
                                    >
                                        ✓ Saya Selesai Memasak & Habis Tanpa Sisa
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* COLUMN 3: SIDEBAR AI WASTE CLASSIFIER */}
                    <div className="lg:col-span-1">
                        <section id="waste" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm sticky top-24">
                            <div className="w-10 h-10 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center text-lg mb-3 shadow-sm">♻️</div>
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
                                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 px-4 rounded-xl transition shadow-sm"
                                >
                                    {isClassifyingWaste ? 'Analisis AI Sedang Berjalan...' : 'Analisis Kategori Sampah'}
                                </button>
                            </form>

                            {/* OUTCOMES DARI ANALYSIS SAMPAH */}
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

            {/* ==============================================
        5. MODAL COMPONENT WINDOW: REAL CAMERA INPUT 
         ============================================== */}
            {isScanModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
                    <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-scale-up">

                        {/* Modal Top Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm">AI Smart Scanner Kamera</h3>
                            <button onClick={stopCamera} className="text-slate-400 hover:text-slate-600 font-bold text-sm transition">✕</button>
                        </div>

                        {/* Video Live Streaming Viewfinder */}
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

                            {/* Target Area Outline overlay */}
                            {isCameraActive && !scannedResult && (
                                <div className="absolute inset-8 border-2 border-dashed border-emerald-400 rounded-xl pointer-events-none opacity-70 animate-pulse flex items-center justify-center">
                                    <span className="text-white text-[10px] bg-black/50 px-2 py-0.5 rounded shadow-sm">Posisikan bahan baku di kotak ini</span>
                                </div>
                            )}
                            {/* Running Analysis AI Spinners Overlay */}
                            {isAnalyzingCamera && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-xs gap-3">
                                    <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="font-semibold tracking-wide">Computer Vision menganalisis objek...</p>
                                </div>
                            )}
                        </div>

                        {/* Bottom Form Control Panel */}
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
                                /* IF DETECTED SUCCESS */
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