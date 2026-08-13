# Architecture & Tooling

- Prefers Netlify for hosting; explicitly does not want Vercel. Confidence: 0.95
- Prefers simple, low-cost, easy-to-maintain architectures over overengineered ones; prioritizes maintainability over scale for non-commercial/portfolio projects. Confidence: 0.9
- Accepts client-side persistence (e.g., Local Storage for game progress) instead of adding a backend when it suffices for the current version. Confidence: 0.8
- Open to either a self-hosted VPS API or a managed service like Supabase; asks for the simplest reliable option rather than asserting a strong backend preference. Confidence: 0.6
- Prefers setting up clean architecture upfront for features that will need a backend rather than redesigning later. Confidence: 0.7
- Wants minimal-friction user onboarding (nickname only); explicitly rejects account creation and third-party OAuth (Google, Facebook, Discord, etc.). Confidence: 0.95
