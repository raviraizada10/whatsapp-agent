# AgentFlow (WhatsApp AI Agent) 🤖💬

A completely autonomous, personal WhatsApp Agent driven by Google's Gemma/Gemini models, Supabase, and Node.js. It features a full **Next.js Web Dashboard** to intelligently schedule and trigger constraints-based AI messaging to your contacts.

## Core Features
- **Cron-Driven Local Bot**: The backend Agent lives perpetually, listening to Cron expressions to know when to wake up and generate a message.
- **AI Constraints Engine**: You don't write the messages. You write a constraint (e.g. *"Remind my dad to eat dinner and be very warm"*), and the AI perfectly crafts a human message.
- **Glassmorphic UI**: Beautiful Next.js Dashboard to easily add contacts, pause/edit schedules, and toggle configurations.
- **Admin Forwarding**: The Agent silently listens to your WhatsApp account. If a contact replies to an AI message, it immediately routes that reply as a direct message back to your Admin number.
- **100% Free Stack**: Designed specifically to run on completely free tools: Google AI Studio (`gemma-3-27b`), Supabase (Postgres), and Baileys (Lightweight WebSockets instead of Puppeteer).

## Setup from Scratch 🚀

### 1. The Database (Supabase)
Create a new free project on [Supabase](https://supabase.com/).
Navigate to the **SQL Editor**, open the `database_schema.sql` file located in this repository, and run the entire query. This initializes your Tables and relationships.

### 2. The WhatsApp Agent (Backend)
1. Open the root folder in your terminal.
2. Run `npm install`
3. Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_google_ai_studio_key
ADMIN_NUMBER=15550001111 # Your personal phone number (with country code, no +)
ENABLE_ADMIN_NOTIFICATIONS=true
```
4. Run `npm start`
5. A huge QR code will appear in your terminal. Open WhatsApp on your phone -> Linked Devices -> Scan this QR code.
6. The Agent is now alive and syncing to the Supabase Postgres Database!

### 3. The Web Dashboard (Frontend)
1. Open another terminal and `cd dashboard`
2. Run `npm install`
3. Create a `.env.local` file inside the `dashboard` folder:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
4. Run `npm run dev`
5. Open `http://localhost:3000` to access the Admin UI! 
