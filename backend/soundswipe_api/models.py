from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('listener', 'Listener'),
        ('creator', 'Creator'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='listener')

    def __str__(self):
        return f"{self.user.username} ({self.role})"

class Track(models.Model):
    uploader = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_tracks')
    artist_name = models.CharField(max_length=255)
    track_name = models.CharField(max_length=255)
    audio_file = models.FileField(upload_to='tracks/')
    cover_image = models.ImageField(upload_to='covers/', blank=True, null=True)
    target_feedback = models.TextField(help_text="What the artist is looking for to improve the track")
    max_listeners = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.artist_name} - {self.track_name}"

class Feedback(models.Model):
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name='feedbacks')
    listener = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_feedbacks')
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feedback by {self.listener.username} on {self.track.track_name}"

class ChatRoom(models.Model):
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name='chat_rooms')
    listener = models.ForeignKey(User, on_delete=models.CASCADE, related_name='listener_chats')
    uploader = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploader_chats')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('track', 'listener', 'uploader')

    def __str__(self):
        return f"Chat re: {self.track.track_name} ({self.uploader.username} & {self.listener.username})"

class ChatMessage(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_blockchain_pending = models.BooleanField(default=False)
    is_blockchain_written = models.BooleanField(default=False)
    blockchain_tx_hash = models.CharField(max_length=64, blank=True, null=True)

    def __str__(self):
        return f"{self.sender.username} in Room {self.room.id} at {self.timestamp}"

class SavedTrack(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_tracks')
    track = models.ForeignKey(Track, on_delete=models.CASCADE)
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'track')

    def __str__(self):
        return f"{self.user.username} saved {self.track.track_name}"
