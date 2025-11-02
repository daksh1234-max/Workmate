'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users, Phone, Video } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  jobId?: number;
  isRead: boolean;
  createdAt: string;
  sender: {
    name: string;
    imageUrl?: string;
  };
}

interface ChatSystemProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  selectedJob?: any;
  selectedUser?: any;
  onMessageSent?: () => void; // Callback to refresh conversations list
}

interface JobLite {
  id?: number;
  title: string;
  location: string;
  wage: number;
  description: string;
  skill?: string;
}

export default function ChatSystem({ user, isOpen, onClose, selectedJob, selectedUser, onMessageSent }: ChatSystemProps) {
  const { theme } = useTheme();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const AI_BOT_USER = { id: 0, name: "AI Bot", imageUrl: "/bot-avatar.png" };

  const isAIBot = selectedUser && selectedUser.id === 0;

  // Initialize socket connection
  useEffect(() => {
    if (isOpen && !isAIBot && user.id) {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
      const newSocket = io(socketUrl);

      // Join user room
      newSocket.emit('join-user', user.id);

      // Listen for new messages - STRICTLY filter by current conversation
      newSocket.on('new-message', (message) => {
        // Only add message if it's relevant to the current conversation
        if (selectedUser && (
          (message.senderId === selectedUser.id && message.receiverId === user.id) ||
          (message.senderId === user.id && message.receiverId === selectedUser.id)
        )) {
          const normalized = {
            id: message.id || Date.now(),
            content: message.content || message.message || '',
            senderId: message.senderId,
            receiverId: message.receiverId,
            jobId: message.jobId ?? undefined,
            isRead: message.isRead ?? false,
            createdAt: message.createdAt || new Date().toISOString(),
            sender: message.sender || { name: 'User', imageUrl: undefined }
          };
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === normalized.id)) return prev;
            return [...prev, normalized];
          });
        }
      });

      // Listen for online users
      newSocket.on('user-online', (userId: number) => {
        setOnlineUsers(prev => (prev.includes(userId) ? prev : [...prev, userId]));
      });

      newSocket.on('user-offline', (userId) => {
        setOnlineUsers(prev => prev.filter(id => id !== userId));
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isOpen, user.id, selectedUser?.id, isAIBot]);

  useEffect(() => {
    // Reset messages when switching conversation target or job context
    setMessages([]);
    if (isOpen && selectedUser) {
      loadMessages();
    }
  }, [selectedUser?.id, selectedJob?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!selectedUser || isAIBot) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Load messages ONLY between current user and selectedUser
      const response = await fetch(`/api/messages?userId=${selectedUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Double-check: only show messages between these two users
        const filteredMessages = (data.messages || []).filter((msg: Message) => {
          return (msg.senderId === user.id && msg.receiverId === selectedUser.id) ||
                 (msg.senderId === selectedUser.id && msg.receiverId === user.id);
        });
        setMessages(filteredMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAIBotMessage = (text: string) => {
    const aiMsg: Message = {
      id: Date.now(),
      content: text,
      senderId: 0,
      receiverId: user.id,
      isRead: true,
      createdAt: new Date().toISOString(),
      sender: AI_BOT_USER
    };
    setMessages((prev) => [...prev, aiMsg]);
  };

  const extractJobKeywords = (text: string): { skills: string[], location: string | null } => {
    const lowerText = text.toLowerCase();
    
    const stopwords = new Set(['near', 'in', 'at', 'around', 'jobs', 'job', 'work', 'position', 'positions']);

    // Expanded skill list with variations (defined first for location extraction)
    const explicitSkills = [
      'gardening', 'garden', 'gardener',
      'driving', 'driver',
      'construction', 'construction worker',
      'cleaning', 'cleaner', 'housekeeping',
      'electrician', 'electrical', 'electric',
      'plumber', 'plumbing',
      'cook', 'cooking', 'chef',
      'security', 'guard',
      'delivery', 'delivery driver',
      'helper', 'help',
      'painting', 'painter',
      'maintenance', 'maintenance worker',
      'labor', 'labour', 'laborer', 'labourer',
      'welder', 'welding',
      'carpenter', 'carpentry',
      'mason', 'masonry',
      'waiter', 'waitress', 'serving',
      'teacher', 'teaching', 'tutor',
      'supervisor', 'supervising',
      'nursing', 'nurse', 'caregiver',
      'childcare', 'babysitter', 'nanny'
    ];

    // Semantic mapping: map general terms to specific skills
    const semanticMap: Record<string, string[]> = {
      'activity': ['driving', 'gardening', 'construction', 'delivery', 'outdoor'],
      'outdoor': ['driving', 'gardening', 'construction', 'delivery', 'painting'],
      'environment': ['gardening', 'cleaning', 'construction'],
      'physical': ['construction', 'welder', 'carpenter', 'mason', 'labour', 'helper'],
      'service': ['delivery', 'waiter', 'cook', 'cleaning', 'security'],
      'technical': ['electrician', 'plumber', 'welder', 'maintenance'],
      'indoor': ['cook', 'waiter', 'cleaning', 'electrician', 'plumber'],
      'field': ['driving', 'delivery', 'construction', 'gardening']
    };

    // Common location names/cities (can be expanded)
    const knownLocations = ['mumbai', 'delhi', 'bangalore', 'pune', 'hyderabad', 'chennai', 
      'kolkata', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane',
      'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra',
      'nashik', 'faridabad', 'meerut', 'rajkot', 'varanasi', 'srinagar', 'amritsar'];

    // Extract location patterns - be careful not to capture skill words
    const locationPatterns = [
      /jobs?\s+(?:of|for)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:in|near|at|around)\s+([a-z]+(?:\s+[a-z]+)?)/i,  // "jobs of cooking in delhi"
      /jobs?\s+(?:near|in|at|around)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:of|for)\s+([a-z]+(?:\s+[a-z]+)?)/i,  // "jobs near delhi of cooking"
      /(?:in|at|near|around|for)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      /([a-z]+(?:\s+[a-z]+)?)\s+(?:jobs?|work|position)/i,
      /jobs?\s+in\s+([a-z]+(?:\s+[a-z]+)?)/i,
      /(?:jobs?|work)\s+(?:near|in|at|around)\s+([a-z]+(?:\s+[a-z]+)?)/i
    ];
    
    let location: string | null = null;
    let extractedSkillFromLocationPattern: string | null = null;
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        // For patterns with 2 captures: first might be skill, second is location (or vice versa)
        let candidate: string | null = null;
        let skillCandidate: string | null = null;
        
        if (match[2] && match[1]) {
          // Two captures - determine which is location and which is skill
          const first = match[1].trim().toLowerCase();
          const second = match[2].trim().toLowerCase();
          
          // Check which one is more likely a location
          if (knownLocations.includes(second) || (!knownLocations.includes(first) && knownLocations.includes(second))) {
            candidate = second;
            skillCandidate = first;
          } else if (knownLocations.includes(first)) {
            candidate = first;
            skillCandidate = second;
          } else {
            // Neither is known, check if either looks like a skill
            const firstIsSkill = explicitSkills.some(skill => {
              const baseSkill = skill.split(' ')[0];
              return first.includes(baseSkill) || baseSkill.includes(first);
            });
            const secondIsSkill = explicitSkills.some(skill => {
              const baseSkill = skill.split(' ')[0];
              return second.includes(baseSkill) || baseSkill.includes(second);
            });
            
            if (firstIsSkill && !secondIsSkill) {
              candidate = second;
              skillCandidate = first;
            } else if (secondIsSkill && !firstIsSkill) {
              candidate = first;
              skillCandidate = second;
            }
          }
        } else {
          candidate = match[1]?.trim().toLowerCase() || null;
        }
        
        if (candidate) {
          // Check if it's a skill word - if so, skip as location
          const isSkill = explicitSkills.some(skill => {
            const baseSkill = skill.split(' ')[0];
            return candidate!.includes(baseSkill) || baseSkill.includes(candidate!);
          });
          // Prefer known locations or non-skill words
          if (!stopwords.has(candidate) && !isSkill && knownLocations.includes(candidate)) {
            location = candidate;
            if (skillCandidate) extractedSkillFromLocationPattern = skillCandidate;
            break;
          } else if (!stopwords.has(candidate) && !isSkill && candidate.length > 2) {
            // Allow unknown locations too if they're not skills
            location = candidate;
            if (skillCandidate) extractedSkillFromLocationPattern = skillCandidate;
            break;
          }
        }
      }
    }
    
    const foundSkills: string[] = [];
    
    // Natural language patterns to extract skills from conversational phrases
    const naturalLanguagePatterns = [
      // "I am good at X and Y" or "I am good at X, Y, and Z"
      /(?:i\s+(?:am|'m)\s+)?(?:good|great|skilled|experienced|proficient)\s+(?:at|in|with)\s+(.+?)(?:\s+(?:and|also|,)\s+.*)?$/gi,
      // "I can do X and Y"
      /i\s+(?:can|know how to)\s+(?:do\s+)?(.+?)(?:\s+(?:and|also|,)\s+.*)?$/gi,
      // "I have experience in X and Y"
      /(?:i\s+)?(?:have|had)\s+(?:experience|skills|expertise|knowledge)\s+(?:in|with|at)\s+(.+?)(?:\s+(?:and|also|,)\s+.*)?$/gi,
      // "I know X and Y"
      /i\s+(?:know|learned|learn)\s+(?:how to\s+)?(.+?)(?:\s+(?:and|also|,)\s+.*)?$/gi,
      // "I am a/an X and Y"
      /i\s+(?:am|'m)\s+(?:a|an|the)\s+(.+?)(?:\s+(?:and|also|,)\s+(?:a|an|the)?\s*.*)?$/gi,
      // "My skills include X and Y"
      /(?:my\s+)?(?:skills|abilities|expertise)\s+(?:include|are|is)\s+(.+?)(?:\s+(?:and|also|,)\s+.*)?$/gi,
    ];

    // Extract skills from natural language patterns
    for (const pattern of naturalLanguagePatterns) {
      const matches = [...lowerText.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          // Split by "and", "also", or comma to get multiple skills
          const skillText = match[1].trim();
          const skillParts = skillText.split(/\s+(?:and|also|,)\s+/i).map(s => s.trim().toLowerCase());
          
          for (const skillPart of skillParts) {
            // Remove trailing words like "work", "job", "etc"
            const cleanSkill = skillPart.replace(/\s+(?:work|job|etc|and|also).*$/i, '').trim();
            
            if (cleanSkill.length > 2) {
              // Check if it matches a known skill
              const matchedSkill = explicitSkills.find(skill => {
                const baseSkill = skill.split(' ')[0];
                const skillRegex = new RegExp(`\\b${baseSkill}\\b`, 'i');
                return skillRegex.test(cleanSkill) || cleanSkill.includes(baseSkill) || baseSkill.includes(cleanSkill);
              });
              
              if (matchedSkill) {
                const normalized = matchedSkill.split(' ')[0];
                if (!foundSkills.includes(normalized) && !knownLocations.includes(cleanSkill) && !stopwords.has(cleanSkill)) {
                  foundSkills.push(normalized);
                }
              } else if (!knownLocations.includes(cleanSkill) && !stopwords.has(cleanSkill) && cleanSkill.length > 2 && cleanSkill.length < 20) {
                // Might be a skill not in our list - add it if reasonable
                if (!foundSkills.includes(cleanSkill)) {
                  foundSkills.push(cleanSkill);
                }
              }
            }
          }
        }
      }
    }

    // Also extract location from natural language if not already found
    if (!location) {
      const locationNLPatterns = [
        /(?:i\s+(?:am|'m|live|living)\s+(?:in|at|near|around|from)\s+)([a-z]+(?:\s+[a-z]+)?)/gi,
        /(?:located|living|based|from)\s+(?:in|at|near)\s+([a-z]+(?:\s+[a-z]+)?)/gi,
        /(?:i\s+am\s+from|i'm\s+from)\s+([a-z]+(?:\s+[a-z]+)?)/gi,
      ];
      for (const pattern of locationNLPatterns) {
        const matches = [...lowerText.matchAll(pattern)];
        for (const match of matches) {
          if (match[1]) {
            const locCandidate = match[1].trim().toLowerCase();
            // Remove common trailing words
            const cleanLoc = locCandidate.replace(/\s+(?:and|also|,).*$/i, '').trim();
            if (cleanLoc && knownLocations.includes(cleanLoc)) {
              location = cleanLoc;
              break;
            }
          }
        }
        if (location) break;
      }
    }
    
    // First, check if we extracted a skill from location pattern (e.g., "jobs of cooking in delhi")
    if (extractedSkillFromLocationPattern) {
      // Check if it matches a known skill
      const matchedSkill = explicitSkills.find(skill => {
        const baseSkill = skill.split(' ')[0];
        return extractedSkillFromLocationPattern!.includes(baseSkill) || baseSkill.includes(extractedSkillFromLocationPattern!);
      });
      if (matchedSkill) {
        const normalized = matchedSkill.split(' ')[0];
        if (!foundSkills.includes(normalized)) {
          foundSkills.push(normalized);
        }
      } else if (extractedSkillFromLocationPattern.length > 2 && !knownLocations.includes(extractedSkillFromLocationPattern)) {
        // Might be a skill we don't have in list yet
        if (!foundSkills.includes(extractedSkillFromLocationPattern)) {
          foundSkills.push(extractedSkillFromLocationPattern);
        }
      }
    }
    
    // Direct skill matching from text
    for (const skill of explicitSkills) {
      // Use word boundary or exact match to avoid partial matches
      const skillRegex = new RegExp(`\\b${skill}\\b`, 'i');
      if (skillRegex.test(lowerText)) {
        // Normalize to base form
        const normalized = skill.split(' ')[0]; // Use first word as base
        if (!foundSkills.includes(normalized)) {
          foundSkills.push(normalized);
        }
      }
    }

    for (const [semantic, mappedSkills] of Object.entries(semanticMap)) {
      if (lowerText.includes(semantic) && foundSkills.length === 0) {
        foundSkills.push(...mappedSkills);
        break;
      }
    }

    // Fallback: extract skill-like words after common phrases
    if (foundSkills.length === 0) {
      // Try pattern: "jobs of [skill]" or "work as [skill]" or "need [skill]"
      const skillFallbackPatterns = [
        /(?:jobs?|work)\s+(?:of|as|for)\s+(\w+)/i,
        /(?:need|want|looking|find)\s+(?:a\s+)?(\w+)/i,
        /(?:jobs?|work|opportunity)\s+(?:in|for)\s+(\w+)/i
      ];
      
      for (const pattern of skillFallbackPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const word = match[1].toLowerCase();
          // Make sure it's not a location or stopword
          if (!stopwords.has(word) && !knownLocations.includes(word) && word.length > 2) {
            foundSkills.push(word);
            break;
          }
        }
      }
    }

    // Remove duplicates and normalize
    const uniqueSkills = [...new Set(foundSkills.map(s => s.toLowerCase()))];
    return { skills: uniqueSkills, location };
  };

  const handleAIRecommendation = async (userQuery?: string) => {
    // extract keywords and location from user query
    const { skills, location } = userQuery ? extractJobKeywords(userQuery) : { skills: [], location: null };
    
    if (skills.length > 0 || location) {
      const searchTerms: string[] = [];
      if (skills.length > 0) searchTerms.push(`skills: ${skills.join(', ')}`);
      if (location) searchTerms.push(`location: ${location}`);
      
      const searchMsg = skills.length > 0 && location 
        ? `🔍 Finding ${skills.length > 1 ? skills.join(' and ') : skills[0]} jobs in ${location}...`
        : skills.length > 0
        ? `🔍 Finding ${skills.length > 1 ? skills.join(' and ') : skills[0]} jobs...`
        : location
        ? `🔍 Finding jobs in ${location}...`
        : `🔍 Looking for jobs...`;
      addAIBotMessage(searchMsg);
      try {
        const token = localStorage.getItem('token');
        
        // Build query params
        const params = new URLSearchParams();
        if (skills.length > 0) {
          // For semantic matches, we need to search each skill individually or use OR logic
          // Since API uses contains, we'll search for each skill separately and combine results
          // For now, we'll pass all skills and let the backend handle it
          params.append('skill', skills.join(','));
        }
        if (location) {
          params.append('location', location);
        }
        params.append('limit', '10'); // Get more results for semantic matches
        
        const res = await fetch(`/api/jobs?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.jobs && data.jobs.length > 0) {
            const jobsToShow = data.jobs.slice(0, 5);
            jobsToShow.forEach((job: JobLite) => {
              addAIBotMessage(`⭐ ${job.title} at ${job.location} (Wage: ₹${job.wage}/day)\n${job.description}`);
            });
            if (data.jobs.length > 5) {
              addAIBotMessage(`Found ${data.jobs.length} jobs. Showing top 5.`);
            }
          } else {
            addAIBotMessage('Sorry, no matching jobs found for ' + searchTerms.join(', ') + '.');
          }
        } else {
          addAIBotMessage('Oops, could not fetch job results.');
        }
      } catch {
        addAIBotMessage('Unable to reach job search at the moment.');
      }
      return;
    }
    // fallback to AI recommendations
    addAIBotMessage('🔍 Searching best jobs for you...');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/ai/recommendations?type=jobs&id=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.recommendations && data.recommendations.length > 0) {
          data.recommendations.slice(0, 3).forEach((job: JobLite) => {
            addAIBotMessage(`⭐ ${job.title} at ${job.location} (Wage: ₹${job.wage}/day)\n${job.description}`);
          });
          if (data.recommendations.length > 3) {
            addAIBotMessage('Type "more" to see more jobs!');
          }
        } else {
          addAIBotMessage('Sorry, I couldn\'t find suitable jobs for you right now.');
        }
      } else {
        addAIBotMessage('Oops, something went wrong with the recommendation service.');
      }
    } catch {
      addAIBotMessage('Unable to reach AI at the moment.');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    if (isAIBot) {
      const userQuery = newMessage.trim();
      setMessages((prev) => [...prev, {
        id: Date.now(),
        content: userQuery,
        senderId: user.id,
        receiverId: 0,
        isRead: true,
        createdAt: new Date().toISOString(),
        sender: user
      }]);
      setNewMessage('');
      await handleAIRecommendation(userQuery); // pass user query
      return;
    }

    if (!socket || !selectedUser) return;

    const messageData = {
      receiverId: selectedUser.id,
      message: newMessage.trim(),
      senderId: user.id,
      jobId: selectedJob?.id,
      senderName: user.name,
      senderImageUrl: user.imageUrl
    };

    // Send via socket
    socket.emit('send-message', messageData);

    // Optimistically add sender's message locally
    setMessages((prev) => [...prev, {
      id: Date.now(),
      content: newMessage.trim(),
      senderId: user.id,
      receiverId: selectedUser.id,
      jobId: selectedJob?.id,
      isRead: true,
      createdAt: new Date().toISOString(),
      sender: { name: user.name, imageUrl: user.imageUrl }
    }]);

    // Also save to database - CRITICAL for offline delivery
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          message: newMessage.trim(),
          jobId: selectedJob?.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update the optimistic message with the real ID from database
        if (data.newMessage) {
          setMessages(prev => prev.map(msg => 
            msg.id === Date.now() ? { ...msg, id: data.newMessage.id } : msg
          ));
        }
        // Notify parent to refresh conversations list
        if (onMessageSent) {
          onMessageSent();
        }
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col ${
        theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'LIGHT' ? 'border-gray-200' : 'border-gray-700'
        }`}>
          <div className="flex items-center space-x-3">
            <img 
              src={selectedUser?.imageUrl || '/api/dicebear/7.x/avataaars/svg?seed=default'} 
              alt={selectedUser?.name}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <h3 className={`font-semibold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                {selectedUser?.name}
              </h3>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  onlineUsers.includes(selectedUser?.id) ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <span className={`text-sm ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {onlineUsers.includes(selectedUser?.id) ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className={`p-2 rounded-lg ${theme === 'LIGHT' ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`}>
              <Phone className="h-5 w-5" />
            </button>
            <button className={`p-2 rounded-lg ${theme === 'LIGHT' ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`}>
              <Video className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${theme === 'LIGHT' ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`}
            >
              ×
            </button>
          </div>
        </div>

        {/* Job Context */}
        {selectedJob && (
          <div className={`p-3 border-b ${theme === 'LIGHT' ? 'bg-blue-50 border-blue-200' : 'bg-blue-900 border-blue-700'}`}>
            <p className={`text-sm ${theme === 'LIGHT' ? 'text-blue-800' : 'text-blue-200'}`}>
              <strong>Job:</strong> {selectedJob.title} - {selectedJob.location}
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className={`mt-2 text-sm ${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>
                Loading messages...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className={`h-12 w-12 mx-auto mb-4 ${theme === 'LIGHT' ? 'text-gray-400' : 'text-gray-600'}`} />
              <p className={`${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                No messages yet. Start a conversation!
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-xs lg:max-w-md ${message.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                  <img 
                    src={message.sender.imageUrl || '/api/dicebear/7.x/avataaars/svg?seed=default'} 
                    alt={message.sender.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className={`mx-2 ${message.senderId === user.id ? 'text-right' : 'text-left'}`}>
                    <div className={`px-4 py-2 rounded-lg ${
                      message.senderId === user.id
                        ? 'bg-blue-600 text-white'
                        : theme === 'LIGHT'
                          ? 'bg-gray-200 text-gray-900'
                          : 'bg-gray-700 text-white'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <p className={`text-xs mt-1 ${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className={`p-4 border-t ${theme === 'LIGHT' ? 'border-gray-200' : 'border-gray-700'}`}>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                theme === 'LIGHT' 
                  ? 'border-gray-300 bg-white text-gray-900' 
                  : 'border-gray-600 bg-gray-700 text-white'
              }`}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
