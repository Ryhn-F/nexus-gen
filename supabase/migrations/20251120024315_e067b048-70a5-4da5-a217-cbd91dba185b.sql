-- Create edits table for storing image editing history
CREATE TABLE public.edits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  original_image_url text NOT NULL,
  edited_image_url text NOT NULL,
  edit_type text NOT NULL,
  credits_used integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own edits" 
ON public.edits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own edits" 
ON public.edits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_edits_user_id ON public.edits(user_id);
CREATE INDEX idx_edits_created_at ON public.edits(created_at DESC);