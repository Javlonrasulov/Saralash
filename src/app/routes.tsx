import React from 'react';
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { SaralashProvider } from './store/saralash-store';
import { Dashboard } from './pages/Dashboard';
import { Warehouse } from './pages/Warehouse';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { StreetObjects } from './pages/StreetObjects';
import { Sales } from './pages/Sales';
import { Expenses } from './pages/Expenses';
import { Statistics } from './pages/Statistics';
import { SystemUsers } from './pages/SystemUsers';
import { RequireRoute } from './components/RequireRoute';

function Root() {
  return (
    <SaralashProvider>
      <Layout />
    </SaralashProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      {
        index: true,
        element: (
          <RequireRoute routeKey="dashboard">
            <Dashboard />
          </RequireRoute>
        ),
      },
      {
        path: 'warehouse',
        element: (
          <RequireRoute routeKey="warehouse">
            <Warehouse />
          </RequireRoute>
        ),
      },
      {
        path: 'sales',
        element: (
          <RequireRoute routeKey="sales">
            <Sales />
          </RequireRoute>
        ),
      },
      {
        path: 'customers',
        element: (
          <RequireRoute routeKey="customers">
            <Customers />
          </RequireRoute>
        ),
      },
      {
        path: 'suppliers',
        element: (
          <RequireRoute routeKey="suppliers">
            <Suppliers />
          </RequireRoute>
        ),
      },
      {
        path: 'street-objects',
        element: (
          <RequireRoute routeKey="streetObjects">
            <StreetObjects />
          </RequireRoute>
        ),
      },
      {
        path: 'expenses',
        element: (
          <RequireRoute routeKey="expenses">
            <Expenses />
          </RequireRoute>
        ),
      },
      {
        path: 'statistics',
        element: (
          <RequireRoute routeKey="statistics">
            <Statistics />
          </RequireRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireRoute routeKey="users">
            <SystemUsers />
          </RequireRoute>
        ),
      },
    ],
  },
]);
