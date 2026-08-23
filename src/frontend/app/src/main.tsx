import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import AppShell from '@/components/AppShell';
import RouteErrorPage from '@/components/RouteErrorPage';
import { fileRouteLoader } from '@/routes/fileRouteLoader';
import '@/styles/app.css';

const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    ErrorBoundary: RouteErrorPage,
    children: [
      {
        index: true,
        lazy: async () => {
          const module = await import('@/routes/HomePage');
          return { Component: module.default };
        },
      },
      {
        path: 'files/*',
        loader: fileRouteLoader,
        lazy: async () => {
          const module = await import('@/routes/FileRoute');
          return { Component: module.default };
        },
      },
      {
        path: '*',
        lazy: async () => {
          const module = await import('@/routes/NotFoundPage');
          return { Component: module.default };
        },
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
