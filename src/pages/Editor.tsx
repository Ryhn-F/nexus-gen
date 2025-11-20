import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, Download, Sparkles, ArrowLeft, Trash2 } from "lucide-react";
import { removeBackground } from "@/lib/backgroundRemoval";
import { User } from "@supabase/supabase-js";

const Editor = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<"fast" | "quality">("fast");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchCredits(session.user.id);
    };
    checkAuth();
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
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setEditedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!originalImage || !user) return;

    if (credits < 1) {
      toast.error("Insufficient credits! You need 1 credit for background removal.");
      return;
    }

    setProcessing(true);

    try {
      // Create image element
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = originalImage;
      });

      // Process with AI
      const result = await removeBackground(img, mode);
      
      // Convert blob to data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(result);
      });

      setEditedImage(dataUrl);

      // Deduct credits
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ credits: credits - 1 })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Save to edits history
      await supabase.from("edits").insert({
        user_id: user.id,
        original_image_url: originalImage,
        edited_image_url: dataUrl,
        edit_type: "background_removal",
        credits_used: 1,
      });

      setCredits((prev) => prev - 1);
      toast.success("Background removed successfully!");
    } catch (error: any) {
      console.error("Error removing background:", error);
      toast.error(error.message || "Failed to remove background");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!editedImage) return;

    const link = document.createElement("a");
    link.href = editedImage;
    link.download = `no-bg-${Date.now()}.png`;
    link.click();
    toast.success("Image downloaded!");
  };

  const handleReset = () => {
    setOriginalImage(null);
    setEditedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="hover:bg-card/50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-cyber flex items-center justify-center shadow-glow-cyan">
                <Sparkles className="w-5 h-5 text-background" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-cyber bg-clip-text text-transparent">
                Background Removal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50">
            <span className="text-sm font-medium">
              <span className="text-primary font-bold">{credits}</span> Credits
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Controls */}
          <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="border-border/50"
                  disabled={processing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </Button>

                {originalImage && !editedImage && (
                  <>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setMode("fast")}
                        variant={mode === "fast" ? "default" : "outline"}
                        size="sm"
                        className={mode === "fast" ? "bg-gradient-cyber" : ""}
                      >
                        Fast Mode
                      </Button>
                      <Button
                        onClick={() => setMode("quality")}
                        variant={mode === "quality" ? "default" : "outline"}
                        size="sm"
                        className={mode === "quality" ? "bg-gradient-cyber" : ""}
                      >
                        Quality Mode
                      </Button>
                    </div>

                    <Button
                      onClick={handleRemoveBackground}
                      disabled={processing || credits < 1}
                      className="bg-gradient-cyber hover:shadow-glow-cyan"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Remove Background (1 Credit)
                        </>
                      )}
                    </Button>
                  </>
                )}

                {editedImage && (
                  <>
                    <Button
                      onClick={handleDownload}
                      className="bg-gradient-cyber hover:shadow-glow-cyan"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="border-border/50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      New Image
                    </Button>
                  </>
                )}
              </div>

              {originalImage && !editedImage && (
                <div className="text-sm text-muted-foreground">
                  {mode === "fast" ? "⚡ 2-5 seconds" : "✨ 5-10 seconds"}
                </div>
              )}
            </div>
          </Card>

          {/* Image Display */}
          {!originalImage ? (
            <Card className="p-12 backdrop-blur-xl bg-card/80 border-border/50 border-dashed">
              <div className="text-center space-y-4">
                <Upload className="w-16 h-16 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-lg font-medium">Upload an image to get started</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Remove backgrounds from any image with AI
                  </p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-cyber hover:shadow-glow-cyan"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Image
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Image */}
              <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
                <h3 className="text-lg font-semibold mb-4">Original</h3>
                <div className="rounded-lg overflow-hidden bg-muted/50 border border-border/50">
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-auto"
                  />
                </div>
              </Card>

              {/* Edited Image or Placeholder */}
              <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
                <h3 className="text-lg font-semibold mb-4">Edited</h3>
                {processing ? (
                  <div className="rounded-lg overflow-hidden bg-muted/50 border border-border/50 aspect-square flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                      <p className="text-muted-foreground">
                        Removing background...
                      </p>
                    </div>
                  </div>
                ) : editedImage ? (
                  <div className="rounded-lg overflow-hidden bg-muted/50 border border-border/50">
                    <img
                      src={editedImage}
                      alt="Edited"
                      className="w-full h-auto"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden bg-muted/50 border border-border/50 aspect-square flex items-center justify-center">
                    <p className="text-muted-foreground">
                      Click "Remove Background" to start
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Editor;
