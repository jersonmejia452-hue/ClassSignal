import { lazy, Suspense } from 'react'
import { Navigate, Outlet, createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AppProviders } from './AppProviders'
import { RequireProfessor } from '../components/auth/RequireProfessor'
import { ProfessorLayout } from '../components/layout/ProfessorLayout'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { RouteErrorPage } from '../pages/RouteErrorPage'

const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
)
const DashboardPage = lazy(() =>
  import('../pages/professor/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const NewCoursePage = lazy(() =>
  import('../pages/professor/NewCoursePage').then((module) => ({
    default: module.NewCoursePage,
  })),
)
const CourseDetailPage = lazy(() =>
  import('../pages/professor/CourseDetailPage').then((module) => ({
    default: module.CourseDetailPage,
  })),
)
const LoginPage = lazy(() =>
  import('../pages/professor/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
)
const NewSessionPage = lazy(() =>
  import('../pages/professor/NewSessionPage').then((module) => ({
    default: module.NewSessionPage,
  })),
)
const SessionDetailPage = lazy(() =>
  import('../pages/professor/SessionDetailPage').then((module) => ({
    default: module.SessionDetailPage,
  })),
)
const SessionPresentationPage = lazy(() =>
  import('../pages/professor/SessionPresentationPage').then((module) => ({
    default: module.SessionPresentationPage,
  })),
)
const JoinSessionPage = lazy(() =>
  import('../pages/student/JoinSessionPage').then((module) => ({
    default: module.JoinSessionPage,
  })),
)
const StudentSessionPage = lazy(() =>
  import('../pages/student/StudentSessionPage').then((module) => ({
    default: module.StudentSessionPage,
  })),
)

function RootProviders() {
  return (
    <AppProviders>
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </AppProviders>
  )
}

const router = createBrowserRouter([
  {
    element: <RootProviders />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/unirse" />,
      },
      {
        path: 'profesor/login',
        element: <LoginPage />,
      },
      {
        element: <RequireProfessor />,
        children: [
          {
            path: 'profesor/sesion/:id/presentar',
            element: <SessionPresentationPage />,
          },
          {
            path: 'profesor',
            element: <ProfessorLayout />,
            children: [
              {
                index: true,
                element: <DashboardPage />,
              },
              {
                path: 'cursos/nuevo',
                element: <NewCoursePage />,
              },
              {
                path: 'curso/:courseId',
                element: <CourseDetailPage />,
              },
              {
                path: 'curso/:courseId/sesion/nueva',
                element: <NewSessionPage />,
              },
              {
                path: 'sesiones/nueva',
                element: <NewSessionPage />,
              },
              {
                path: 'sesion/:id',
                element: <SessionDetailPage />,
              },
            ],
          },
        ],
      },
      {
        path: 'unirse',
        element: <JoinSessionPage />,
      },
      {
        path: 's/:code',
        element: <StudentSessionPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
