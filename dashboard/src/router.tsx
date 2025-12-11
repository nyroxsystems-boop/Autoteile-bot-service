import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import App from './AppRoot';
import OrderDetailPage from './pages/OrderDetailPage';
import OrdersListPage from './pages/OrdersListPage';
import OverviewPage from './pages/OverviewPage';
import AuthPage from './pages/AuthPage';
import { AuthProvider, RequireAuth } from './auth/AuthContext';
import WwsPage from './features/wws/WwsPage';

const Providers = () => (
  <AuthProvider>
    <Outlet />
  </AuthProvider>
);

const routes = [
  {
    element: <Providers />,
    children: [
      { path: '/auth', element: <AuthPage /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <App />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'orders', element: <OrdersListPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          { path: 'wws', element: <WwsPage /> },
          { path: '*', element: <Navigate to='/' replace /> }
        ]
      },
      { path: '*', element: <Navigate to="/auth" replace /> }
    ]
  }
];

const router = createBrowserRouter(routes);

export default router;
