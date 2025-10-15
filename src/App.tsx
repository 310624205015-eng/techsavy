import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminProvider } from './contexts/AdminContext';
import UserDashboard from './pages/UserDashboard';
import EventDetail from './pages/EventDetail';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminRegistrations from './pages/AdminRegistrations';
import AdminAttendance from './pages/AdminAttendance';
import AttendancePage from './pages/AttendancePage';

function App() {
  return (
    <AdminProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UserDashboard />} />
          <Route path="/event/:eventId" element={<EventDetail />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/registrations" element={<AdminRegistrations />} />
          <Route path="/admin/attendance" element={<AdminAttendance />} />
          <Route path="/attendance/:regCode" element={<AttendancePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminProvider>
  );
}

export default App;
