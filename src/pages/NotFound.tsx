import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: ", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <h1 className="font-display text-5xl mb-3 text-primary">404</h1>
        <p className="text-muted-foreground mb-6">Η σελίδα δεν βρέθηκε.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Επιστροφή στο CRM
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
