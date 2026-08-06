# PoseFit — System Diagrams

This document contains all the diagrams mentioned in the final report, formatted using **Mermaid.js**. If you are using VS Code, you can view these by installing the "Markdown Preview Mermaid Support" extension, or simply by using GitHub's native Markdown viewer.

## 1. Use Case Diagram (Functional Requirements)

```mermaid
flowchart LR
    %% Actors
    User((User))

    %% System Boundary
    subgraph PoseFit System
        UC1[User Registration & Authentication]
        UC2[Biometric Profiling & Onboarding]
        UC3[Postural Assessment]
        UC4[Exercise Recommendation]
        UC5[Real-Time Tracking & Form Correction]
        UC6[Workout History Review]
        UC7[Doctor Consultation & Booking]
    end

    %% Relationships
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC5
    User --> UC6
    User --> UC7
```

## 2. Activity Diagram (Onboarding Flow)

```mermaid
stateDiagram-v2
    [*] --> SplashScreen
    
    SplashScreen --> WelcomePage : Load Complete
    
    WelcomePage --> AuthAPI : Register / Login
    AuthAPI --> WelcomePage : Invalid Credentials
    AuthAPI --> PhysiologicalProfile : JWT Tokens Verified
    
    PhysiologicalProfile --> GoalSelection : Enter Age, Sex, Height, Weight
    
    GoalSelection --> GoalsConfirmation : Select (e.g., Weight Loss, Rehab)
    
    GoalsConfirmation --> CameraPermission : Confirm Goals
    
    CameraPermission --> PosturalScan : Granted
    CameraPermission --> OnboardingComplete : Denied (Skip Assessment)
    
    PosturalScan --> MediaPipe : Capture Body Photo
    MediaPipe --> PosturalScan : Return Joint Angles & Deviations
    
    PosturalScan --> OnboardingComplete : Save Biometrics & Posture Data
    
    OnboardingComplete --> Dashboard : Initialize Experience
    Dashboard --> [*]
```

## 3. Class Diagram (Data & Object Modeling)

```mermaid
classDiagram
    class User {
        +int id
        +string username
        +string email
        +string password
        +string first_name
        +string last_name
    }

    class BiometricProfile {
        +int id
        +string age_group
        +string sex
        +decimal height
        +decimal weight
        +decimal bmi
        +string goal
        +datetime privacy_consent_timestamp
    }

    class PosturalAssessment {
        +int id
        +text image
        +json raw_landmarks
        +json joint_angles
        +json deviations
        +string scan_reference_id
    }

    class Exercise {
        +int id
        +string name
        +string muscle_group
        +string difficulty
        +json goal_tags
        +json angle_ranges
        +json rep_config
        +json voice_cues
        +json age_groups_allowed
        +bool high_impact
    }

    class WorkoutSession {
        +int id
        +string title
        +string workout_type
        +int duration_minutes
        +int calories_burned
        +datetime created_at
        +json metadata
    }

    class ExerciseLog {
        +int id
        +int sets
        +int reps
        +decimal weight_kg
        +int duration_seconds
    }

    class DoctorProfile {
        +int id
        +string name
        +string specialty
        +decimal rating
        +string distance
        +bool is_available
    }

    class Availability {
        +int id
        +date date
        +time start_time
        +time end_time
        +bool is_booked
    }

    class Appointment {
        +int id
        +date date
        +string time_slot
        +text reason
        +string status
    }

    class Message {
        +int id
        +text content
        +datetime timestamp
        +bool is_from_doctor
    }

    User "1" -- "1" BiometricProfile : has
    BiometricProfile "1" -- "*" PosturalAssessment : contains
    User "1" -- "*" WorkoutSession : performs
    WorkoutSession "1" -- "*" ExerciseLog : contains
    ExerciseLog "*" -- "1" Exercise : references
    User "1" -- "*" Appointment : books
    DoctorProfile "1" -- "*" Availability : defines
    DoctorProfile "1" -- "*" Appointment : receives
    Appointment "*" -- "0..1" Availability : links
    User "1" -- "*" Message : sends
    DoctorProfile "1" -- "*" Message : receives
```

## 4. Sequence Diagram (Real-Time Exercise Tracking)

```mermaid
sequenceDiagram
    participant User
    participant React UI
    participant Camera
    participant MediaPipe
    participant StateEngine as Tracking State Engine
    participant API as Django REST API
    participant DB as PostgreSQL

    User->>React UI: Clicks "Start Session"
    React UI->>Camera: Request getUserMedia stream
    Camera-->>React UI: Video Stream Active
    
    loop Every Frame (15+ FPS)
        React UI->>MediaPipe: Process Video Frame
        MediaPipe-->>React UI: Returns 33 Landmarks
        
        React UI->>StateEngine: Pass Landmarks
        Note right of StateEngine: 1. calculateAngle()<br/>2. ema.smooth()<br/>3. Frame evaluation
        
        alt Valid Repetition Completed
            StateEngine-->>React UI: Increment Rep Count
            React UI-->>User: Visual Rep Counter Update
        else Form Error Detected
            StateEngine-->>React UI: Trigger Voice Cue (e.g. "Knees deeper")
            React UI-->>User: Speak Correction
        end
    end
    
    User->>React UI: Stops Video / Ends Session
    React UI->>API: POST /session/ (reps, duration, angles, errors)
    API->>DB: Save Session & Calculate Form Score
    DB-->>API: Persisted Successfully
    API-->>React UI: 201 Created (Score Details)
    React UI-->>User: Display Session Summary
```

## 5. Component Diagram

```mermaid
flowchart TD
    subgraph Client [Client-Side (React)]
        UI[React UI Components]
        State[Zustand Stores]
        Tracker[Tracking Engines: Curl, Squat, Tree]
        Smoothing[EMA Smoothing / Math]
        APIClient[Axios API Services]
    end

    subgraph Browser [Browser APIs]
        Cam[getUserMedia API]
        TTS[Web Speech API]
        WASM[MediaPipe WASM Runtime]
    end
    
    subgraph Server [Backend System (Django/DRF)]
        Router[URL Routing]
        Auth[SimpleJWT Auth]
        Views[REST Views]
        Algos[Algorithms: Cosine Sim, Scoring]
        ORM[Django ORM]
    end
    
    subgraph DB [Database]
        Postgres[(PostgreSQL)]
    end

    UI --> State
    UI --> Tracker
    Tracker --> Smoothing
    Tracker --> WASM
    UI --> APIClient
    UI --> Cam
    Tracker --> TTS
    
    APIClient -->|JSON + JWT| Router
    Router --> Auth
    Auth --> Views
    Views --> Algos
    Views --> ORM
    ORM --> Postgres
```

## 6. Deployment Diagram

```mermaid
flowchart TD
    subgraph UserMachine [User Machine / Client Client]
        Browser[Modern Web Browser (Chrome/Edge)]
        Speaker[Speakers/Headphones]
        Webcam[HD Webcam]
        Browser --> Speaker
        Browser --> Webcam
    end

    subgraph FrontendServer [Frontend Environment]
        Vite[Vite Dev Server / Static File Host]
    end

    subgraph BackendServer [Backend Environment]
        Django[Django WSGI Server]
        Middlewares[CORS & Auth Middlewares]
        Django --- Middlewares
    end

    subgraph DataServer [Data Tier]
        Postgres[(PostgreSQL 14+)]
    end

    Browser <==>|Downloads Assets| Vite
    Browser <==>|HTTP/HTTPS REST calls| Django
    Django <==>|SQL Queries / psycopg| Postgres
```
