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
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden bg-[#0b2a3c]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 10%, rgba(201,131,58,0.35), transparent 45%), radial-gradient(ellipse at 80% 90%, rgba(247,244,239,0.12), transparent 50%), linear-gradient(160deg, #0b2a3c 0%, #123a52 55%, #0b2a3c 100%)",
        }}
      />

      <div className="relative w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img
            src={logoImg}
            alt="Artemis Rental"
            className="h-14 mx-auto object-contain brightness-0 invert"
          />
          <div>
            <h1 className="font-display text-4xl text-[#f7f4ef] tracking-tight">Artemis</h1>
            <p className="text-sm text-[#f7f4ef]/70 mt-1">CRM κρατήσεων · Σίφνος</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-white/15 bg-[#f7f4ef]/95 backdrop-blur px-6 py-6 shadow-2xl"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white"
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
              className="bg-white"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={submitting || loading}
          >
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

        <p className="text-center text-[11px] text-[#f7f4ef]/45">
          Πρόσβαση μόνο για εξουσιοδοτημένο προσωπικό Artemis Rental
        </p>
      </div>
    </div>
  );
}
