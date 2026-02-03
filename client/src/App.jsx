import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const InstitutesPage = lazy(() => import('./pages/InstitutesPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'));
const AdminStopwordsPage = lazy(() => import('./pages/AdminStopwordsPage.jsx'));
const TrendsIndex = lazy(() => import('./pages/trends/TrendsIndex.jsx'));
const ChatPage = lazy(() => import('./pages/chat/Chat.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로딩 중…</div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<InstitutesPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/stopwords" element={<ProtectedRoute><AdminStopwordsPage /></ProtectedRoute>} />
          <Route path="/trends/*" element={<TrendsIndex />} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
