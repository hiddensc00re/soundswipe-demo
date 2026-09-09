import os
import django
import wave
from PIL import Image, ImageDraw, ImageFont

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "soundswipe_backend.settings")
django.setup()

from django.contrib.auth.models import User
from soundswipe_api.models import UserProfile, Track, Feedback, ChatRoom, ChatMessage
from django.core.files import File

def generate_silent_audio(filepath, duration_sec=5):
    """Generates a simple valid silent WAV file."""
    with wave.open(filepath, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(22050)
        # Write silence bytes (2 bytes per sample)
        w.writeframes(b'\x00' * (22050 * 2 * duration_sec))
    print(f"Generated silent WAV: {filepath}")

def generate_gradient_image(filepath, title, artist, color1, color2):
    """Generates a beautiful gradient cover image using Pillow."""
    width, height = 400, 400
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    
    # Draw simple diagonal gradient
    for y in range(height):
        for x in range(width):
            r = int(color1[0] + (color2[0] - color1[0]) * ((x + y) / (width + height)))
            g = int(color1[1] + (color2[1] - color1[1]) * ((x + y) / (width + height)))
            b = int(color1[2] + (color2[2] - color1[2]) * ((x + y) / (width + height)))
            image.putpixel((x, y), (r, g, b))
            
    # Draw text box decoration
    draw.rectangle([20, 300, 380, 380], fill=(0, 0, 0, 150))
    
    # Draw simple text
    draw.text((30, 310), title, fill=(255, 255, 255))
    draw.text((30, 340), f"by {artist}", fill=(200, 200, 200))
    
    image.save(filepath, "JPEG")
    print(f"Generated cover JPEG: {filepath}")

def seed_db():
    print("Seeding database...")
    
    # Clean old records
    User.objects.exclude(is_superuser=True).delete()
    Track.objects.all().delete()
    
    # Create Users
    creator1 = User.objects.create_user(username="alex_prod", password="password123")
    UserProfile.objects.create(user=creator1, role="creator")
    
    creator2 = User.objects.create_user(username="dj_neon", password="password123")
    UserProfile.objects.create(user=creator2, role="creator")
    
    listener1 = User.objects.create_user(username="sarah_ears", password="password123")
    UserProfile.objects.create(user=listener1, role="listener")
    
    listener2 = User.objects.create_user(username="john_beats", password="password123")
    UserProfile.objects.create(user=listener2, role="listener")
    
    # Ensure temporary output directories
    os.makedirs("temp_assets", exist_ok=True)
    
    # Track 1
    generate_silent_audio("temp_assets/track1.wav", duration_sec=8)
    generate_gradient_image("temp_assets/cover1.jpg", "Midnight Drift (Unfinished)", "Alex Prod", (15, 23, 42), (99, 102, 241))
    
    track1 = Track.objects.create(
        uploader=creator1,
        artist_name="Alex Prod",
        track_name="Midnight Drift (Unfinished Demo)",
        target_feedback="I need feedback on the bass drop around 4s and whether the synth melody feels too repetitive.",
        max_listeners=5,
        is_active=True
    )
    with open("temp_assets/track1.wav", "rb") as f:
        track1.audio_file.save("midnight_drift.wav", File(f))
    with open("temp_assets/cover1.jpg", "rb") as f:
        track1.cover_image.save("midnight_drift_cover.jpg", File(f))
    track1.save()
    
    # Track 2
    generate_silent_audio("temp_assets/track2.wav", duration_sec=10)
    generate_gradient_image("temp_assets/cover2.jpg", "Synthwave Sunset", "DJ Neon", (88, 28, 135), (236, 72, 153))
    
    track2 = Track.objects.create(
        uploader=creator2,
        artist_name="DJ Neon",
        track_name="Synthwave Sunset (Vocal Hook Test)",
        target_feedback="Are the vocals sitting well in the mix, or do they feel too loud? Also how is the transition at the end?",
        max_listeners=3,
        is_active=True
    )
    with open("temp_assets/track2.wav", "rb") as f:
        track2.audio_file.save("synthwave_sunset.wav", File(f))
    with open("temp_assets/cover2.jpg", "rb") as f:
        track2.cover_image.save("synthwave_cover.jpg", File(f))
    track2.save()

    # Track 3 (Already finished feedback / inactive)
    generate_silent_audio("temp_assets/track3.wav", duration_sec=5)
    generate_gradient_image("temp_assets/cover3.jpg", "Acoustic Warmth", "Alex Prod", (180, 83, 9), (245, 158, 11))
    
    track3 = Track.objects.create(
        uploader=creator1,
        artist_name="Alex Prod",
        track_name="Acoustic Warmth (Full Demo)",
        target_feedback="Let me know how the acoustic guitar EQ sounds.",
        max_listeners=2,
        is_active=False
    )
    with open("temp_assets/track3.wav", "rb") as f:
        track3.audio_file.save("acoustic_warmth.wav", File(f))
    with open("temp_assets/cover3.jpg", "rb") as f:
        track3.cover_image.save("acoustic_warmth.cover.jpg", File(f))
    track3.save()
    
    # Add a mock comment from listener1 on track3
    feedback1 = Feedback.objects.create(
        track=track3,
        listener=listener1,
        comment="The guitar EQ sounds very warm and crisp. Love it!"
    )
    
    # Create room and chat for track3 feedback
    room = ChatRoom.objects.create(
        track=track3,
        listener=listener1,
        uploader=creator1
    )
    
    ChatMessage.objects.create(
        room=room,
        sender=listener1,
        content="The guitar EQ sounds very warm and crisp. Love it!"
    )
    ChatMessage.objects.create(
        room=room,
        sender=creator1,
        content="Thanks Sarah! Do you think the high-end frequencies need a cut?"
    )
    
    print("Database seeded successfully with test creators, listeners, active tracks, and a chat history!")

if __name__ == "__main__":
    seed_db()
