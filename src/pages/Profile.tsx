import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fileAPI } from '../lib/api';
import { Profile, Post } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import { Calendar, Edit2, Camera, Check, X } from 'lucide-react';

export default function ProfilePage() {
  const { username } = useParams();
  const { profile: currentUser, updateProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    async function fetchProfile() {
      if (!username) return;

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);

        // Fetch posts
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, profiles(id, username, full_name, avatar_url)')
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        if (postsData) {
          setPosts(postsData as Post[]);
        }

        // Fetch posts count
        const { count } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileData.id);
        setPostsCount(count || 0);
      }

      setLoading(false);
    }

    fetchProfile();
  }, [username]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setAvatarUploading(true);
    try {
      const avatarUrl = await fileAPI.uploadProfilePicture(file, currentUser.id);
      
      // Update profile with avatar URL
      const { error } = await updateProfile({
        avatar_url: avatarUrl,
      });

      if (!error && profile) {
        setProfile({
          ...profile,
          avatar_url: avatarUrl,
        });
      }
    } catch (error) {
      alert('Error uploading avatar');
      console.error(error);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleStartEdit = () => {
    if (profile) {
      setEditFullName(profile.full_name);
      setEditBio(profile.bio);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFullName('');
    setEditBio('');
  };

  const handleSaveEdit = async () => {
    if (!profile) return;

    setSaving(true);
    const { error } = await updateProfile({
      full_name: editFullName.trim(),
      bio: editBio.trim(),
    });

    if (!error) {
      setProfile({
        ...profile,
        full_name: editFullName.trim(),
        bio: editBio.trim(),
      });
      setIsEditing(false);
    }
    setSaving(false);
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-200 mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl text-gray-400">?</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">User not found</h3>
          <p className="text-gray-600">The user @{username} doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Background */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-teal-400"></div>

        {/* Profile Info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {/* Avatar */}
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-3xl border-4 border-white shadow-lg overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                ) : (
                  <span>{profile.username.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {isOwnProfile && (
                <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors cursor-pointer shadow-lg">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={avatarUploading}
                  />
                  <Camera className={`w-4 h-4 ${avatarUploading ? 'opacity-50' : ''}`} />
                </label>
              )}
            </div>

            {/* Name and Stats */}
            <div className="flex-1 pt-4 sm:pt-0">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg font-semibold"
                    placeholder="Full name"
                  />
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    rows={2}
                    placeholder="Write something about yourself..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
                    {isOwnProfile && (
                      <button
                        onClick={handleStartEdit}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="Edit profile"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                  </div>
                  <p className="text-gray-500">@{profile.username}</p>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 sm:ml-auto text-center pb-4 sm:pb-0">
              <div>
                <p className="text-2xl font-bold text-gray-900">{postsCount}</p>
                <p className="text-sm text-gray-500">Posts</p>
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                Joined {formatJoinDate(profile.created_at)}
              </div>
            </div>
          </div>

          {/* Bio */}
          {!isEditing && profile.bio && (
            <p className="mt-4 text-gray-700 leading-relaxed">{profile.bio}</p>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">
          {isOwnProfile ? 'Your Posts' : `${profile.full_name}'s Posts`}
        </h2>

        {posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
            {isOwnProfile ? (
              <>
                <p className="text-gray-600 mb-6">Share your thoughts with the world!</p>
                <Link
                  to="/create"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create Your First Post
                </Link>
              </>
            ) : (
              <p className="text-gray-600">
                {profile.full_name} hasn't posted anything yet.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
