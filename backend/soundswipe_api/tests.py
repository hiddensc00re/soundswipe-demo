from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import UserProfile, Track, Feedback, ChatRoom, ChatMessage

class SoundSwipeAPITests(APITestCase):

    def setUp(self):
        # Create test users
        self.creator = User.objects.create_user(username="test_creator", password="password123")
        self.creator_profile = UserProfile.objects.create(user=self.creator, role="creator")
        
        self.listener = User.objects.create_user(username="test_listener", password="password123")
        self.listener_profile = UserProfile.objects.create(user=self.listener, role="listener")
        
        # Create a track (simulate audio file in tests using a mock string or empty file)
        # For tests, we can skip actual file uploads if we test GET views, but we can mock values.
        self.track = Track.objects.create(
            uploader=self.creator,
            artist_name="Test Creator",
            track_name="Test Track",
            audio_file="tracks/test.wav",
            cover_image="covers/test.jpg",
            target_feedback="EQ feedback",
            max_listeners=5,
            is_active=True
        )

    def test_user_registration(self):
        url = reverse('register')
        data = {
            'username': 'new_user',
            'password': 'password123',
            'role': 'listener'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], 'new_user')
        self.assertEqual(response.data['role'], 'listener')

    def test_user_login(self):
        url = reverse('login')
        data = {
            'username': 'test_creator',
            'password': 'password123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'creator')

    def test_get_swipe_deck(self):
        url = reverse('swipe_deck')
        # Call without auth headers -> should fail
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Call with X-User-ID header
        response = self.client.get(url, HTTP_X_USER_ID=str(self.listener.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['track_name'], 'Test Track')

    def test_submit_feedback_creates_chat(self):
        url = reverse('submit_feedback')
        data = {
            'track_id': self.track.id,
            'comment': 'I suggest modifying the snare reverb.'
        }
        # Submit feedback
        response = self.client.post(url, data, format='json', HTTP_X_USER_ID=str(self.listener.id))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'feedback_saved')
        
        # Verify ChatRoom was created
        room_exists = ChatRoom.objects.filter(track=self.track, listener=self.listener).exists()
        self.assertTrue(room_exists)
        
        # Verify chat message was auto-added
        room = ChatRoom.objects.get(track=self.track, listener=self.listener)
        self.assertEqual(room.messages.count(), 1)
        self.assertEqual(room.messages.first().content, 'I suggest modifying the snare reverb.')
