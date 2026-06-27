import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/dashboard';
import Login from './pages/login';
import Register from './pages/register';


// Note: Sidebar dan StatCard biasanya dipanggil di dalam komponen Page 
// atau di dalam sebuah Layout component.

function App() {

    return (
        <Router>
            <Routes>
                {/* Halaman Publik */}
                <Route path="/register" element={<Register />} />

                <Route path="/login" element={<Login />} />

                {/* Halaman Terproteksi */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Redirect jika route tidak ditemukan */}
                <Route path="*" element={<Navigate to="/register" replace />} />
            </Routes>
        </Router>
    );
}

export default App;