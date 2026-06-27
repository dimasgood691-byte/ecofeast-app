import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Leaf, Recycle } from "lucide-react";
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";


export default function Login() {
    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
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

        console.log(formData);

        // Login berhasil (contoh)
        navigate("/dashboard");
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
                        onSubmit={handleSubmit}
                        className="mt-10 space-y-6"
                    >
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