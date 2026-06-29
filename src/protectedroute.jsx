// src/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const ProtectedRoute = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const auth = getAuth();

    useEffect(() => {
        // Mengecek status login user dari Firebase secara real-time
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth]);

    // Tampilkan loading screen sebentar saat Firebase sedang mengecek status user
    if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

    // Jika user tidak ada (belum login), tendang ke halaman /login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Jika sudah login, izinkan mengakses halaman di dalamnya (children)
    return children;
};

export default ProtectedRoute;