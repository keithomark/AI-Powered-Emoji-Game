# AI-Powered Emoji Game Server

This project is a Node.js Express server that uses the Google Gemini API to generate emoji-based guessing games. It provides endpoints to get emoji combinations and hints.

This directory (`backend/`) contains all the server-side code.

## Prerequisites

- Node.js (v14 or higher recommended)
- npm (Node Package Manager)

These usually come bundled together. You can download them from [nodejs.org](https://nodejs.org/).

## Project Structure (Backend)

A brief overview of important files within the `backend/` directory:

-   `server.js`: The main Express server application file. It defines routes and handles requests.
-   `utils.js`: Utility module for initializing the Google Gemini API client.
-   `prompts.js`: Contains the prompt templates used for interacting with the Gemini API.
-   `package.json`: Defines project metadata, dependencies, and scripts.
-   `.env`: Stores environment variables (API keys, port). You will need to create this.
-   `README.md`: This file.

## Setup Instructions

1.  **Clone the repository (or download the files):**
    ```bash
    git clone <repository_url>
    cd <repository_directory_name>/backend
    ```
    If you downloaded the files as a ZIP, extract them. Then, navigate into the main project folder, and then into the `backend` subfolder. All subsequent commands should be run from this `backend/` directory.

2.  **Install dependencies:**
    Run the following command inside the `backend/` directory:
    ```bash
    npm install
    ```

3.  **Create a `.env` file:**
    In the `backend/` directory, create a file named `.env`.

4.  **Configure Environment Variables:**
    Open the `backend/.env` file and add the following lines. Replace `"YOUR_API_KEY_HERE"` with your actual Google Gemini API key.
    ```env
    PORT=3000
    GEMINI_API_KEY="YOUR_API_KEY_HERE"
    ```
    -   `PORT`: The port on which the server will run (defaults to 3000 if not specified).
    -   `GEMINI_API_KEY`: Your API key for the Google Gemini service. You can obtain one from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Running the Server

Once the setup is complete, ensure you are in the `backend/` directory, then start the server using:

```bash
npm start
```

You should see a message in the console indicating that the server is running, e.g., `Server is running on port 3000`. The server listens for requests at `http://localhost:PORT`.

## Endpoints

The server provides the following API endpoints:

### 1. Get Emoji Combo

-   **Route:** `GET /combo`
-   **Description:** Fetches a randomly generated two-emoji combination, a correct answer representing what the emojis mean, and three distractor options.
-   **Response Body (JSON):**
    ```json
    {
      "emojis": "🧑‍🍳💋",
      "correct_answer": "Chef's Kiss",
      "options": ["Chef's Kiss", "Cooking Love", "Kiss the Cook", "Delicious Food"]
    }
    ```
    *The actual emojis, answer, and options will vary with each request.*

### 2. Get a Hint

-   **Route:** `POST /hint`
-   **Description:** Provides a hint for a given phrase (which could be an emoji combo or the correct answer).
-   **Request Body (JSON):**
    ```json
    {
      "phrase": "🧑‍🍳💋"
    }
    ```
    or
    ```json
    {
      "phrase": "Chef's Kiss"
    }
    ```
-   **Response Body (JSON):**
    ```json
    {
      "hint": "A gesture indicating something is perfect, often used in culinary contexts."
    }
    ```
    *The actual hint will vary based on the input phrase.*

---

Make sure your `GEMINI_API_KEY` is kept secret and not pushed to public repositories. The `backend/.env` file is included in `backend/.gitignore` for this reason.
