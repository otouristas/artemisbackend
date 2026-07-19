import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import logoImg from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { ALLOWED_ADMIN_EMAIL } from "@/lib/auth";

export default function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState(ALLOWED_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Artemis Rental" className="h-12 mx-auto object-contain" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Artemis Rental</h1>
            <p className="text-sm text-muted-foreground">Διαχείριση κρατήσεων · Σίφνος</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Κωδικός</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting || loading}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Σύνδεση…
              </>
            ) : (
              "Σύνδεση"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
