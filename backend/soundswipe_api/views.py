import os
import hashlib
from django.shortcuts import render, get_object_or_404
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import authenticate, login as django_login
from django.contrib.auth.models import User
from django.db.models import Q
from .models import UserProfile, Track, Feedback, ChatRoom, ChatMessage, SavedTrack

def get_user_from_request(request):
    """
    Helper to get user from session, token, or X-User-ID header for easy frontend integration.
    """
    if request.user.is_authenticated:
        return request.user
    
    user_id = request.headers.get('X-User-ID')
    if user_id:
        try:
            return User.objects.get(id=int(user_id))
        except (ValueError, User.DoesNotExist):
            pass
    return None

@api_view(['POST'])
def register_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    role = request.data.get('role', 'listener')
    
    if not username or not password:
        return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)
        
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
    user = User.objects.create_user(username=username, password=password)
    profile = UserProfile.objects.create(user=user, role=role)
    
    return Response({
        'user_id': user.id,
        'username': user.username,
        'role': profile.role
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def login_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)
        
    user = authenticate(username=username, password=password)
    if user is not None:
        profile, created = UserProfile.objects.get_or_create(user=user)
        return Response({
            'user_id': user.id,
            'username': user.username,
            'role': profile.role
        })
    else:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser])
def track_list_create(request):
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if request.method == 'POST':
        profile = getattr(user, 'profile', None)
        if not profile or profile.role != 'creator':
            return Response({'error': 'Only creators can upload tracks'}, status=status.HTTP_403_FORBIDDEN)
            
        artist_name = request.data.get('artist_name', user.username)
        track_name = request.data.get('track_name')
        audio_file = request.FILES.get('audio_file')
        cover_image = request.FILES.get('cover_image')
        target_feedback = request.data.get('target_feedback', '')
        max_listeners = int(request.data.get('max_listeners', 5))
        
        if not track_name or not audio_file:
            return Response({'error': 'Track name and audio file are required'}, status=status.HTTP_400_BAD_REQUEST)
            
        track = Track.objects.create(
            uploader=user,
            artist_name=artist_name,
            track_name=track_name,
            audio_file=audio_file,
            cover_image=cover_image,
            target_feedback=target_feedback,
            max_listeners=min(max_listeners, 5),
            is_active=True
        )
        
        return Response({
            'id': track.id,
            'artist_name': track.artist_name,
            'track_name': track.track_name,
            'audio_url': track.audio_file.url,
            'cover_url': track.cover_image.url if track.cover_image else None,
            'target_feedback': track.target_feedback,
            'max_listeners': track.max_listeners
        }, status=status.HTTP_201_CREATED)
        
    elif request.method == 'GET':
        profile = getattr(user, 'profile', None)
        if profile and profile.role == 'creator':
            tracks = Track.objects.filter(uploader=user)
        else:
            tracks = Track.objects.filter(is_active=True)
            
        data = []
        for t in tracks:
            feedback_count = t.feedbacks.count()
            data.append({
                'id': t.id,
                'artist_name': t.artist_name,
                'track_name': t.track_name,
                'audio_url': t.audio_file.url,
                'cover_url': t.cover_image.url if t.cover_image else None,
                'target_feedback': t.target_feedback,
                'max_listeners': t.max_listeners,
                'feedback_count': feedback_count,
                'is_active': t.is_active,
                'created_at': t.created_at
            })
        return Response(data)

@api_view(['GET'])
def get_swipe_deck(request):
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
    commented_track_ids = Feedback.objects.filter(listener=user).values_list('track_id', flat=True)
    deck_tracks = Track.objects.filter(is_active=True).exclude(id__in=commented_track_ids).exclude(uploader=user)
    deck_tracks = deck_tracks.order_by('?')
    
    data = []
    for t in deck_tracks:
        data.append({
            'id': t.id,
            'artist_name': t.artist_name,
            'track_name': t.track_name,
            'audio_url': t.audio_file.url,
            'cover_url': t.cover_image.url if t.cover_image else None,
            'target_feedback': t.target_feedback,
            'max_listeners': t.max_listeners,
            'feedback_count': t.feedbacks.count()
        })
    return Response(data)

@api_view(['POST'])
def submit_feedback(request):
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
    track_id = request.data.get('track_id')
    comment = request.data.get('comment')
    
    if not track_id or not comment:
        return Response({'error': 'Track ID and comment are required'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        track = Track.objects.get(id=int(track_id))
    except (ValueError, Track.DoesNotExist):
        return Response({'error': 'Track not found'}, status=status.HTTP_404_NOT_FOUND)
        
    if not track.is_active:
        return Response({'error': 'Track is no longer accepting feedback'}, status=status.HTTP_400_BAD_REQUEST)
        
    if Feedback.objects.filter(track=track, listener=user).exists():
        return Response({'error': 'You already left feedback on this track'}, status=status.HTTP_400_BAD_REQUEST)
        
    feedback = Feedback.objects.create(
        track=track,
        listener=user,
        comment=comment
    )
    
    SavedTrack.objects.filter(user=user, track=track).delete()
    
    current_count = track.feedbacks.count()
    if current_count >= track.max_listeners:
        track.is_active = False
        track.save()
        
    room, created = ChatRoom.objects.get_or_create(
        track=track,
        listener=user,
        uploader=track.uploader
    )
    
    ChatMessage.objects.create(
        room=room,
        sender=user,
        content=comment
    )
    
    return Response({
        'status': 'feedback_saved',
        'feedback_id': feedback.id,
        'chat_room_id': room.id,
        'track_active': track.is_active
    }, status=status.HTTP_201_CREATED)

@api_view(['GET', 'POST'])
def chat_rooms_list(request):
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
    if request.method == 'GET':
        rooms = ChatRoom.objects.filter(Q(listener=user) | Q(uploader=user)).order_by('-created_at')
        data = []
        for r in rooms:
            last_msg = r.messages.order_by('-timestamp').first()
            other_user = r.uploader if r.listener == user else r.listener
            data.append({
                'id': r.id,
                'track_id': r.track.id,
                'track_name': r.track.track_name,
                'artist_name': r.track.artist_name,
                'other_username': other_user.username,
                'other_role': other_user.profile.role if hasattr(other_user, 'profile') else 'listener',
                'last_message': last_msg.content if last_msg else '',
                'last_message_time': last_msg.timestamp if last_msg else r.created_at
            })
        return Response(data)

@api_view(['GET', 'POST'])
def chat_messages(request, room_id):
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        room = ChatRoom.objects.get(id=int(room_id))
    except (ValueError, ChatRoom.DoesNotExist):
        return Response({'error': 'Chat room not found'}, status=status.HTTP_404_NOT_FOUND)
        
    if room.listener != user and room.uploader != user:
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
    if request.method == 'POST':
        content = request.data.get('content')
        if not content:
            return Response({'error': 'Message content required'}, status=status.HTTP_400_BAD_REQUEST)
            
        msg = ChatMessage.objects.create(
            room=room,
            sender=user,
            content=content
        )
        return Response({
            'id': msg.id,
            'sender_id': msg.sender.id,
            'sender_username': msg.sender.username,
            'content': msg.content,
            'timestamp': msg.timestamp,
            'is_blockchain_pending': msg.is_blockchain_pending,
            'is_blockchain_written': msg.is_blockchain_written,
            'blockchain_tx_hash': msg.blockchain_tx_hash
        }, status=status.HTTP_201_CREATED)
        
    elif request.method == 'GET':
        messages = room.messages.order_by('timestamp')
        data = []
        for m in messages:
            data.append({
                'id': m.id,
                'sender_id': m.sender.id,
                'sender_username': m.sender.username,
                'content': m.content,
                'timestamp': m.timestamp,
                'is_blockchain_pending': m.is_blockchain_pending,
                'is_blockchain_written': m.is_blockchain_written,
                'blockchain_tx_hash': m.blockchain_tx_hash
            })
        return Response(data)

@api_view(['POST'])
def blockchain_consent(request, message_id):
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        msg = ChatMessage.objects.get(id=int(message_id))
    except (ValueError, ChatMessage.DoesNotExist):
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
        
    room = msg.room
    if room.listener != user and room.uploader != user:
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
    action = request.data.get('action')
    
    if action == 'request':
        msg.is_blockchain_pending = True
        msg.save()
        return Response({
            'id': msg.id,
            'is_blockchain_pending': msg.is_blockchain_pending,
            'is_blockchain_written': msg.is_blockchain_written
        })
        
    elif action == 'approve':
        if not msg.is_blockchain_pending:
            return Response({'error': 'No blockchain request pending for this message'}, status=status.HTTP_400_BAD_REQUEST)
            
        payload = f"{msg.id}-{msg.content}-{room.listener.username}-{room.uploader.username}".encode('utf-8')
        mock_hash = hashlib.sha256(payload).hexdigest()
        
        msg.is_blockchain_pending = False
        msg.is_blockchain_written = True
        msg.blockchain_tx_hash = f"0x{mock_hash}"
        msg.save()
        
        return Response({
            'id': msg.id,
            'is_blockchain_pending': msg.is_blockchain_pending,
            'is_blockchain_written': msg.is_blockchain_written,
            'blockchain_tx_hash': msg.blockchain_tx_hash
        })
        
    else:
        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST', 'DELETE'])
def saved_tracks_view(request):
    user = get_user_from_request(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
    if request.method == 'GET':
        saved = SavedTrack.objects.filter(user=user)
        data = []
        for s in saved:
            t = s.track
            data.append({
                'id': t.id,
                'artist_name': t.artist_name,
                'track_name': t.track_name,
                'audio_url': t.audio_file.url,
                'cover_url': t.cover_image.url if t.cover_image else None,
                'target_feedback': t.target_feedback,
                'saved_at': s.saved_at
            })
        return Response(data)
        
    elif request.method == 'POST':
        track_id = request.data.get('track_id')
        if not track_id:
            return Response({'error': 'Track ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            track = Track.objects.get(id=int(track_id))
        except (ValueError, Track.DoesNotExist):
            return Response({'error': 'Track not found'}, status=status.HTTP_404_NOT_FOUND)
            
        saved_track, created = SavedTrack.objects.get_or_create(user=user, track=track)
        return Response({'status': 'track_saved', 'created': created}, status=status.HTTP_201_CREATED)
        
    elif request.method == 'DELETE':
        track_id = request.query_params.get('track_id') or request.data.get('track_id')
        if not track_id:
            return Response({'error': 'Track ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        SavedTrack.objects.filter(user=user, track_id=int(track_id)).delete()
        return Response({'status': 'track_unsaved'})

@api_view(['GET'])
def api_root(request):
    return Response({
        'name': 'SoundSwipe API',
        'status': 'online',
        'version': '1.0.0',
        'endpoints': {
            'register': '/api/register/',
            'login': '/api/login/',
            'tracks': '/api/tracks/',
            'deck': '/api/deck/',
            'feedback': '/api/feedback/',
            'chats': '/api/chats/',
            'saved': '/api/saved/'
        }
    })
