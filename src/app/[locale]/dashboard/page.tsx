'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Briefcase, 
  Hammer, 
  User, 
  MessageSquare, 
  Bell, 
  Settings, 
  LogOut,
  Plus,
  Search,
  Filter,
  Star,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';
import JobForm from '@/components/JobForm';
import ApplicationForm from '@/components/ApplicationForm';
import AIMiddleman from '@/components/AIMiddleman';
import ChatSystem from '@/components/ChatSystem';
import { showNotification } from '@/components/NotificationSystem';
import { io, Socket } from 'socket.io-client';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  imageUrl?: string;
}

interface Job {
  id: number;
  title: string;
  description: string;
  skill: string;
  category?: string;
  wage: number;
  location: string;
  duration: string;
  imageUrl?: string;
  createdAt?: string;
  contractor?: {
    name: string;
    imageUrl?: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterWage, setFilterWage] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatUser, setChatUser] = useState(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [processingNotifications, setProcessingNotifications] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/');
      return;
    }

    try {
      const userObj = JSON.parse(userData);
      setUser(userObj);
      fetchJobs();
      fetchConversations(); // Load conversations for contractors
      if (userObj.role === 'contractor') {
        fetchNotifications(); // Load notifications for contractors
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/');
    }
  }, [router]);

  // Initialize socket connection for contractors
  useEffect(() => {
    if (user && user.role === 'contractor') {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
      const newSocket = io(socketUrl);

      // Join user room
      newSocket.emit('join-user', user.id);

      // Listen for new application notifications
      newSocket.on('new-application', (data: any) => {
        const notification = {
          id: Date.now(),
          type: 'application',
          title: 'New Job Application',
          message: `${data.labourerName} applied for "${data.jobTitle}"`,
          applicationId: data.applicationId,
          jobId: data.jobId,
          labourerName: data.labourerName,
          jobTitle: data.jobTitle,
          timestamp: data.timestamp || new Date().toISOString(),
          isRead: false
        };
        
        setNotifications(prev => [notification, ...prev]);
        setUnreadNotificationCount(prev => prev + 1);
        
        // Show toast notification
        showNotification({
          type: 'info',
          title: 'New Job Application',
          message: `${data.labourerName} applied for "${data.jobTitle}"`,
          duration: 5000
        });
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  // Refresh conversations and notifications periodically for contractors
  useEffect(() => {
    if (user && user.role === 'contractor') {
      const interval = setInterval(() => {
        fetchConversations();
        fetchNotifications(); // Also refresh notifications
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/messages/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user || user.role !== 'contractor') return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/applications?contractor=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const applications = data.applications || [];
        
        // Create notifications from PENDING applications
        const pendingApps = applications
          .filter((app: any) => app.status === 'PENDING')
          .map((app: any) => ({
            id: app.id,
            type: 'application',
            title: 'Job Application',
            message: `${app.labourer.name} applied for "${app.job.title}"`,
            applicationId: app.id,
            jobId: app.job.id,
            labourerName: app.labourer.name,
            jobTitle: app.job.title,
            timestamp: app.createdAt,
            isRead: false
          }));

        setNotifications(pendingApps);
        setUnreadNotificationCount(pendingApps.filter((n: any) => !n.isRead).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationAsRead = (notificationId: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadNotificationCount(prev => Math.max(0, prev - 1));
  };

  const handleNotificationClick = (notification: any) => {
    markNotificationAsRead(notification.id);
    router.push('/applications');
    setShowNotifications(false);
  };

  const handleApplicationAction = async (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => {
    if (processingNotifications.has(applicationId)) return;

    setProcessingNotifications(prev => new Set(prev).add(applicationId));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/applications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          applicationId,
          status
        })
      });

      if (response.ok) {
        // Remove notification from list (or update its status)
        setNotifications(prev => prev.filter(n => n.applicationId !== applicationId));
        setUnreadNotificationCount(prev => Math.max(0, prev - 1));

        // Show success notification
        showNotification({
          type: status === 'ACCEPTED' ? 'success' : 'info',
          title: `Application ${status}`,
          message: status === 'ACCEPTED' 
            ? 'Application has been accepted successfully'
            : 'Application has been rejected',
          duration: 3000
        });

        // Refresh notifications list
        fetchNotifications();
      } else {
        const data = await response.json();
        showNotification({
          type: 'error',
          title: 'Error',
          message: data.error || `Failed to ${status.toLowerCase()} application`,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error updating application:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update application. Please try again.',
        duration: 5000
      });
    } finally {
      setProcessingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(applicationId);
        return newSet;
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleJobFormSuccess = () => {
    fetchJobs(); // Refresh jobs list
    setEditingJob(null);
  };

  const handleEditJob = (job: any) => {
    setEditingJob(job);
    setShowJobForm(true);
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchJobs(); // Refresh jobs list
        showNotification({
          type: 'success',
          title: 'Job Deleted',
          message: 'The job has been successfully deleted.',
          duration: 3000
        });
      } else {
        const data = await response.json();
        showNotification({
          type: 'error',
          title: 'Error',
          message: data.error || 'Failed to delete job',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete job. Please try again.',
        duration: 5000
      });
    }
  };

  const handleApplyToJob = (job: any) => {
    setSelectedJob(job);
    setShowApplicationForm(true);
  };

  const handleApplicationSuccess = () => {
    showNotification({
      type: 'success',
      title: 'Application Submitted!',
      message: 'Your application has been sent successfully. The contractor will review it soon.',
      duration: 5000
    });
  };

  const handleAIRecommendationClick = (recommendation: any) => {
    // If it's a job recommendation, scroll to it or highlight it
    if (recommendation.id) {
      const jobElement = document.getElementById(`job-${recommendation.id}`);
      if (jobElement) {
        jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        jobElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
        setTimeout(() => {
          jobElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
        }, 3000);
      }
    }
  };

  const handleStartChat = (job: any) => {
    if (user && user.role === 'labourer') {
      // Job seeker wants to chat with contractor
      setChatUser(job.contractor);
      setSelectedJob(job);
      setShowChat(true);
    } else {
      // Contractor - redirect to applications page or show conversations
      showNotification({
        type: 'info',
        title: 'Chat with Applicants',
        message: 'Click "View Conversations" above or go to Applications page to chat with applicants.',
        duration: 5000
      });
      // Optionally redirect to applications
      // router.push('/applications');
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.skill.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || job.category === filterCategory;
    const matchesLocation = !filterLocation || job.location.toLowerCase().includes(filterLocation.toLowerCase());
    const matchesWage = !filterWage || job.wage >= parseInt(filterWage);
    return matchesSearch && matchesCategory && matchesLocation && matchesWage;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'oldest':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case 'wage-high':
        return b.wage - a.wage;
      case 'wage-low':
        return a.wage - b.wage;
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen ${theme === 'LIGHT' ? 'bg-gray-50' : 'bg-gray-900'}`}>
      {/* Header */}
      <header className={`shadow-sm border-b ${theme === 'LIGHT' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className={`text-2xl font-bold ${theme === 'LIGHT' ? 'text-blue-600' : 'text-blue-400'}`}>WorkMate</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {user.role === 'contractor' && (
                <button
                  onClick={() => router.push('/applications')}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    theme === 'LIGHT'
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-blue-900 text-blue-300 hover:bg-blue-800'
                  }`}
                >
                  Applications
                </button>
              )}
              <button
                onClick={() => router.push('/profile')}
                className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'LIGHT'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Profile
              </button>
              <div className="flex items-center space-x-2">
                <img 
                  src={user.imageUrl || '/api/dicebear/7.x/avataaars/svg?seed=default'} 
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
                <span className={`font-medium ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className={`${theme === 'LIGHT' ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h2 className={`text-3xl font-bold mb-2 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
            Welcome, {user.name}!
          </h2>
          <p className={`${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>
            {user.role === 'contractor' 
              ? 'Manage your job postings and applications'
              : 'Find and apply for jobs that match your skills'
            }
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`rounded-lg shadow p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>Total Jobs</p>
                <p className={`text-2xl font-bold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>{jobs.length}</p>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Hammer className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>Active Jobs</p>
                <p className={`text-2xl font-bold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                  {jobs.filter(job => job.duration !== 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>Messages</p>
                <p className={`text-2xl font-bold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                  {conversations.reduce((sum, conv) => sum + conv.unreadCount, 0)}
                </p>
                <button
                  onClick={() => setShowConversations(!showConversations)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                >
                  {showConversations ? 'Hide' : 'View'} Conversations
                </button>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bell className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4 relative">
                <p className={`text-sm font-medium ${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>Notifications</p>
                <div className="flex items-center space-x-2">
                  <p className={`text-2xl font-bold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                    {unreadNotificationCount}
                  </p>
                  {user && user.role === 'contractor' && (
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {showNotifications ? 'Hide' : 'View'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className={`rounded-lg shadow mb-8 p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search jobs, skills, or descriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'LIGHT' 
                        ? 'border-gray-300 bg-white text-gray-900' 
                        : 'border-gray-600 bg-gray-700 text-white'
                    }`}
                  />
                </div>
              </div>
              
              {user.role === 'contractor' && (
                <button 
                  onClick={() => setShowJobForm(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Post Job
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                  Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'LIGHT' 
                      ? 'border-gray-300 bg-white text-gray-900' 
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                >
                  <option value="">All Categories</option>
                  <option value="HOUSEKEEPING">Housekeeping</option>
                  <option value="PLUMBING">Plumbing</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="CARPENTRY">Carpentry</option>
                  <option value="PAINTING">Painting</option>
                  <option value="GARDENING">Gardening</option>
                  <option value="MASONRY">Masonry</option>
                  <option value="COOKING">Cooking</option>
                  <option value="CHILDCARE">Childcare</option>
                  <option value="DRIVING">Driving</option>
                  <option value="SECURITY">Security</option>
                  <option value="NURSING">Nursing</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mumbai"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'LIGHT' 
                      ? 'border-gray-300 bg-white text-gray-900' 
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                  Min Wage (₹)
                </label>
                <input
                  type="number"
                  placeholder="500"
                  value={filterWage}
                  onChange={(e) => setFilterWage(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'LIGHT' 
                      ? 'border-gray-300 bg-white text-gray-900' 
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'LIGHT' 
                      ? 'border-gray-300 bg-white text-gray-900' 
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="wage-high">Highest Wage</option>
                  <option value="wage-low">Lowest Wage</option>
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {(filterCategory || filterLocation || filterWage || searchTerm) && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterCategory('');
                    setFilterLocation('');
                    setFilterWage('');
                    setSortBy('newest');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    theme === 'LIGHT'
                      ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notifications List for Contractors */}
        {user.role === 'contractor' && showNotifications && (
          <div className={`rounded-lg shadow mb-8 p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
              Job Application Notifications
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg transition-colors border ${
                    !notification.isRead 
                      ? theme === 'LIGHT' 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-blue-900 border-blue-700'
                      : theme === 'LIGHT'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-gray-700 border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                        <p className={`font-medium ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                          {notification.title}
                        </p>
                      </div>
                      <p className={`text-sm ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                        {notification.message}
                      </p>
                      <p className={`text-xs mt-2 ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markNotificationAsRead(notification.id);
                      }}
                      className={`ml-4 p-1 rounded ${theme === 'LIGHT' ? 'hover:bg-gray-200' : 'hover:bg-gray-600'}`}
                    >
                      <span className="text-xs text-gray-500">Mark read</span>
                    </button>
                  </div>
                  
                  {/* Accept/Reject Actions */}
                  <div className={`flex items-center space-x-3 mt-3 pt-3 border-t ${
                    theme === 'LIGHT' ? 'border-gray-200' : 'border-gray-600'
                  }`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplicationAction(notification.applicationId, 'ACCEPTED');
                      }}
                      disabled={processingNotifications.has(notification.applicationId)}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      {processingNotifications.has(notification.applicationId) ? (
                        'Processing...'
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplicationAction(notification.applicationId, 'REJECTED');
                      }}
                      disabled={processingNotifications.has(notification.applicationId)}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      {processingNotifications.has(notification.applicationId) ? (
                        'Processing...'
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNotificationClick(notification);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        theme === 'LIGHT'
                          ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {notifications.length === 0 && (
              <p className={`text-center py-4 ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                No notifications
              </p>
            )}
          </div>
        )}

        {/* Conversations List for Contractors */}
        {user.role === 'contractor' && showConversations && conversations.length > 0 && (
          <div className={`rounded-lg shadow mb-8 p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
              Your Conversations
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.user.id}
                  onClick={() => {
                    setChatUser(conv.user);
                    setSelectedJob(conv.jobId ? jobs.find(j => j.id === conv.jobId) || null : null);
                    setShowChat(true);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    theme === 'LIGHT' ? 'bg-gray-50' : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <img 
                      src={conv.user.imageUrl || '/api/dicebear/7.x/avataaars/svg?seed=default'} 
                      alt={conv.user.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="text-left">
                      <p className={`font-medium ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                        {conv.user.name}
                      </p>
                      <p className={`text-sm truncate max-w-xs ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {conv.lastMessage.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {conv.unreadCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 mb-1">
                        {conv.unreadCount}
                      </span>
                    )}
                    <span className={`text-xs ${theme === 'LIGHT' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(conv.lastMessage.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Middleman */}
        <div className="mb-8">
          <AIMiddleman 
            user={user} 
            jobs={jobs} 
            onRecommendationClick={handleAIRecommendationClick}
          />
        </div>

        {/* Jobs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <div key={job.id} id={`job-${job.id}`} className={`rounded-lg shadow hover:shadow-lg transition-shadow ${
              theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'
            }`}>
              <img 
                src={job.imageUrl || '/api/dicebear/7.x/icons/svg?seed=job&icon=briefcase&backgroundColor=3B82F6&iconColor=FACC15'} 
                alt={job.title}
                className="w-full h-48 object-cover rounded-t-lg"
              />
              
              <div className="p-6">
                <h3 className={`text-lg font-semibold mb-2 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                  {job.title}
                </h3>
                <p className={`text-sm mb-4 line-clamp-2 ${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>
                  {job.description}
                </p>
                
                <div className="space-y-2 mb-4">
                  <div className={`flex items-center text-sm ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Briefcase className="h-4 w-4 mr-2" />
                    {job.category ? job.category.charAt(0) + job.category.slice(1).toLowerCase() : 'General'}
                  </div>
                  <div className={`flex items-center text-sm ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Hammer className="h-4 w-4 mr-2" />
                    {job.skill}
                  </div>
                  <div className={`flex items-center text-sm ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                    <MapPin className="h-4 w-4 mr-2" />
                    {job.location}
                  </div>
                  <div className={`flex items-center text-sm ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Clock className="h-4 w-4 mr-2" />
                    {job.duration}
                  </div>
                  <div className={`flex items-center text-sm font-semibold ${theme === 'LIGHT' ? 'text-green-600' : 'text-green-400'}`}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    ₹{job.wage}/day
                  </div>
                </div>

                {user.role === 'labourer' && (
                  <div className="space-y-2">
                    <button 
                      onClick={() => handleApplyToJob(job)}
                      className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
                    >
                      Apply
                    </button>
                    <button 
                      onClick={() => handleStartChat(job)}
                      className="w-full bg-green-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat
                    </button>
                  </div>
                )}

                {user.role === 'contractor' && (
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                      View Details
                    </button>
                    <button 
                      onClick={() => handleEditJob(job)}
                      className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteJob(job.id)}
                      className="bg-red-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className={`h-12 w-12 mx-auto mb-4 ${theme === 'LIGHT' ? 'text-gray-400' : 'text-gray-600'}`} />
            <h3 className={`text-lg font-medium mb-2 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>No jobs found</h3>
            <p className={`${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Job Form Modal */}
      <JobForm
        isOpen={showJobForm}
        onClose={() => {
          setShowJobForm(false);
          setEditingJob(null);
        }}
        onSuccess={handleJobFormSuccess}
        editingJob={editingJob}
      />

      {/* Application Form Modal */}
      <ApplicationForm
        isOpen={showApplicationForm}
        onClose={() => {
          setShowApplicationForm(false);
          setSelectedJob(null);
        }}
        onSuccess={handleApplicationSuccess}
        job={selectedJob}
      />

      {/* Chat System */}
      <ChatSystem
        user={user}
        isOpen={showChat}
        onClose={() => {
          setShowChat(false);
          setChatUser(null);
          setSelectedJob(null);
        }}
        selectedJob={selectedJob}
        selectedUser={chatUser}
        onMessageSent={fetchConversations}
      />
    </div>
  );
}
