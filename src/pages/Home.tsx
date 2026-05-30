import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Post } from '../types/database';
import PostCard from '../components/PostCard';
import { PenTool, RefreshCw } from 'lucide-react';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchPosts() {
    try {
      // Using Supabase client directly for real-time updates
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(id, username, full_name, avatar_url)')
        .order('created_at', { ascending: false });

      if (data && !error) {
        setPosts(data as Post[]);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }

  useEffect(() => {
    fetchPosts().then(() => setLoading(false));

    // Subscribe to new posts
    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
          <p className="text-gray-600 mt-1">See what everyone is sharing</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          title="Refresh feed"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <PenTool className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
          <p className="text-gray-600 mb-6">Be the first to share something with the community!</p>
          <a
            href="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Create Your First Post
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      )}

      {/* Loading More Indicator */}
      {posts.length > 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          You've reached the end of the feed
        </div>
      )}
    </div>
  );
}
