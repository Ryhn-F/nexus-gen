import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("User authenticated:", user.id);

    // Check credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      throw new Error("Failed to fetch profile");
    }

    console.log("User has credits:", profile.credits);

    // Get prompt and parameters from request
    const { prompt, aspectRatio = "1:1", numImages = 1, style = "auto" } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error("Invalid prompt");
    }

    const creditsRequired = numImages;
    if (profile.credits < creditsRequired) {
      console.log("Insufficient credits for user:", user.id);
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Generating", numImages, "image(s) for prompt:", prompt);

    // Enhance prompt with style
    let enhancedPrompt = prompt;
    if (style !== "auto") {
      const stylePrompts: Record<string, string> = {
        photorealistic: "photorealistic, highly detailed, 8k resolution",
        anime: "anime style, vibrant colors, clean lines",
        "digital-art": "digital art, concept art, artstation trending",
        "3d-render": "3D render, octane render, realistic materials",
        "oil-painting": "oil painting style, impressionist, artistic brushstrokes"
      };
      enhancedPrompt = `${prompt}, ${stylePrompts[style] || ""}`;
    }

    // Generate multiple images
    const imageUrls: string[] = [];
    
    for (let i = 0; i < numImages; i++) {
      console.log(`Generating image ${i + 1}/${numImages}`);
      
      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: enhancedPrompt,
              },
            ],
            modalities: ["image", "text"],
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI API error:", aiResponse.status, errorText);
        
        if (aiResponse.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (aiResponse.status === 402) {
          throw new Error("AI service credits exhausted. Please contact support.");
        }
        
        throw new Error("Failed to generate image");
      }

      const aiData = await aiResponse.json();
      console.log(`AI response received for image ${i + 1}`);

      const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageUrl) {
        console.error("No image URL in response:", JSON.stringify(aiData));
        throw new Error("No image generated");
      }

      imageUrls.push(imageUrl);

      // Save to history
      await supabase.from("generations").insert({
        user_id: user.id,
        prompt: prompt,
        image_url: imageUrl,
        aspect_ratio: aspectRatio,
        style: style,
        credits_used: 1,
      });
    }

    // Deduct credits (only after successful generation)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: profile.credits - creditsRequired })
      .eq("id", user.id);

    if (updateError) {
      console.error("Credit deduction error:", updateError);
      // Don't fail the request if credit deduction fails
    } else {
      console.log("Credits deducted. New balance:", profile.credits - creditsRequired);
    }

    return new Response(
      JSON.stringify({ imageUrls }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
