import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Leaf, Recycle } from "lucide-react";
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";


export default function Login() {
    const navigate = useNavigate();


    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    // 1. SATU STATE UTAMA (Hapus state email, password, fullName terpisah yang di atas)
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
    });

    // 2. FUNGSI HANDLER (Sudah benar, tinggal dipakai)
    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value, // Ini mendeteksi atribut 'name' pada tag <input>
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Data yang dikirim:", formData);
    };

    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            console.log(result.user);
            navigate("/dashboard");
        } catch (error) {
            console.error(error);
        }
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();

        if (!formData.email || !formData.password) {
            alert("Email dan password wajib diisi!");
            return;
        }

        try {
            console.log("Mencoba login...");

            // 2. LANGKAH PERTAMA: Coba login dulu
            const userCredential = await signInWithEmailAndPassword(
                auth,
                formData.email,
                formData.password
            );

            console.log("Login Sukses (Akun Lama):", userCredential.user.email);
            navigate('/dashboard');

        } catch (error) {
            // 3. LANGKAH KEDUA: Jika gagal karena akun belum terdaftar, otomatis buatkan akun baru
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                console.log("Akun tidak ditemukan. Membuat akun baru di Firebase...");

                try {
                    const newUserCredential = await createUserWithEmailAndPassword(
                        auth,
                        formData.email,
                        formData.password
                    );

                    console.log("Pendaftaran Otomatis Sukses (Akun Baru):", newUserCredential.user.email);
                    alert("Akun baru berhasil dibuat otomatis! Mengalihkan ke dashboard...");
                    navigate('/dashboard');

                } catch (registerError) {
                    console.error("Gagal membuat akun otomatis:", registerError);
                    // Menangani error pembuatan akun (misal: password kurang dari 6 karakter)
                    if (registerError.code === 'auth/weak-password') {
                        alert('Gagal membuat akun otomatis: Password minimal harus 6 karakter.');
                    } else {
                        alert('Gagal membuat akun baru: ' + registerError.message);
                    }
                }
            } else {
                // Menangani error login selain karena akun tidak ditemukan (misal: salah format email)
                console.error("Proses login error:", error);
                if (error.code === 'auth/invalid-email') {
                    alert('Format email tidak valid.');
                } else {
                    alert('Gagal masuk: ' + error.message);
                }
            }
        }
    };

    // 1. State untuk menyimpan status checkbox (default: false)
    const [rememberMe, setRememberMe] = useState(false);

    // 2. Mengambil data dari localStorage saat halaman pertama kali dimuat (Opsional tapi direkomendasikan)
    useEffect(() => {
        const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
        setRememberMe(savedRememberMe);
    }, []);

    // 3. Fungsi untuk menangani perubahan saat checkbox diklik
    const handleRememberMeChange = (e) => {
        const isChecked = e.target.checked;
        setRememberMe(isChecked);

        // Simpan ke localStorage agar browser "ingat" statusnya
        localStorage.setItem('rememberMe', isChecked);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-100 via-slate-100 to-white flex items-center justify-center p-6">
            <div className="w-full max-w-6xl bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden grid lg:grid-cols-2">

                {/* LEFT */}
                <div className="hidden lg:flex bg-gradient-to-br from-emerald-600 via-green-800 to-green-900 text-white p-14 flex-col justify-between">

                    <div>
                        <div className="flex items-center gap-3">
                            <Leaf size={36} />
                            <h1 className="text-4xl font-bold">
                                EcoFeast
                            </h1>
                        </div>

                        <p className="mt-8 text-lg leading-8 text-green-100">
                            Selamat datang kembali.
                            Mari bersama mengurangi limbah makanan
                            dan menciptakan masa depan yang lebih hijau.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Recycle className="w-10 h-10" />

                            <div>
                                <h3 className="font-semibold">
                                    Save Food, Save Earth
                                </h3>

                                <p className="text-sm text-green-100">
                                    Setiap makanan yang terselamatkan
                                    memberikan dampak bagi bumi.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/10 rounded-xl border border-white/20 p-5">
                            <p className="italic text-green-100">
                                "Small actions today create a greener tomorrow."
                            </p>
                        </div>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="p-10 lg:p-14">

                    <h2 className="text-4xl font-bold text-slate-800">
                        Selamat Datang
                    </h2>

                    <p className="mt-2 text-slate-500">
                        Login untuk melanjutkan ke akun EcoFeast.
                    </p>

                    <form
                        onSubmit={handleLoginSubmit}
                        className="mt-10 space-y-6"
                    >

                        <div>
                            <label className="block mb-2 text-slate-600 font-medium">
                                Nama Lengkap
                            </label>

                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                placeholder="Nama Lengkap"
                                onChange={handleChange}
                                required
                                className="w-full rounded-xl border border-slate-300 px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>

                        <div>
                            <label className="block mb-2 text-slate-600 font-medium">
                                Email
                            </label>

                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Masukkan email"
                                className="w-full rounded-xl border border-slate-300 px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block mb-2 text-slate-600 font-medium">
                                Password
                            </label>

                            <div className="relative">

                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Masukkan password"
                                    className="w-full rounded-xl border border-slate-300 px-5 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                                >
                                    {showPassword ? (
                                        <EyeOff size={20} />
                                    ) : (
                                        <Eye size={20} />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-sm">

                            <label className="flex items-center gap-2 text-slate-600">
                                <input
                                    type="checkbox"
                                    className="accent-green-600"
                                    checked={rememberMe}
                                    onChange={handleRememberMeChange}
                                />
                                Ingat saya
                            </label>

                            <button
                                type="button"
                                className="text-green-600 hover:underline"
                            >
                                Lupa Password?
                            </button>

                        </div>

                        <button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 duration-300 text-white font-semibold py-3 rounded-xl shadow-lg"
                        >
                            Login
                        </button>
                    </form>

                    <div className="mt-8">

                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex-1 border-t border-slate-300"></div>

                            <span className="text-slate-400 text-sm">
                                atau
                            </span>

                            <div className="flex-1 border-t border-slate-300"></div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            className="w-full border border-slate-300 rounded-xl py-3 hover:bg-slate-100 duration-300 font-medium">
                            Login dengan Google
                        </button>

                    </div>

                    <p className="mt-8 text-center text-slate-500">
                        Belum punya akun?

                        <Link
                            to="/register"
                            className="ml-2 text-green-600 font-semibold hover:underline"
                        >
                            Daftar
                        </Link>
                    </p>

                </div>
            </div>
        </div>
    );
}