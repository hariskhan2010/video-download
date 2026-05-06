# 📄 Video Downloader System Plan (plan.md)

## 🎯 Objective

Build a system where:

* User pastes a video URL
* System processes it
* Returns a downloadable video file

---

## 🧠 System Architecture

```
Frontend (UI)
   ↓
Backend API
   ↓
Video Extraction Engine (yt-dlp)
   ↓
File Storage (temp)
   ↓
Download Response
```

---

## 🧩 Tech Stack

### Backend

* Node.js (Express)

### Core Engine

* yt-dlp

### Frontend

* React or simple HTML

### Optional

* Queue system (Bull / Redis)
* Storage (local / cloud)

---

## 🧱 Modules

### 🔹 Module 1: API Server Setup

Endpoints:

* POST /download
* GET /status/:id
* GET /file/:id

---

### 🔹 Module 2: URL Validation

* Validate proper format
* Allow only supported domains

---

### 🔹 Module 3: Video Extraction

* Use yt-dlp
* Save file locally

---

### 🔹 Module 4: Job System

* Generate unique job ID
* Track status:

  * pending
  * downloading
  * done
  * error

---

### 🔹 Module 5: File Handling

* Store downloaded files
* Provide download endpoint

---

### 🔹 Module 6: Frontend UI

Simple UI:

```
[ Paste Link ]
[ Download Button ]
[ Status: ... ]
[ Download Link ]
```

---

## 🔄 Workflow

```
1. User pastes link
2. POST /download
3. Backend validates URL
4. Create job
5. Start download
6. User checks /status/:id
7. When complete → GET /file/:id
```

---

## ⚙️ Optional Features

* Format selection (MP4 / MP3)
* Progress tracking
* Queue system
* Error handling

---

## 🧪 Testing Plan

* Valid YouTube link
* Valid Facebook link
* Invalid URL
* Large file
* Network error

---

## 📁 Folder Structure

```
project/
 ├── server/
 │   ├── routes/
 │   ├── controllers/
 │   ├── services/
 │   └── downloads/
 ├── client/
 └── README.md
```

---

## 🤖 OpenCode Prompt

```
Build a Node.js Express API that allows users to paste a video URL and download it.

Requirements:
- Use yt-dlp
- POST /download (accept URL)
- Generate job ID
- Track status
- Save video to /downloads
- GET /status/:id
- GET /file/:id
- Validate URLs
- Handle errors

Optional:
- Progress tracking
- Format selection
```

---

## 💡 Notes

Start simple, then scale with queue and optimizations.
