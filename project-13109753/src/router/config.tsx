import type { RouteObject } from "react-router-dom";
import { Navigate, useParams } from "react-router-dom";
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
import MyTripDetailPage from "../pages/my-trip/detail/page";
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
import AdminTripsPage from "../pages/admin/trips/page";
import AdminExperiencesPage from "../pages/admin/experiences/page";
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
import NewExperiencePageJa from "../pages/creators/experiences/new/page";
import LanguageWrapper from "../components/feature/LanguageWrapper";

// ルートのデフォルト言語へリダイレクト（英語）
// 将来的にはブラウザ言語を検出してリダイレクト先を変更できる

const routes: RouteObject[] = [
  // ── ルート：英語にリダイレクト ──
  {
    path: "/",
    element: <Navigate to="/en" replace />,
  },

  // ── 言語付きTravelerルート ──
  {
    path: "/:lang",
    element: <LanguageWrapper />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "trips",
        element: <PublicTripsPage />,
      },
      {
        path: "trips/:id",
        element: <PublicTripDetailPage />,
      },
      {
        path: "experiences",
        element: <ExperiencesPage />,
      },
      {
        path: "experiences/:id",
        element: <ExperienceDetailPage />,
      },
      {
        path: "explore",
        element: <ExplorePage />,
      },
      {
        path: "destinations/:id",
        element: <DestinationPage />,
      },
      {
        path: "guides",
        element: <GuidesPage />,
      },
      {
        path: "guides/:id",
        element: <GuideDetailPage />,
      },
      {
        path: "regions/:slug",
        element: <RegionPage />,
      },
      {
        path: "prefectures/:name",
        element: <PrefecturePage />,
      },
      {
        path: "creator/:userId",
        element: <CreatorProfilePage />,
      },
      {
        path: "blog",
        element: <PublicArticlesPage />,
      },
      {
        path: "about",
        element: <AboutPage />,
      },
      {
        path: ":category/:articleSlug",
        element: <ArticlePage />,
      },
    ],
  },

  // ── 旧URLからのリダイレクト（ブックマーク保護）──
  { path: "/trips", element: <Navigate to="/en/trips" replace /> },
  { path: "/trips/:id", element: <LegacyTripRedirect /> },
  { path: "/experiences", element: <Navigate to="/en/experiences" replace /> },
  { path: "/experiences/:id", element: <LegacyExperienceRedirect /> },
  { path: "/explore", element: <Navigate to="/en/explore" replace /> },
  { path: "/blog", element: <Navigate to="/en/blog" replace /> },
  { path: "/about", element: <Navigate to="/en/about" replace /> },
  { path: "/destinations/:id", element: <LegacyDestinationRedirect /> },
  { path: "/creator/:userId", element: <LegacyCreatorRedirect /> },
  { path: "/regions/:slug", element: <LegacyRegionRedirect /> },
  { path: "/prefectures/:name", element: <LegacyPrefectureRedirect /> },
  { path: "/guides", element: <Navigate to="/en/guides" replace /> },
  { path: "/guides/:id", element: <LegacyGuideRedirect /> },

  // ── 言語prefixなし（Creator / Auth / Admin / MyTrip）──
  {
    path: "/admin",
    element: (
      <AdminAuthProvider>
        <AdminLayout />
      </AdminAuthProvider>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "articles", element: <ArticlesPage /> },
      { path: "articles/new", element: <NewArticlePage /> },
      { path: "articles/:id/edit", element: <EditArticlePage /> },
      { path: "content", element: <ContentPage /> },
      { path: "featured", element: <FeaturedPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "trips", element: <AdminTripsPage /> },
      { path: "experiences", element: <AdminExperiencesPage /> },
    ],
  },
  { path: "/signup", element: <SignupPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/share", element: <SharePage /> },
  { path: "/my-trip", element: <MyTripPage /> },
  { path: "/my-trip/:id", element: <MyTripDetailPage /> },
  { path: "/creators", element: <CreatorsHomePage /> },
  { path: "/creators/dashboard", element: <CreatorDashboardPage /> },
  { path: "/creators/trips/new", element: <NewRecommendedTripPage /> },
  { path: "/creators/guides/write", element: <WriteTravelogueePage /> },
  { path: "/creators/experiences/new", element: <NewExperiencePageJa /> },
  { path: "/privacy-policy", element: <PrivacyPolicyPage /> },
  { path: "/affiliate-disclosure", element: <AffiliateDisclosurePage /> },
  { path: "/disclaimer", element: <DisclaimerPage /> },

  { path: "*", element: <NotFound /> },
];

// 旧URL → /en/{path} へリダイレクトするコンポーネント群
function LegacyTripRedirect() {
  const { id } = useParams();
  return <Navigate to={`/en/trips/${id}`} replace />;
}
function LegacyExperienceRedirect() {
  const { id } = useParams();
  return <Navigate to={`/en/experiences/${id}`} replace />;
}
function LegacyDestinationRedirect() {
  const { id } = useParams();
  return <Navigate to={`/en/destinations/${id}`} replace />;
}
function LegacyCreatorRedirect() {
  const { userId } = useParams();
  return <Navigate to={`/en/creator/${userId}`} replace />;
}
function LegacyRegionRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/en/regions/${slug}`} replace />;
}
function LegacyPrefectureRedirect() {
  const { name } = useParams();
  return <Navigate to={`/en/prefectures/${name}`} replace />;
}
function LegacyGuideRedirect() {
  const { id } = useParams();
  return <Navigate to={`/en/guides/${id}`} replace />;
}

export default routes;
