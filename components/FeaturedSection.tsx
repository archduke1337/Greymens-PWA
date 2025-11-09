"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Users, Star, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { eventService, Event } from '@/lib/database';
import { Query } from 'appwrite';

export default function FeaturedSection() {
     const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
     const [loading, setLoading] = useState(true);
     const router = useRouter();
     const sectionRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
          fetchFeaturedEvents();
     }, []);

     const fetchFeaturedEvents = async () => {
          try {
               setLoading(true);
               const events = await eventService.getAllEvents([
                    Query.equal('isFeatured', true),
                    Query.equal('status', 'upcoming'),
                    Query.orderAsc('date'),
                    Query.limit(6)
               ]);
               setFeaturedEvents(events);
          } catch (error) {
               console.error('Error fetching featured events:', error);
          } finally {
               setLoading(false);
          }
     };

     const formatDate = (dateString: string) => {
          return new Date(dateString).toLocaleDateString('en-US', {
               month: 'short',
               day: 'numeric',
               year: 'numeric'
          });
     };

     const handleCardClick = (eventId: string) => {
          router.push(`/events/${eventId}`);
     };

     if (loading) {
          return (
               <section className="py-20 relative overflow-hidden bg-gradient-to-b from-purple-50/50 via-white to-pink-50/50 dark:from-purple-950/10 dark:via-transparent dark:to-pink-950/10">
                    <div className="max-w-7xl mx-auto px-6">
                         <div className="text-center space-y-4">
                              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent"></div>
                              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Loading featured events...</p>
                         </div>
                    </div>
               </section>
          );
     }

     if (featuredEvents.length === 0) {
          return null;
     }

     return (
          <section ref={sectionRef} className="py-20 relative overflow-hidden ">
               {/* Decorative Elements */}
               <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
               </div>

               <div className="max-w-7xl mx-auto px-6 relative z-10">
                    {/* Header */}
                    <div className="text-center mb-16 space-y-4">
                         <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur-lg border border-purple-200 dark:border-purple-800 shadow-lg">
                              <Sparkles className="w-5 h-5 text-purple-600" />
                              <span className="font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                                   Featured Events
                              </span>
                         </div>

                         <h2 className="text-4xl md:text-5xl lg:text-6xl font-black">
                              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                                   Don't Miss Out
                              </span>
                         </h2>
                         
                         <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                              Join our most anticipated events and be part of something extraordinary
                         </p>
                    </div>

                    {/* Events Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                         {featuredEvents.map((event, index) => (
                              <div
                                   key={event.$id}
                                   onClick={() => handleCardClick(event.$id!)}
                                   className="group cursor-pointer"
                                   style={{ 
                                        animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both` 
                                   }}
                              >
                                   <div className="relative bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border border-purple-100 dark:border-purple-900/30">
                                        {/* Image Section */}
                                        <div className="relative h-64 overflow-hidden">
                                             <img
                                                  src={event.image}
                                                  alt={event.title}
                                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                             />
                                             
                                             {/* Gradient Overlay */}
                                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                                             {/* Badges */}
                                             <div className="absolute top-4 left-4 flex flex-col gap-2">
                                                  {event.isFeatured && (
                                                       <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-500 text-white text-xs font-bold shadow-lg">
                                                            <Star className="w-3 h-3" />
                                                            Featured
                                                       </div>
                                                  )}
                                                  {event.isPremium && (
                                                       <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg">
                                                            <Crown className="w-3 h-3" />
                                                            Premium
                                                       </div>
                                                  )}
                                             </div>

                                             {/* Category */}
                                             <div className="absolute top-4 right-4">
                                                  <span className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold border border-white/30">
                                                       {event.category}
                                                  </span>
                                             </div>

                                             {/* Date Badge */}
                                             <div className="absolute bottom-4 left-4">
                                                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/95 dark:bg-black/95 backdrop-blur-md shadow-lg">
                                                       <Calendar className="w-4 h-4 text-purple-600" />
                                                       <span className="font-bold text-sm">{formatDate(event.date)}</span>
                                                  </div>
                                             </div>
                                        </div>

                                        {/* Content Section */}
                                        <div className="p-6 space-y-4">
                                             {/* Title */}
                                             <h3 className="text-2xl font-black text-gray-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                  {event.title}
                                             </h3>

                                             {/* Description */}
                                             <p className="text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                                  {event.description}
                                             </p>

                                             {/* Details */}
                                             <div className="space-y-3 pt-2">
                                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                       <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                                            <MapPin className="w-4 h-4 text-purple-600" />
                                                       </div>
                                                       <span className="font-medium">{event.location}</span>
                                                  </div>

                                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                       <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                                                            <Users className="w-4 h-4 text-pink-600" />
                                                       </div>
                                                       <span className="font-medium">{event.registered} registered</span>
                                                       {event.capacity && (
                                                            <span className="text-xs text-gray-500">
                                                                 • {event.capacity - event.registered} spots left
                                                            </span>
                                                       )}
                                                  </div>
                                             </div>

                                             {/* Tags */}
                                             <div className="flex flex-wrap gap-2 pt-2">
                                                  {event.tags.slice(0, 3).map((tag, idx) => (
                                                       <span
                                                            key={idx}
                                                            className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium"
                                                       >
                                                            {tag}
                                                       </span>
                                                  ))}
                                             </div>

                                             {/* Price & CTA */}
                                             <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                                                  <div>
                                                       {event.discountPrice && event.discountPrice < event.price ? (
                                                            <div className="flex items-center gap-2">
                                                                 <span className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                                                      ${event.discountPrice}
                                                                 </span>
                                                                 <span className="text-sm text-gray-400 line-through">
                                                                      ${event.price}
                                                                 </span>
                                                            </div>
                                                       ) : event.price === 0 ? (
                                                            <span className="text-2xl font-black text-green-600">Free</span>
                                                       ) : (
                                                            <span className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                                                 ${event.price}
                                                            </span>
                                                       )}
                                                  </div>

                                                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold group-hover:gap-3 transition-all">
                                                       <span className="text-sm">View Details</span>
                                                       <ArrowRight className="w-4 h-4" />
                                                  </div>
                                             </div>
                                        </div>
                                   </div>
                              </div>
                         ))}
                    </div>

                    {/* View All Button */}
                    <div className="text-center mt-16">
                         <button
                              onClick={() => router.push('/events')}
                              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                         >
                              <span>Explore All Events</span>
                              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                         </button>
                    </div>
               </div>

               <style jsx>{`
                    @keyframes fadeInUp {
                         from {
                              opacity: 0;
                              transform: translateY(30px);
                         }
                         to {
                              opacity: 1;
                              transform: translateY(0);
                         }
                    }
               `}</style>
          </section>
     );
}