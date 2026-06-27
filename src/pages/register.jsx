import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Leaf, Recycle } from "lucide-react";
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";


export default function Register() {
    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);


    const handleSubmit = (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            alert("Password tidak sama!");
            return;
        }
    }


        const handleLogin = () => {
            navigate("/login");
        }

        return (
            <div className="min-h-screen bg-gradient-to-br from-green-100 via-slate-100 to-white flex items-center justify-center p-6">
                <div className="w-full max-w-6xl bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden grid lg:grid-cols-2">

                    {/* LEFT */}
                    <div className="hidden lg:flex bg-gradient-to-br from-emerald-600 via-green-800 to-green-900 text-white p-14 flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <Leaf size={34} />
                                <h1 className="text-4xl font-bold">
                                    EcoFeast
                                </h1>
                            </div>
                            <p className="mt-8 text-lg leading-8 text-green-100">
                                Kurangi limbah makanan, bantu sesama,
                                dan ciptakan bumi yang lebih hijau.
                            </p>
                        </div>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <Recycle className="w-10 h-10" />
                                <div>
                                    <h3 className="font-semibold">
                                        Ramah Lingkungan
                                    </h3>
                                    <p className="text-green-100 text-sm">
                                        Bersama kita kurangi food waste.
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-5 border border-white/20">
                                <p className="italic text-green-100">
                                    "Setiap makanan yang terselamatkan adalah
                                    langkah kecil menuju bumi yang lebih baik."
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="p-10 lg:p-14">
                        <h2 className="text-4xl font-bold text-slate-800">
                            Buat Akun
                        </h2>
                        <p className="text-slate-500 mt-2">
                            Bergabung bersama EcoFeast sekarang.
                        </p>
                        
                        <form
                            className="mt-10 space-y-5"
                        >

                            <input
                                type="text"
                                name="name"
                                placeholder="Nama Lengkap"
                                className="w-full rounded-xl border border-slate-300 px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />

                            <input
                                type="email"
                                name="email"
                                placeholder="Email"
                                className="w-full rounded-xl border border-slate-300 px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />

                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="Password"
                                    className="w-full rounded-xl border border-slate-300 px-5 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-green-500"
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

                            <div className="relative">
                                <input
                                    type={
                                        showConfirmPassword
                                            ? "text"
                                            : "password"
                                    }
                                    name="confirmPassword"
                                    placeholder="Konfirmasi Password"
                                    className="w-full rounded-xl border border-slate-300 px-5 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowConfirmPassword(
                                            !showConfirmPassword
                                        )
                                    }
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff size={20} />
                                    ) : (
                                        <Eye size={20} />
                                    )}
                                </button>
                            </div>

                            <button
                                className="w-full rounded-xl bg-green-600 py-3 text-white font-semibold hover:bg-green-700 duration-300"
                                onClick={handleLogin}
                            >
                                Daftar
                            </button>
                        </form>

                        <p className="mt-8 text-center text-slate-500">
                            Sudah punya akun?
                            <button
                                onClick={handleLogin}
                                className="ml-2 text-green-600 font-semibold hover:underline"
                            >
                                Login
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }