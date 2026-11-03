import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import logoImg from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { ALLOWED_ADMIN_EMAIL } from "@/lib/auth";

const HERO_IMAGE = "https://rentacarsifnos.com/images/brand/hero-sifnos.jpg";

export default function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState(ALLOWED_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-16">
        <img src={logoImg} alt="Artemis Rental" className="h-9 w-auto self-start object-contain dark:brightness-0 dark:invert" />

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-foreground">Καλώς ήρθατε</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Συνδεθείτε για να δείτε τις σημερινές παραλαβές, τις κρατήσεις και τα αιτήματα από το site.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl text-[15px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Κωδικός
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl pr-12 text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-[15px] font-semibold"
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

            <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Πρόσβαση μόνο για εξουσιοδοτημένο προσωπικό Artemis Rental
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Artemis Rental · Απολλωνία, Σίφνος · από το 1988</p>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b2a3c]/80 via-[#0b2a3c]/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Artemis CRM</p>
          <p className="mt-2 max-w-md text-3xl font-bold leading-tight tracking-tight">
            Στόλος, κρατήσεις και τιμές, σε ένα μέρος.
          </p>
        </div>
      </div>
    </div>
  );
}
