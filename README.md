
# NexShop | AI-Powered Marketplace with SQLite Persistence

NexShop is a modern retail web application that uses **React**, **FastAPI (Python)**, and **SQLite** to deliver a high-end, persistent shopping experience.

## 🏗️ Architecture

- **Frontend**: React 18 with Tailwind CSS.
- **Backend**: FastAPI (Python 3.10+) managing a relational SQLite database.
- **AI Agent**: Google Gemini 3 Pro integrated via tool-calling to bridge natural language with database operations.

## 🚀 Getting Started

### 1. Run the Python Backend
The backend manages the products and shopping cart persistence.
```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
python server.py
```
The server will start at `http://localhost:8000` and create a `marketplace.db` file automatically.

### 2. Run the React Frontend
```bash
npm install
npm run dev
```

## 🛠️ Persistence Layer Features
- **Relational Integrity**: The shopping cart is linked to users via unique IDs in SQLite.
- **Data Seeding**: The backend automatically populates the database with premium tech products on the first run.
- **Scalable API**: Uses FastAPI's asynchronous capabilities for high-speed UI state synchronization.

## 🤖 AI Agent Integration
Nex (the AI Agent) can:
- **Query the database**: "Search for mechanical keyboards under $200."
- **Manage Cart**: "Add the Logitech mouse to my cart."
- **Navigate**: "Take me to checkout."

---

*Note: Ensure the Python server is running to enable the real persistence layer. If the server is offline, the app will gracefully fallback to local memory state.*
