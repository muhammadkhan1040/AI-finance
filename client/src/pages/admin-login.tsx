import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, AlertCircle, Info, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/admin/login", { username, password });
      setLocation("/admin");
    } catch (err) {
      setError("Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050818] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/5 border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-400" />
          </div>
          <CardTitle className="text-2xl text-white">Admin Login</CardTitle>
          <CardDescription className="text-blue-200/60">
            Enter your credentials to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm text-blue-200/60">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="bg-white/5 border-white/10 text-white placeholder:text-blue-200/30"
                data-testid="input-admin-username"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-blue-200/60">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="bg-white/5 border-white/10 text-white placeholder:text-blue-200/30 pr-10"
                  data-testid="input-admin-password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-blue-200/60 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-admin-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-2 text-xs text-blue-200/60">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-300 mb-1">Forgot your password?</p>
                <p>Go to the Secrets tab in Replit and update the <code className="bg-white/10 px-1 rounded">ADMIN_USERNAME</code> and <code className="bg-white/10 px-1 rounded">ADMIN_PASSWORD</code> values to reset your credentials.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
