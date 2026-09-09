# SoundSwipe Project Review

SoundSwipe is a web application designed to connect music creators with listeners for targeted feedback on unreleased or work-in-progress tracks. It adopts a Tinder-like swipe interface to make track discovery and feedback engaging.

## 1. Project Architecture
The project is split into a separated frontend and backend architecture.

### Backend (Django + Django REST Framework)
The backend is built with Python using the Django framework and Django REST Framework (DRF) for building the API.
- **Database:** Uses a lightweight SQLite database (`db.sqlite3`), suitable for development and small-scale deployments.
- **Data Models:**
  - `User` and `UserProfile`: Extends the default Django user to include roles (`listener` or `creator`).
  - `Track`: Stores uploaded tracks, including audio file, cover image, artist name, the specific feedback targeted by the artist, and a `max_listeners` limit.
  - `Feedback`: Stores the feedback comments left by listeners on tracks.
  - `ChatRoom` & `ChatMessage`: Facilitates 1-on-1 private messaging between the listener and the track creator after feedback is submitted. Includes a simulated blockchain consensus mechanism (`is_blockchain_pending`, `is_blockchain_written`, `blockchain_tx_hash`).
  - `SavedTrack`: Allows listeners to bookmark tracks to revisit later.
- **API Endpoints:** Includes authentication (`/login/`, `/register/`), fetching the swipe deck (`/deck/`), handling track uploads (`/tracks/`), managing feedback and chats (`/feedback/`, `/chats/`), and simulated blockchain consent.

### Frontend (React + Vite)
The frontend is a single-page application built with React and bundled using Vite. It doesn't use TypeScript, opting for standard JSX.
- **State Management:** Uses React's built-in hooks (`useState`, `useEffect`, `useRef`) for managing UI states, audio playback, and dragging/swiping mechanics.
- **Key Views:**
  - **Swipe Deck:** A draggable card interface where listeners can listen to a track, read the artist's feedback request, and swipe left (skip) or right (leave feedback).
  - **Saved Tracks:** A simple list of tracks the user bookmarked.
  - **Chat Workspace:** A messaging interface for listeners and artists to discuss the track. It includes interactive badges for "Blockchain Ledger" consent on specific messages.
  - **Upload (Creators only):** A form for artists to upload new tracks, specifying their target feedback and listener limits.

## 2. How It Works (User Flow)
1. **Authentication:** Users can sign up as either a `listener` or `creator`.
2. **Uploading (Creators):** A creator uploads an audio file, cover art, and a prompt detailing what feedback they want (e.g., "How is the bass mixing?"). They also set a maximum number of listeners.
3. **Swiping (Listeners):** Listeners see a deck of tracks. They can play the track using a custom HTML5 audio player overlay on the card.
4. **Giving Feedback:** 
   - If the listener swipes right, a modal prompts them to write a feedback comment. 
   - Submitting the comment triggers a mock payment/checkout flow.
   - Once processed, the feedback is saved, and a private `ChatRoom` is automatically created between the listener and the creator.
   - If the track reaches its `max_listeners` limit, it becomes inactive and is removed from the deck.
5. **Private Chat & Blockchain Consent:** Inside the chat room, users can discuss the feedback. They can click on messages to request "Blockchain Consent." The other user can approve it, generating a mock SHA-256 hash to simulate immutable ledger writing for intellectual property or proof-of-feedback protection.

## 3. Design and Aesthetics
- **Visuals:** The app uses a dark mode aesthetic with vibrant accent colors (e.g., pink/purple gradients for active states and shadows). 
- **Interactions:** The core interaction relies on drag-and-drop mechanics mimicking dating apps. The cards tilt and change box-shadow colors dynamically based on the swipe direction (red for left, purple for right).
- **Audio Player:** The frontend features a custom audio player integrated directly into the swipe card, featuring a decorative animated visualizer and time tracking.
- **Responsiveness:** The layout relies on flexbox and absolute positioning for the card deck, making it look like a mobile-first application even on desktop viewports.

## 4. Summary & Potential Improvements
**Strengths:**
- The swipe mechanic makes giving feedback fun and engaging.
- The separation of roles (listener/creator) provides a clear dual-sided marketplace workflow.
- The mock blockchain ledger is a unique feature that could be interesting for music rights or verifiable feedback in the real world.

**Areas for Improvement:**
- **Frontend Code Structure:** The entire frontend logic is currently crammed into a massive `App.jsx` file (over 1200 lines). This should be heavily refactored into smaller, reusable components (e.g., `SwipeCard`, `AudioPlayer`, `ChatRoom`, `AuthModal`).
- **Security:** The backend uses a simple custom header (`X-User-ID`) or basic session auth for API requests. A robust JWT token authentication system (like `djangorestframework-simplejwt`) would be more secure.
- **Error Handling:** Some API errors simply trigger an `alert()` or console log on the frontend. A toast notification system would improve the user experience.
- **Media Hosting:** Currently, audio and image files are stored locally in the `media/` folder. For production, these should be offloaded to cloud storage (e.g., AWS S3).
