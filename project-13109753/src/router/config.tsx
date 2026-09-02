import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AboutPage from "../pages/about/page";
import PrivacyPolicyPage from "../pages/privacy-policy/page";
import AffiliateDisclosurePage from "../pages/affiliate-disclosure/page";
import DisclaimerPage from "../pages/disclaimer/page";
import ArticlePage from "../pages/article/page";
import DestinationPage from "../pages/destination/page";
import PublicArticlesPage from "../pages/blog/page";
import SignupPage from "../pages/signup/page";
import LoginPage from "../pages/login/page";
import NewExperiencePage from "../pages/experiences/new/page";
import ExperienceDetailPage from "../pages/experiences/detail/page";
import ExperiencesPage from "../pages/experiences/page";
import MyTripPage from "../pages/my-trip/page";
import PublicTripsPage from "../pages/trips/page";
import PublicTripDetailPage from "../pages/trips/detail/page";
import { AdminAuthProvider } from "../pages/admin/components/AdminAuth";
import AdminLayout from "../pages/admin/components/AdminLayout";
import DashboardPage from "../pages/admin/dashboard/page";
import ArticlesPage from "../pages/admin/articles/page";
import NewArticlePage from "../pages/admin/articles/new/page";
import EditArticlePage from "../pages/admin/articles/edit/page";
import ContentPage from "../pages/admin/content/page";
import FeaturedPage from "../pages/admin/featured/page";
import UsersPage from "../pages/admin/users/page";
import CreatorProfilePage from "../pages/creator/page";
import RegionPage from "../pages/region/page";
import PrefecturePage from "../pages/prefecture/page";
import NewGuidePage from "../pages/guides/new/page";
import GuidesPage from "../pages/guides/page";
import GuideDetailPage from "../pages/guides/detail/page";
import SharePage from "../pages/share/page";
import ExplorePage from "../pages/explore/page";
import CreatorsHomePage from "../pages/creators/page";
import CreatorDashboardPage from "../pages/creators/dashboard/page";
import NewRecommendedTripPage from "../pages/creators/trips/new/page";
import WriteTravelogueePage from "../pages/creators/guides/write/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/about",
    element: <AboutPage />,
  },
  {
    path: "/privacy-policy",
    element: <PrivacyPolicyPage />,
  },
  {
    path: "/affiliate-disclosure",
    element: <AffiliateDisclosurePage />,
  },
  {
    path: "/disclaimer",
    element: <DisclaimerPage />,
  },
  {
    path: "/admin",
    element: (
      <AdminAuthProvider>
        <AdminLayout />
      </AdminAuthProvider>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "articles",
        element: <ArticlesPage />,
      },
      {
        path: "articles/new",
        element: <NewArticlePage />,
      },
      {
        path: "articles/:id/edit",
        element: <EditArticlePage />,
      },
      {
        path: "content",
        element: <ContentPage />,
      },
      {
        path: "featured",
        element: <FeaturedPage />,
      },
      {
        path: "users",
        element: <UsersPage />,
      },
    ],
  },
  {
    path: "/destinations/:id",
    element: <DestinationPage />,
  },
  {
    path: "/blog",
    element: <PublicArticlesPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/experiences/new",
    element: <NewExperiencePage />,
  },
  {
    path: "/experiences/:id",
    element: <ExperienceDetailPage />,
  },
  {
    path: "/experiences",
    element: <ExperiencesPage />,
  },
  {
    path: "/trips",
    element: <PublicTripsPage />,
  },
  {
    path: "/trips/:id",
    element: <PublicTripDetailPage />,
  },
  {
    path: "/my-trip",
    element: <MyTripPage />,
  },
  {
    path: "/creator/:userId",
    element: <CreatorProfilePage />,
  },
  {
    path: "/regions/:slug",
    element: <RegionPage />,
  },
  {
    path: "/prefectures/:name",
    element: <PrefecturePage />,
  },
  {
    path: "/guides/new",
    element: <NewGuidePage />,
  },
  {
    path: "/guides/:id",
    element: <GuideDetailPage />,
  },
  {
    path: "/guides",
    element: <GuidesPage />,
  },
  {
    path: "/share",
    element: <SharePage />,
  },
  {
    path: "/explore",
    element: <ExplorePage />,
  },
  {
    path: "/creators",
    element: <CreatorsHomePage />,
  },
  {
    path: "/creators/dashboard",
    element: <CreatorDashboardPage />,
  },
  {
    path: "/creators/trips/new",
    element: <NewRecommendedTripPage />,
  },
  {
    path: "/creators/guides/write",
    element: <WriteTravelogueePage />,
  },
  {
    path: "/:category/:articleSlug",
    element: <ArticlePage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
