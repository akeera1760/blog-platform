import { supabase } from './supabase';

// File Upload API
export const fileAPI = {
  async uploadPostImage(file: File) {
    const fileName = `uploads/post-${crypto.randomUUID()}-${file.name}`;

    const { error } = await supabase.storage
      .from('post-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw new Error(`Upload error: ${error.message || JSON.stringify(error)}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      throw new Error(`Unable to generate public URL for uploaded post image: ${JSON.stringify(publicUrlData)}`);
    }

    return publicUrlData.publicUrl;
  },

  async uploadProfilePicture(file: File, userId: string) {
    const fileName = `avatars/profile-${userId}-${crypto.randomUUID()}-${file.name}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Unable to generate public URL for the uploaded avatar');
    }

    return publicUrlData.publicUrl;
  },
};

// Auth API - Using Supabase directly
export const authAPI = {
  async register(email: string, password: string, username: string) {
    // Sign up with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    // Create profile
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            username: username.toLowerCase(),
            email,
          },
        ]);

      if (profileError) {
        throw new Error(profileError.message);
      }
    }

    return authData;
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  logout() {
    return supabase.auth.signOut();
  },
};

// Posts API - Using Supabase directly
export const postsAPI = {
  async getAll() {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        image_url,
        created_at,
        user_id,
        profiles(username)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    
    // Get likes for each post
    if (user && data) {
      const postIds = data.map((p: any) => p.id);
      const { data: userLikes } = await supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', user.id);

      const likedPostIds = new Set((userLikes || []).map(l => l.post_id));

      const { data: likesCounts } = await supabase
        .from('likes')
        .select('post_id', { count: 'exact', head: false });

      const likesCounts_ = {} as Record<string, number>;
      (likesCounts || []).forEach(l => {
        likesCounts_[l.post_id] = (likesCounts_.hasOwnProperty(l.post_id) ? likesCounts_[l.post_id] : 0) + 1;
      });

      return data.map((post: any) => ({
        ...post,
        likes_count: likesCounts_[post.id] || 0,
        user_has_liked: likedPostIds.has(post.id),
      }));
    }

    return data;
  },

  async getById(id: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        image_url,
        created_at,
        user_id,
        profiles(username)
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);

    if (user && data) {
      const { data: likes } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', id);

      return {
        ...data,
        likes_count: count || 0,
        user_has_liked: !!likes,
      };
    }

    return data;
  },

  async create(title: string, content: string, image_url?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('posts')
      .insert([
        {
          title,
          content,
          image_url,
          user_id: user.id,
        },
      ])
      .select();

    if (error) throw new Error(error.message);
    return data;
  },

  async update(id: string, updateData: { title?: string; content?: string; image_url?: string }) {
    const { data, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },
};

// Comments API - Using Supabase directly
export const commentsAPI = {
  async getByPostId(postId: string) {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles(username)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  },

  async create(postId: string, content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          post_id: postId,
          content,
          user_id: user.id,
        },
      ])
      .select();

    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },
};

// Likes API
export const likesAPI = {
  async toggleLike(postId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Check if like exists
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLike) {
      // Remove like
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id);
      
      if (error) throw new Error(error.message);
      return { liked: false };
    } else {
      // Add like
      const { error } = await supabase
        .from('likes')
        .insert([{ post_id: postId, user_id: user.id }]);
      
      if (error) throw new Error(error.message);
      return { liked: true };
    }
  },

  async getLikesCount(postId: string) {
    const { count, error } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (error) throw new Error(error.message);
    return count || 0;
  },

  async hasUserLiked(postId: string, userId: string) {
    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return !!data;
  },
};
