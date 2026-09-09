from django.urls import path
from . import views

urlpatterns = [
    path('', views.api_root, name='api_root'),
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('tracks/', views.track_list_create, name='tracks'),
    path('deck/', views.get_swipe_deck, name='deck'),
    path('feedback/', views.submit_feedback, name='feedback'),
    path('chats/', views.chat_rooms_list, name='chats'),
    path('chats/<int:room_id>/', views.chat_messages, name='chat_messages'),
    path('messages/<int:message_id>/blockchain/', views.blockchain_consent, name='blockchain_consent'),
    path('saved/', views.saved_tracks_view, name='saved_tracks'),
]
