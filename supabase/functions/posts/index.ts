import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.replace("/posts", "").split("/").filter(Boolean);
    const postId = pathParts[0] || null;

    // GET /posts - Get all posts
    if (!postId && req.method === "GET") {
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles(id, username, full_name, avatar_url)")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch posts" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify(data),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST /posts - Create post
    if (!postId && req.method === "POST") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const body = await req.json();
      const { title, content, image_url } = body;

      if (!title || !content) {
        return new Response(
          JSON.stringify({ error: "Title and content are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: userId,
          title: title.trim(),
          content: content.trim(),
          image_url: image_url?.trim() || "",
        })
        .select("*, profiles(id, username, full_name, avatar_url)")
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to create post" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify(data),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // GET /posts/:id - Get single post
    if (postId && req.method === "GET") {
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles(id, username, full_name, avatar_url)")
        .eq("id", postId)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify(data),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // PUT /posts/:id - Update post
    if (postId && req.method === "PUT") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check ownership
      const { data: existingPost } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", postId)
        .maybeSingle();

      if (!existingPost || existingPost.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Post not found or unauthorized" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const body = await req.json();
      const { title, content, image_url } = body;

      const updateData: Record<string, string> = { updated_at: new Date().toISOString() };
      if (title) updateData.title = title.trim();
      if (content) updateData.content = content.trim();
      if (image_url !== undefined) updateData.image_url = image_url.trim() || "";

      const { data, error } = await supabase
        .from("posts")
        .update(updateData)
        .eq("id", postId)
        .select("*, profiles(id, username, full_name, avatar_url)")
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to update post" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify(data),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // DELETE /posts/:id - Delete post
    if (postId && req.method === "DELETE") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check ownership
      const { data: existingPost } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", postId)
        .maybeSingle();

      if (!existingPost || existingPost.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Post not found or unauthorized" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to delete post" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ message: "Post deleted successfully" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
