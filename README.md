# AI-Powered Emoji Game Server

This project is a Node.js Express server that uses the Google Gemini API to generate emoji-based guessing games. It provides endpoints to get emoji combinations and hints.

## Prerequisites

- Node.js (v14 or higher recommended)
- npm (Node Package Manager)

These usually come bundled together. You can download them from [nodejs.org](https://nodejs.org/).

## Setup Instructions

1.  **Clone the repository (or download the files):**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```
    If you downloaded the files as a ZIP, extract them to a new directory and navigate into it.

2.  **Install dependencies:**
    Run the following command in the project's root directory:
    ```bash
    npm install
    ```

3.  **Create a `.env` file:**
    In the root directory of the project, create a file named `.env`.

4.  **Configure Environment Variables:**
    Open the `.env` file and add the following lines. Replace `"YOUR_API_KEY_HERE"` with your actual Google Gemini API key.
    ```env
    PORT=3000
    GEMINI_API_KEY="YOUR_API_KEY_HERE"
    ```
    -   `PORT`: The port on which the server will run (defaults to 3000 if not specified).
    -   `GEMINI_API_KEY`: Your API key for the Google Gemini service. You can obtain one from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Running the Server

Once the setup is complete, you can start the server using:

```bash
npm start
```

You should see a message in the console indicating that the server is running, e.g., `Server is running on port 3000`.

## Endpoints

The server provides the following API endpoints:

### 1. Get Emoji Combo

-   **Route:** `GET /combo`
-   **Description:** Fetches a randomly generated two-emoji combination, a correct answer representing what the emojis mean, and three distractor options.
-   **Response Body (JSON):**
    ```json
    {
      "emojis": "🧑‍🍳💋", // String of two emojis
      "correct_answer": "Chef's Kiss", // String: the correct answer
      "options": ["Chef's Kiss", "Cooking Love", "Kiss the Cook", "Delicious Food"] // Array of 4 strings (1 correct, 3 distractors, shuffled)
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
      "hint": "A gesture indicating something is perfect, often used in culinary contexts." // String: a generated hint
    }
    ```
    *The actual hint will vary based on the input phrase.*

---

Make sure your `GEMINI_API_KEY` is kept secret and not pushed to public repositories. The `.env` file is typically included in `.gitignore` for this reason (as it is in this project).
