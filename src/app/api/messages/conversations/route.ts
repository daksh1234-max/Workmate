import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, getTokenFromHeader } from '@/lib/auth';

// GET /api/messages/conversations - Get all conversations for current user
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization') ?? undefined);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get distinct users that the current user has conversations with
    // This includes both sent and received messages
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: decoded.userId },
          { receiverId: decoded.userId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            role: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group messages by conversation partner
    const conversationMap = new Map<number, {
      user: any;
      lastMessage: any;
      unreadCount: number;
      jobId?: number;
    }>();

    messages.forEach((msg) => {
      // Determine the other user in the conversation
      const otherUser = msg.senderId === decoded.userId ? msg.receiver : msg.sender;
      const otherUserId = otherUser.id;

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          user: otherUser,
          lastMessage: msg,
          unreadCount: msg.receiverId === decoded.userId && !msg.isRead ? 1 : 0,
          jobId: msg.jobId ?? undefined
        });
      } else {
        const conv = conversationMap.get(otherUserId)!;
        // Update unread count
        if (msg.receiverId === decoded.userId && !msg.isRead) {
          conv.unreadCount++;
        }
        // Update last message if this one is more recent
        if (new Date(msg.createdAt) > new Date(conv.lastMessage.createdAt)) {
          conv.lastMessage = msg;
        }
      }
    });

    // Convert map to array and sort by last message time
    const conversations = Array.from(conversationMap.values()).sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    return NextResponse.json({ conversations });

  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
