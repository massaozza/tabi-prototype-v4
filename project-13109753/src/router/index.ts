import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import routes from "./config";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });

  // TABI 3.0：SPOTページ等に遷移した際、前のページのスクロール位置が
  // 引き継がれ、ページの途中から表示されてしまう問題への対応。
  // パス（画面）が変わったタイミングで、常にページ最上部へ戻す。
  // 同じページ内でのハッシュ内リンク（#section等）による移動は
  // 妨げないよう、hashが無い遷移のみを対象にする。
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return element;
}
