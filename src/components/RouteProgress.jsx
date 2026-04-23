import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import './RouteProgress.css';

NProgress.configure({
  minimum: 0.15,
  speed: 300,
  trickleSpeed: 120,
  showSpinner: false,
});

export default function RouteProgress() {
  const location = useLocation();

  useEffect(() => {
    NProgress.start();
    const timer = setTimeout(() => NProgress.done(), 150);
    return () => {
      clearTimeout(timer);
      NProgress.done();
    };
  }, [location.pathname]);

  return null;
}
