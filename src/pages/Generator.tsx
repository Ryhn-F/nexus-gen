import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, LogOut, CreditCard } from "lucide-react";
import { User, Session } from "@supabase/supabase-js";

const Generator = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingCredits, setFetchingCredits] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        } else {
          // Fetch credits when user is authenticated
          setTimeout(() => {
            fetchCredits(session.user.id);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchCredits(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchCredits = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setCredits(data?.credits || 0);
    } catch (error: any) {
      console.error("Error fetching credits:", error);
      toast.error("Failed to fetch credits");
    } finally {
      setFetchingCredits(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (credits < 1) {
      toast.error("Insufficient credits! Please top up to continue.");
      return;
    }

    setLoading(true);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt },
      });

      if (error) {
        if (error.message?.includes("402") || error.message?.includes("Insufficient credits")) {
          throw new Error("Insufficient credits");
        }
        throw error;
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setCredits((prev) => Math.max(0, prev - 1));
        toast.success("Image generated successfully!");
      } else {
        throw new Error("No image returned");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user || fetchingCredits) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-dark">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-cyber flex items-center justify-center shadow-glow-cyan">
              <Sparkles className="w-5 h-5 text-background" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-cyber bg-clip-text text-transparent">
              NexusGen
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                <span className="text-primary font-bold">{credits}</span> Credits
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-border/50 hover:border-primary transition-all"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold bg-gradient-cyber bg-clip-text text-transparent">
              Create Stunning AI Images
            </h2>
            <p className="text-muted-foreground text-lg">
              Describe your vision and watch it come to life
            </p>
          </div>

          <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50 shadow-glow-cyan">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Your Prompt
                </label>
                <Textarea
                  placeholder="A futuristic city at sunset with neon lights..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-32 bg-input border-border/50 focus:border-primary transition-all resize-none"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading || credits < 1}
                className="w-full bg-gradient-cyber hover:shadow-glow-cyan transition-all duration-300 h-12 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Image
                  </>
                )}
              </Button>

              {credits < 1 && (
                <p className="text-sm text-destructive text-center">
                  You're out of credits. Top up to continue creating!
                </p>
              )}
            </div>
          </Card>

          {/* Output Area */}
          {(generatedImage || loading) && (
            <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted/50 border border-border/50 flex items-center justify-center">
                {loading ? (
                  <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">
                      Crafting your masterpiece...
                    </p>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full h-full object-contain"
                  />
                ) : null}
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Generator;
