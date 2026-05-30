import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Trash2, Calendar, Heart } from 'lucide-react';
import { Post } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { likesAPI } from '../lib/api';

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  showFullContent?: boolean;
}

type PostComment = {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string; full_name: string } | null;
  user_id: string;
};

const normalizeComment = (comment: any): PostComment => ({
  id: comment.id,
  content: comment.content,
  created_at: comment.created_at,
  user_id: comment.user_id,
  profiles: Array.isArray(comment.profiles)
    ? comment.profiles[0] || null
    : comment.profiles || null,
});

export default function PostCard({ post, onDelete, showFullContent = false }: PostCardProps) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [userHasLiked, setUserHasLiked] = useState(post.user_has_liked || false);
  const [liking, setLiking] = useState(false);

  const isOwner = user?.id === post.user_id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const toggleComments = async () => {
    if (!showComments) {
      const { data } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id, profiles(username, full_name)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: false });

      if (data) {
        const normalized = (data as any[]).map(normalizeComment);
        setComments(normalized);
        setCommentsCount(normalized.length);
      }
    }
    setShowComments(!showComments);
  };

  const handleToggleLike = async () => {
    if (!user) return;
    
    setLiking(true);
    try {
      const result = await likesAPI.toggleLike(post.id);
      setUserHasLiked(result.liked);
      setLikesCount(result.liked ? likesCount + 1 : likesCount - 1);
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLiking(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        user_id: user.id,
        content: newComment.trim(),
      })
      .select('id, content, created_at, user_id, profiles(username, full_name)')
      .single();

    if (data && !error) {
      setComments([normalizeComment(data), ...comments]);
      setCommentsCount(commentsCount + 1);
      setNewComment('');
    }
    setLoading(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error) {
      setComments(comments.filter((c) => c.id !== commentId));
      setCommentsCount(commentsCount - 1);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error && onDelete) {
      onDelete(post.id);
    }
  };

  // Fetch initial comments count and likes
  useEffect(() => {
    const fetchData = async () => {
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      setCommentsCount(count || 0);

      if (user) {
        const hasLiked = await likesAPI.hasUserLiked(post.id, user.id);
        setUserHasLiked(hasLiked);
        
        const likeCnt = await likesAPI.getLikesCount(post.id);
        setLikesCount(likeCnt);
      }
    };
    fetchData();
  }, [post.id, user]);

  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${post.profiles?.username}`}>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-semibold text-sm hover:opacity-90 transition-opacity overflow-hidden">
                {post.profiles?.avatar_url ? (
                  <img src={post.profiles.avatar_url} alt={post.profiles.username} className="w-full h-full object-cover" />
                ) : (
                  post.profiles?.username?.charAt(0).toUpperCase() || '?'
                )}
              </div>
            </Link>
            <div>
              <Link
                to={`/profile/${post.profiles?.username}`}
                className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {post.profiles?.full_name || 'Unknown User'}
              </Link>
              <p className="text-sm text-gray-500">@{post.profiles?.username || 'unknown'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(post.created_at)}
            </span>
            {isOwner && (
              <button
                onClick={handleDeletePost}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Delete post"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-5 pb-2">
        <Link to={`/post/${post.id}`}>
          <h2 className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            {post.title}
          </h2>
        </Link>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        <p className={`text-gray-600 leading-relaxed ${!showFullContent ? 'line-clamp-4' : ''}`}>
          {post.content}
        </p>
        {!showFullContent && post.content.length > 200 && (
          <Link
            to={`/post/${post.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-1 inline-block"
          >
            Read more
          </Link>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="px-5 pb-4">
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-auto rounded-lg"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleLike}
            disabled={liking || !user}
            className={`flex items-center gap-2 transition-colors ${
              userHasLiked
                ? 'text-red-500 hover:text-red-600'
                : 'text-gray-600 hover:text-red-500'
            } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={user ? (userHasLiked ? 'Unlike' : 'Like') : 'Sign in to like'}
          >
            <Heart className={`w-5 h-5 ${userHasLiked ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">{likesCount}</span>
          </button>
          <button
            onClick={toggleComments}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{commentsCount}</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-100 bg-gray-50">
          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="p-4 border-b border-gray-100">
            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Post
              </button>
            </div>
          </form>

          {/* Comments List */}
          <div className="max-h-96 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No comments yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-4 hover:bg-white transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                        {comment.profiles?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/profile/${comment.profiles?.username}`}
                            className="font-semibold text-sm text-gray-900 hover:text-blue-600"
                          >
                            {comment.profiles?.full_name || 'Unknown'}
                          </Link>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                            {user?.id === comment.user_id && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete comment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
