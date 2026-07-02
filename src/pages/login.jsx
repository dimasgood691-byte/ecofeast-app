import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Leaf, Recycle } from "lucide-react";
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { sendPasswordResetEmail } from "firebase/auth";
import { motion } from "framer-motion";
import { image } from "framer-motion/client";
import logo from "../assets/logo.png";


export default function Login() {
    const navigate = useNavigate();


    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
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

            const userCredential = await signInWithEmailAndPassword(
                auth,
                formData.email,
                formData.password
            );

            console.log("Login Sukses (Akun Lama):", userCredential.user.email);
            navigate('/dashboard');

        } catch (error) {
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
                    if (registerError.code === 'auth/weak-password') {
                        alert('Gagal membuat akun otomatis: Password minimal harus 6 karakter.');
                    } else {
                        alert('Gagal membuat akun baru: ' + registerError.message);
                    }
                }
            } else {
                console.error("Proses login error:", error);
                if (error.code === 'auth/invalid-email') {
                    alert('Format email tidak valid.');
                } else {
                    alert('Gagal masuk: ' + error.message);
                }
            }
        }
    };

    const [rememberMe, setRememberMe] = useState(false);

    useEffect(() => {
        const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
        setRememberMe(savedRememberMe);
    }, []);

    const handleRememberMeChange = (e) => {
        const isChecked = e.target.checked;
        setRememberMe(isChecked);

        localStorage.setItem('rememberMe', isChecked);
    };

    const handleForgotPassword = async () => {
        if (!formData.email) {
            alert("Silakan masukkan email Anda pada kolom input terlebih dahulu untuk mengirimkan link reset password.");
            return;
        }

        const konfirmasi = window.confirm(`Kirim email berisi link reset password ke ${formData.email}?`);

        if (konfirmasi) {
            try {
                await sendPasswordResetEmail(auth, formData.email);

                alert(`Email reset password berhasil dikirim! Silakan periksa kotak masuk (atau folder spam) pada email: ${formData.email}`);
            } catch (error) {
                console.error("Gagal mengirim email reset password:", error);

                switch (error.code) {
                    case 'auth/invalid-email':
                        alert('Format email tidak valid.');
                        break;
                    case 'auth/user-not-found':
                        alert('Email ini tidak terdaftar di sistem kami.');
                        break;
                    default:
                        alert('Gagal mengirim email reset: ' + error.message);
                }
            }
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-100 via-slate-100 to-white flex items-center justify-center p-6">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-green-300 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-400 rounded-full blur-3xl opacity-20 animate-pulse"></div>

            <motion.div initial={{ opacity: 0, x: -80 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="w-full max-w-6xl bg-white/60 backdrop-blur-2xl rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.2)] border border-white/40 overflow-hidden grid lg:grid-cols-2 transition-all duration-500 hover:scale-[1.01]">
                <div className="hidden lg:flex bg-gradient-to-br from-emerald-600 via-green-800 to-green-900 text-white p-14 flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <Leaf size={36} className="animate-bounce" />
                            <h1 className="text-4xl font-bold">
                                EcoFeast
                            </h1>
                        </div>

                        <p className="mt-8 text-lg leading-8 text-green-100">
                            Selamat datang di EcoFeast.
                            Mari bersama mengurangi limbah makanan
                            dan menciptakan masa depan yang lebih hijau.
                        </p>
                    </div>

                    {/* GAMBAR DI TENGAH */}
                    <div className="flex justify-center my-8">

                        <img
                            src={logo}
                            alt="EcoFeast"
                          className="w-64 h-64 object-contain drop-shadow-2xl transition-all duration-500 hover:scale-110"/>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Recycle className="w-10 h-10 animate-bounce" />

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

                        <div className="bg-white/10 rounded-xl border border-white/20 p-5 trasition-all duration-500 hover:bg-white/20 hover:scale-105 hover:translate-y-2">
                            <p className="italic text-green-100">
                                "Small actions today create a greener tomorrow."
                            </p>
                        </div>
                    </div>
                </div>

                <motion.div initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="p-10 lg:p-14">

                    <h2 className="text-4xl font-bold leading-tight pb-1 bg-gradient-to-r from-green-700 to-emerald-500 bg-clip-text text-transparent">
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
                                className="w-full rounded-xl border border-slate-300 px-5 py-3 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-600 hover:border-green-400"
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
                                required
                                className="w-full rounded-xl border border-slate-300 px-5 py-3 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-600 hover:border-green-400"
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
                                    required
                                    className="w-full rounded-xl border border-slate-300 px-5 py-3 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-green-200 focus:border-green-600 hover:border-green-400"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-all duration-300 hover:text-green-600 hover:scale-125"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-sm">

                            <label className="flex items-center gap-2 text-slate-600">
                                <input
                                    type="checkbox"
                                    className="accent-green-600"
                                    checked={rememberMe}
                                    onChange={handleRememberMeChange} />
                                Ingat saya
                            </label>

                            <button
                                type="button"
                                className="relative text-slate-600 hover:text-emerald-600 transition after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-emerald-500 after:transition-all hover:after:w-full"
                                onClick={handleForgotPassword}>
                                Lupa Password?
                            </button>

                        </div>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 rounded-xl shadow-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] hover:scale-105 active:scale-95"
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
                            className="w-full border border-slate-300 rounded-xl py-3 font-medium transition-all duration-300 hover:bg-white hover:shadow-lg hover:-translate-y-1"
                        >
                            Login dengan Google
                        </button>

                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}