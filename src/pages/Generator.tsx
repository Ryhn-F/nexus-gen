import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, LogOut, CreditCard, History, Image as ImageIcon } from "lucide-react";
import { User, Session } from "@supabase/supabase-js";

const Generator = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [prompt, setPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCredits, setFetchingCredits] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [numImages, setNumImages] = useState(1);
  const [style, setStyle] = useState("auto");
  const [historyImages, setHistoryImages] = useState<any[]>([]);

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

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistoryImages(data || []);
    } catch (error: any) {
      console.error("Error fetching history:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const creditsRequired = numImages;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (credits < creditsRequired) {
      toast.error("Insufficient credits! Please top up to continue.");
      return;
    }

    setLoading(true);
    setGeneratedImages([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { 
          prompt,
          aspectRatio,
          numImages,
          style
        },
      });

      if (error) {
        if (error.message?.includes("402") || error.message?.includes("Insufficient credits")) {
          throw new Error("Insufficient credits");
        }
        throw error;
      }

      if (data?.imageUrls && data.imageUrls.length > 0) {
        setGeneratedImages(data.imageUrls);
        setCredits((prev) => Math.max(0, prev - creditsRequired));
        toast.success(`${data.imageUrls.length} image(s) generated successfully!`);
        fetchHistory();
      } else {
        throw new Error("No images returned");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  const promptIdeas = [
    "A cyberpunk cityscape at night with neon lights",
    "A mystical forest with glowing mushrooms",
    "A futuristic robot in a desert landscape",
    "An ethereal cosmic nebula with stars"
  ];

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
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-4xl font-bold bg-gradient-cyber bg-clip-text text-transparent">
              Create Stunning AI Images
            </h2>
            <p className="text-muted-foreground text-lg">
              Describe your vision and watch it come to life
            </p>
          </div>

          <Tabs defaultValue="generate" className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-card/50 backdrop-blur-sm">
              <TabsTrigger value="generate" className="data-[state=active]:bg-gradient-cyber">
                <ImageIcon className="w-4 h-4 mr-2" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-gradient-cyber">
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel - Controls */}
                <div className="lg:col-span-1 space-y-4">
                  <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Aspect Ratio</Label>
                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                          <SelectTrigger className="bg-input border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1:1">1:1 Square</SelectItem>
                            <SelectItem value="16:9">16:9 Landscape</SelectItem>
                            <SelectItem value="9:16">9:16 Portrait</SelectItem>
                            <SelectItem value="3:2">3:2 Classic</SelectItem>
                            <SelectItem value="2:3">2:3 Portrait</SelectItem>
                            <SelectItem value="4:3">4:3 Standard</SelectItem>
                            <SelectItem value="3:4">3:4 Portrait</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Style</Label>
                        <Select value={style} onValueChange={setStyle}>
                          <SelectTrigger className="bg-input border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="photorealistic">Photorealistic</SelectItem>
                            <SelectItem value="anime">Anime</SelectItem>
                            <SelectItem value="digital-art">Digital Art</SelectItem>
                            <SelectItem value="3d-render">3D Render</SelectItem>
                            <SelectItem value="oil-painting">Oil Painting</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Number of Images</Label>
                        <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))}>
                          <SelectTrigger className="bg-input border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Image</SelectItem>
                            <SelectItem value="2">2 Images</SelectItem>
                            <SelectItem value="3">3 Images</SelectItem>
                            <SelectItem value="4">4 Images</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="pt-4 border-t border-border/50">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Credits Required:</span>
                          <span className="text-primary font-bold text-lg">{creditsRequired}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Panel - Prompt & Output */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50 shadow-glow-cyan">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Your Prompt</Label>
                        <Textarea
                          placeholder="A futuristic city at sunset with neon lights..."
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          className="min-h-32 bg-input border-border/50 focus:border-primary transition-all resize-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          {promptIdeas.map((idea, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              onClick={() => setPrompt(idea)}
                              className="text-xs border-border/50 hover:border-primary"
                            >
                              {idea.slice(0, 30)}...
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleGenerate}
                        disabled={loading || credits < creditsRequired}
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
                            Generate {numImages} Image{numImages > 1 ? 's' : ''}
                          </>
                        )}
                      </Button>

                      {credits < creditsRequired && (
                        <p className="text-sm text-destructive text-center">
                          Insufficient credits! You need {creditsRequired} but have {credits}.
                        </p>
                      )}
                    </div>
                  </Card>

                  {/* Output Area */}
                  {(generatedImages.length > 0 || loading) && (
                    <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
                      {loading ? (
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted/50 border border-border/50 flex items-center justify-center">
                          <div className="text-center space-y-4">
                            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                            <p className="text-muted-foreground">
                              Crafting your masterpiece...
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className={`grid gap-4 ${numImages === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {generatedImages.map((img, idx) => (
                            <div key={idx} className="rounded-lg overflow-hidden bg-muted/50 border border-border/50">
                              <img
                                src={img}
                                alt={`Generated ${idx + 1}`}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
                {historyImages.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No generation history yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Start generating images to see them here
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {historyImages.map((item) => (
                      <div key={item.id} className="group relative rounded-lg overflow-hidden bg-muted/50 border border-border/50 hover:border-primary transition-all">
                        <img
                          src={item.image_url}
                          alt={item.prompt}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-xs text-white line-clamp-2">{item.prompt}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.aspect_ratio} • {item.style}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Generator;
