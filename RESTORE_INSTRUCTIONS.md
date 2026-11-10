# 🚀 Madifor WebSBA - Backup & Restore Instructions

**Date Created:** October 2026
**Project:** Madifor WebSBA Grading Portal

This archive contains a complete, fully-functioning snapshot of the Madifor WebSBA project. 

## 📦 What is included in this backup?
- All React source code (`src/`, `components/`, etc.)
- Configuration files (`vite.config.js`, `tailwind.config.js`, `firebase.js`, etc.)
- Environment variables (`.env`) for Firebase connection
- Documentation and Agent Handovers (`FUTURE_AGENTS_NOTE.md`)
- The Git repository history (`.git` folder)

*Note: The `node_modules` and `dist` folders were intentionally excluded from this zip file to save space. They will be regenerated when you restore the project.*

---

## 🛠️ How to Restore and Run this Project

If you ever need to restore this project on a new computer, or if the original project is lost, follow these exact steps:

### Prerequisites
You need to have **Node.js** installed on your computer. 
You can download it from: [https://nodejs.org/](https://nodejs.org/)

### Step 1: Extract the Archive
1. Download this `.zip` file from Google Drive to your local computer.
2. Right-click the `.zip` file and select **"Extract All..."**.
3. Choose a folder on your computer (e.g., `C:\projects\school-grading-app`).

### Step 2: Open in VS Code (or your preferred editor)
1. Open Visual Studio Code.
2. Go to `File` > `Open Folder...` and select the folder you just extracted.

### Step 3: Install Dependencies
Because we excluded `node_modules` to keep the backup small, you need to reinstall the required packages:
1. Open a terminal inside VS Code (Terminal > New Terminal).
2. Run the following command:
   ```bash
   npm install
   ```
3. Wait for the installation to complete.

### Step 4: Start the Local Development Server
1. In the same terminal, run:
   ```bash
   npm run dev
   ```
2. The terminal will display a local link (usually `http://localhost:5173`).
3. Ctrl+Click (or Cmd+Click) that link to open the app in your browser!

---

## ☁️ Deployment (Vercel)
If you need to deploy this restored version to the web:
1. Since the `.git` folder is included, you can simply run `git push` to push to your GitHub repository (`flawlex360-art/sba-grading-portal`).
2. Vercel is connected to that GitHub repository and will automatically build and deploy the `main` branch.
3. *Note: We have a `vercel-ignore-build.sh` script included to prevent spam/bot branches from deploying.*

## 🔒 Firebase Note
The `.env` file containing your Firebase API keys is included in this backup. If you are sharing this source code publicly, **DO NOT** include the `.env` file! For your personal Google Drive backup, it is safe.

Best of luck!
- *Agent Antigravity*
