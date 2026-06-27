import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useNavigate } from 'react-router-dom';

export default function EcoFeastApp() {

    const navigate = useNavigate();
    // ==============================================
    // 1. STATE MANAGEMENT GLOBAL
    // ==============================================
    const [pantryItems, setPantryItems] = useState([
        { id: 1, name: 'Bayam Organik', daysLeft: 2, status: 'warning', storage: 'Kulkas' },
        { id: 2, name: 'Dada Ayam', daysLeft: 1, status: 'danger', storage: 'Freezer' },
        { id: 3, name: 'Tomat Ceri', daysLeft: 5, status: 'safe', storage: 'Kulkas' },
        { id: 4, name: 'Bawang Bombay', daysLeft: 12, status: 'safe', storage: 'Suhu Ruang' },
    ]);

    // State untuk Dashboard Metrics
    const [co2Saved, setCo2Saved] = useState(4.8);  
    const [itemsSaved, setItemsSaved] = useState(12);

    // State untuk Generator Resep AI
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [aiRecipe, setAiRecipe] = useState(null);
    const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);

    // State untuk Pemilah Sampah AI
    const [wasteInput, setWasteInput] = useState('');
    const [wasteResult, setWasteResult] = useState(null);

    // State untuk Kontrol Kamera HP (Scanner)
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [scannedResult, setScannedResult] = useState(null);
    const [isAnalyzingCamera, setIsAnalyzingCamera] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);

    // ==============================================
    // 2. LOGIKA & FUNGSI SMART PANTRY & KAMERA
    // ==============================================
    // 1. PINDAHKAN INISIALISASI INI KE BAGIAN PALING ATAS FILE (DI LUAR FUNGSI KOMPONEN REACT)
    const ai = new GoogleGenAI({ apiKey: "AIzaSyAtF19HDg9XNVF0iSOf0Ngo_vCHRCLHA7Y" });

    // ... Di dalam komponen EcoFeast kamu ...
    // ==========================================
    // FUNGSI 1: MEMBUKA KAMERA PERANGKAT
    // ==========================================
    const startCamera = async () => {
        setIsScanModalOpen(true);
        setIsCameraActive(false);
        setScannedResult(null);

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Browser tidak mendukung atau tidak mengizinkan kamera.");
            }

            // Membuka kamera belakang HP (environment)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            // Berikan jeda sedikit agar elemen <video> sempat muncul di DOM React
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    if (streamRef) streamRef.current = stream;
                    setIsCameraActive(true);
                } else {
                    // Proteksi jika ref gagal terikat, matikan kamera agar tidak hang
                    stream.getTracks().forEach(track => track.stop());
                    alert("Gagal menghubungkan kamera ke jendela tampilan UI.");
                }
            }, 300);

        } catch (err) {
            console.error("Gagal membuka kamera perangkat: ", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                alert("Akses Kamera Ditolak! Harap berikan izin kamera pada browser untuk situs ini.");
            } else {
                alert(`Gagal mengakses kamera: ${err.message}`);
            }
            setIsScanModalOpen(false);
        }
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

    // ==============================================
    // 3. LOGIKA & FUNGSI GENERATOR RESEP AI
    // ==============================================
    const generateRecipe = () => {
        if (selectedIngredients.length === 0) return;
        setIsGeneratingRecipe(true);

        // Simulasi respons super detail dari Generative AI (Gemini API Structured Output)
        setTimeout(() => {
            setAiRecipe({
                title: "Eco-Stir Fry Premium (Kreasi Anti-Mubazir)",
                time: "12 Menit",
                difficulty: "Sangat Mudah",
                ecoMetrics: {
                    co2Saved: "1.6 kg CO₂",
                    waterSaved: "450 Liter", // Air yang dihemat dari pencegahan food waste daging/sayur
                    impactEquivalency: "Setara mematikan lampu selama 12 jam"
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

    const handleCompleteCooking = () => {
        // Kurangi bahan yang dimasak dari pantry dan update dashboard dampak
        setPantryItems(pantryItems.filter(item => !selectedIngredients.includes(item.name)));
        setCo2Saved(prev => +(prev + 1.4).toFixed(1));
        setSelectedIngredients([]);
        setAiRecipe(null);
        alert("Selamat! Kamu berhasil memasak tanpa sisa makanan dan mengurangi jejak karbon.");
    };

    // ==============================================
    // 4. LOGIKA & FUNGSI PEMILAH SAMPAH AI
    // ==============================================
    const classifyWaste = (e) => {
        e.preventDefault();
        if (!wasteInput) return;

        const text = wasteInput.toLowerCase();
        if (text.includes('kulit') || text.includes('tulang') || text.includes('sisa') || text.includes('daun')) {
            setWasteResult({
                category: 'Organik (Hijau)',
                color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                badge: 'bg-emerald-500',
                instruction: 'Masukkan sisa ini ke dalam komposter. Dapat membusuk alami dan diolah menjadi pupuk tanaman masakanmu berikutnya!'
            });
        } else {
            setWasteResult({
                category: 'Anorganik / Daur Ulang',
                color: 'bg-amber-50 text-amber-800 border-amber-200',
                badge: 'bg-amber-400',
                instruction: 'Bilas sisa minyak atau kotoran yang menempel, keringkan, lalu pisahkan ke kantong daur ulang untuk disetor ke Bank Sampah terdekat.'
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">

            {/* NAVIGATION BAR */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">E</div>
                        <span className="text-xl font-bold tracking-tight text-slate-900">Eco<span className="text-emerald-600">Feast</span></span>
                    </div>
                    <div className="flex gap-6 text-sm font-medium text-slate-600">
                        <a href="#pantry" className="text-emerald-600 hover:text-emerald-700 transition">Smart Pantry</a>
                        <a href="#resep" className="hover:text-emerald-600 transition">AI Recipe</a>
                        <a href="#waste" className="hover:text-emerald-600 transition">Waste Classifier</a>
                    </div>
                </div>
            </nav>

            {/* MAIN CONTAINER */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* HERO SECTION & METRICS DASHBOARD */}
                <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-gradient-to-br from-emerald-800 to-emerald-950 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between">
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
                        <div className="flex items-end justify-center gap-6 h-28 my-3">
                            <div className="flex flex-col items-center gap-2 w-full">
                                <div className="bg-emerald-500 w-12 rounded-t-lg h-20 transition-all duration-500"></div>
                                <span className="text-xs font-medium text-slate-500">Organik (70%)</span>
                            </div>
                            <div className="flex flex-col items-center gap-2 w-full">
                                <div className="bg-amber-400 w-12 rounded-t-lg h-10 transition-all duration-500"></div>
                                <span className="text-xs font-medium text-slate-500">Anorganik (30%)</span>
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
                                        <div className="text-right">
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${item.status === 'danger' ? 'bg-red-50 text-red-700 border border-red-100' :
                                                item.status === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                    'bg-slate-50 text-slate-600 border border-slate-100'
                                                }`}>
                                                {item.daysLeft} Hari Lagi
                                            </span>
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
                                <div className="mt-6 border border-emerald-500/20 rounded-2xl bg-gradient-to-b from-emerald-50/30 to-white p-5 sm:p-6 shadow-sm animate-fade-in">

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
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-4 rounded-xl transition shadow-sm"
                                >
                                    Analisis Kategori Sampah
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
                            {isCameraActive && (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
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