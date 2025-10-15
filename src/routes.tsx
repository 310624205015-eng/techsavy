import { createBrowserRouter } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminRegistrations from './pages/AdminRegistrations';
import AdminAttendance from './pages/AdminAttendance';
import EventDetail from './pages/EventDetail';
import UserDashboard from './pages/UserDashboard';
import AttendancePage from './pages/AttendancePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <UserDashboard />,
  },
  {
    path: '/event/:eventId',
    element: <EventDetail />,
  },
  {
    path: '/admin',
    element: <AdminLogin />,
  },
  {
    path: '/admin/dashboard',
    element: <AdminDashboard />,
  },
  {
    path: '/admin/registrations',
    element: <AdminRegistrations />,
  },
  {
    path: '/admin/attendance',
    element: <AdminAttendance />,
  },
  {
    path: '/attendance/:regCode',
    element: <AttendancePage />,
  },
]);