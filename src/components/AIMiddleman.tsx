'use client';

import { useState, useEffect } from 'react';
import { Bot, Sparkles, TrendingUp, Users, MapPin, Star, MessageCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface AIMiddlemanProps {
  user: any;
  jobs: any[];
  onRecommendationClick: (job: any) => void;
}

export default function AIMiddleman({ user, jobs, onRecommendationClick }: AIMiddlemanProps) {
  const { theme } = useTheme();
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('insights');
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);

  useEffect(() => {
    if (user && jobs.length > 0) {
      generateAIInsights();
    }
  }, [user, jobs]);

  const generateAIInsights = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: user.role === 'labourer' ? 'jobs' : 'labourers',
          userId: user.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiInsights(data);
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMarketInsights = () => {
    const totalJobs = jobs.length;
    const avgWage = totalJobs > 0 ? jobs.reduce((sum, job) => sum + job.wage, 0) / totalJobs : 0;
    const topCategories = jobs.reduce((acc, job) => {
      const category = job.category || 'General';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as any);
    
    const mostPopularCategory = Object.entries(topCategories)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];

    return {
      totalJobs,
      avgWage: Math.round(avgWage),
      mostPopularCategory: mostPopularCategory ? String(mostPopularCategory[0]) : 'General',
      categoryCount: mostPopularCategory ? Number(mostPopularCategory[1]) : 0
    };
  };

  const getPersonalizedTips = () => {
    if (user.role === 'labourer') {
      return [
        "Complete your profile to increase visibility by 40%",
        "Add specific skills to get better job matches",
        "Apply to jobs within 24 hours for higher success rates",
        "Include a personalized message when applying"
      ];
    } else {
      return [
        "Post jobs with detailed descriptions for better matches",
        "Set competitive wages to attract quality workers",
        "Respond to applications within 48 hours",
        "Use specific skill requirements for better filtering"
      ];
    }
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
        let candidate: string | null = null;
        let skillCandidate: string | null = null;
        
        if (match[2] && match[1]) {
          const first = match[1].trim().toLowerCase();
          const second = match[2].trim().toLowerCase();
          
          if (knownLocations.includes(second) || (!knownLocations.includes(first) && knownLocations.includes(second))) {
            candidate = second;
            skillCandidate = first;
          } else if (knownLocations.includes(first)) {
            candidate = first;
            skillCandidate = second;
          } else {
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
          const isSkill = explicitSkills.some(skill => {
            const baseSkill = skill.split(' ')[0];
            return candidate!.includes(baseSkill) || baseSkill.includes(candidate!);
          });
          if (!stopwords.has(candidate) && !isSkill && knownLocations.includes(candidate)) {
            location = candidate;
            if (skillCandidate) extractedSkillFromLocationPattern = skillCandidate;
            break;
          } else if (!stopwords.has(candidate) && !isSkill && candidate.length > 2) {
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
    
    // First, check if we extracted a skill from location pattern
    if (extractedSkillFromLocationPattern) {
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
        if (!foundSkills.includes(extractedSkillFromLocationPattern)) {
          foundSkills.push(extractedSkillFromLocationPattern);
        }
      }
    }
    
    for (const skill of explicitSkills) {
      const skillRegex = new RegExp(`\\b${skill}\\b`, 'i');
      if (skillRegex.test(lowerText)) {
        const normalized = skill.split(' ')[0];
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

    if (foundSkills.length === 0) {
      const skillFallbackPatterns = [
        /(?:jobs?|work)\s+(?:of|as|for)\s+(\w+)/i,
        /(?:need|want|looking|find)\s+(?:a\s+)?(\w+)/i,
        /(?:jobs?|work|opportunity)\s+(?:in|for)\s+(\w+)/i
      ];
      
      for (const pattern of skillFallbackPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const word = match[1].toLowerCase();
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

  const askAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResults([]);
    try {
      const token = localStorage.getItem('token');
      const { skills, location } = extractJobKeywords(aiQuery);
      
      if (skills.length > 0 || location) {
        // Build query params
        const params = new URLSearchParams();
        if (skills.length > 0) {
          params.append('skill', skills.join(','));
        }
        if (location) {
          params.append('location', location);
        }
        params.append('limit', '10');
        
        const res = await fetch(`/api/jobs?${params.toString()}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setAiResults(data.jobs || []);
        }
      } else {
        const res = await fetch('/api/ai/recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ type: user.role === 'labourer' ? 'jobs' : 'labourers', userId: user.id })
        });
        if (res.ok) {
          const data = await res.json();
          setAiResults(data.recommendations || []);
        }
      }
    } catch (e) {
      console.error('AI ask error:', e);
    } finally {
      setAiLoading(false);
    }
  };

  const marketInsights = getMarketInsights();
  const tips = getPersonalizedTips();

  return (
    <div className={`rounded-lg shadow-lg p-6 ${theme === 'LIGHT' ? 'bg-white' : 'bg-gray-800'}`}>
      <div className="flex items-center mb-6">
        <div className="p-2 bg-blue-100 rounded-lg mr-3">
          <Bot className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className={`text-lg font-semibold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
            AI Assistant
          </h3>
          <p className={`text-sm ${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'}`}>
            Your intelligent job matching companion
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'insights'
              ? 'bg-blue-600 text-white'
              : theme === 'LIGHT'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <TrendingUp className="h-4 w-4 inline mr-2" />
          Market Insights
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'recommendations'
              ? 'bg-blue-600 text-white'
              : theme === 'LIGHT'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Sparkles className="h-4 w-4 inline mr-2" />
          Recommendations
        </button>
        <button
          onClick={() => setActiveTab('tips')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'tips'
              ? 'bg-blue-600 text-white'
              : theme === 'LIGHT'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <MessageCircle className="h-4 w-4 inline mr-2" />
          Tips
        </button>
      </div>

      {/* Content */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <h4 className={`font-semibold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
            Market Insights
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${theme === 'LIGHT' ? 'bg-blue-50' : 'bg-blue-900'}`}>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-2" />
                <span className={`text-sm font-medium ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                  Total Jobs
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                {marketInsights.totalJobs}
              </p>
            </div>

            <div className={`p-4 rounded-lg ${theme === 'LIGHT' ? 'bg-green-50' : 'bg-green-900'}`}>
              <div className="flex items-center">
                <Star className="h-5 w-5 text-green-600 mr-2" />
                <span className={`text-sm font-medium ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                  Avg Wage
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
                ₹{marketInsights.avgWage}/day
              </p>
            </div>
          </div>

          <div className={`p-4 rounded-lg ${theme === 'LIGHT' ? 'bg-yellow-50' : 'bg-yellow-900'}`}>
            <div className="flex items-center">
              <MapPin className="h-5 w-5 text-yellow-600 mr-2" />
              <span className={`text-sm font-medium ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                Most Popular Category
              </span>
            </div>
            <p className={`text-lg font-semibold mt-1 ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
              {String(marketInsights.mostPopularCategory)} ({marketInsights.categoryCount} jobs)
            </p>
          </div>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <h4 className={`${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'} font-semibold`}>
            AI Recommendations
          </h4>

          <div className="flex space-x-2">
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Ask for jobs (e.g., outdoor, gardening)"
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                theme === 'LIGHT' ? 'border-gray-300 bg-white text-gray-900' : 'border-gray-600 bg-gray-700 text-white'
              }`}
            />
            <button
              onClick={askAI}
              disabled={aiLoading || !aiQuery.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Ask
            </button>
          </div>

          {aiLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className={`${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'} mt-2 text-sm`}>
                Finding matches...
              </p>
            </div>
          ) : aiResults.length > 0 ? (
            <div className="space-y-3">
              {aiResults.map((rec: any, index: number) => (
                <div
                  key={index}
                  onClick={() => onRecommendationClick(rec)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    theme === 'LIGHT' ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50' : 'border-gray-600 hover:border-blue-500 hover:bg-blue-900'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className={`${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'} font-medium`}>
                        {rec.title || rec.name}
                      </h5>
                      <p className={`${theme === 'LIGHT' ? 'text-gray-600' : 'text-gray-400'} text-sm mt-1`}>
                        {rec.description || rec.skills}
                      </p>
                    </div>
                    {typeof rec.matchScore === 'number' && (
                      <div className="ml-4">
                        <div className={`${rec.matchScore > 0.8 ? 'bg-green-100 text-green-800' : rec.matchScore > 0.6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'} px-2 py-1 rounded-full text-xs font-medium`}>
                          {Math.round(rec.matchScore * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${theme === 'LIGHT' ? 'text-gray-500' : 'text-gray-400'} text-center py-8`}>
              <p>No results yet. Ask the assistant above.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tips' && (
        <div className="space-y-4">
          <h4 className={`font-semibold ${theme === 'LIGHT' ? 'text-gray-900' : 'text-white'}`}>
            Personalized Tips
          </h4>
          
          <div className="space-y-3">
            {tips.map((tip, index) => (
              <div key={index} className={`p-3 rounded-lg ${theme === 'LIGHT' ? 'bg-gray-50' : 'bg-gray-700'}`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    {index + 1}
                  </div>
                  <p className={`text-sm ${theme === 'LIGHT' ? 'text-gray-700' : 'text-gray-300'}`}>
                    {tip}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
