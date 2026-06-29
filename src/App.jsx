import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/dashboard';
import Login from './pages/login';
import ProtectedRoute from './ProtectedRoute'; // <-- 1. Import ProtectedRoute

function App() {
    return (
        <Router>
            <Routes>
                {/* Halaman Publik */}
                <Route path="/login" element={<Login />} />

                {/* Halaman Terproteksi (Hanya bisa diakses jika sudah login) */}
                <Route 
                    path="/dashboard" 
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    } 
                />

                {/* Redirect jika route tidak ditemukan */}
                {/* Bagus juga jika diarahkan ke /login sebagai default landing */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;