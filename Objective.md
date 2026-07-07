# Hamza Gym — Development Summary

We are building Phase 2 of our gym application: The Admin Dashboard. The database and subscriber onboarding are already complete. Now we need to build the internal tools for the coach using Next.js (App Router), Tailwind CSS, shadcn/ui, and Supabase.

Please implement a Desktop-First layout with a persistent left-hand sidebar navigation. Build the following core modules:
1. Financial Analytics (The Home Dashboard)

Build a main overview page featuring top-level metric cards:

    Monthly Recurring Revenue (MRR): Calculated by summing the monthly value of all active subscriptions.

    Active vs. Inactive Members: A simple pie chart or progress bar.

    New Sign-ups: Count of users created in the last 30 days.

    Outstanding Payments: Count of users with expired plans or pending requests.

2. The "Needs Attention" Tab

This is a triage center for the coach. It must contain three distinct data tables:

    Pending Vodafone Cash: Pulls from payment_requests where status is 'pending'. Shows the user, plan requested, and Transaction ID. Include an "Approve" (activates plan) and "Reject" button.

    AWOL Clients (MIA): Pulls active users whose last_workout_date or last_attendance_date is older than 7 days. Include a quick "Nudge" button to send a push notification.

    Expiring Soon: Active users with plans ending in the next 5 days.

3. Client Management Directory

A comprehensive table view of all users with two main tabs: Active and Inactive.

    List UI: Each row must show the user's Profile Picture (Avatar), Full Name, Plan Type, and Expiry Date.

    Row Actions: On the far right of each row, place two icon buttons: a "Chat" button (routes to direct messages) and a "Settings" button (opens the User Management Modal).

    Global Actions: Add an "Export to CSV" button at the top right of the table that downloads the current list as an Excel-compatible file.

4. The "User Settings" Modal (Admin Controls)

When the admin clicks the "Settings" button on a user row, open a large modal with the following capabilities:

    User Details View: Read-only stats like height, weight, sign-up date, and attendance history.

    Manual Payment Override: A dedicated section for physical cash payments. Include a dropdown to select a plan ('1-month', '3-month', etc.) and a bright "Activate via Cash" button. Clicking this instantly updates their subscription_status to active and calculates their new end_date.

    Destructive Actions: "Cancel Subscription" and "Delete User" buttons (hidden behind a confirmation prompt).

5. Workout Builder & Scheduler

Create a two-part system for managing client workouts:

    Template Builder: A UI where the coach can create named routines (e.g., "Leg Day - Beginner") and add exercises, default sets, and reps to it. Save these to a workout_templates table.

    Client Scheduler: Inside the User Settings Modal (from Step 4), add a "Schedule" tab. Display a weekly calendar. The coach can select a template from a dropdown and assign it to a specific day on that user's calendar.

6. Broadcast UI

Build a "Communications" page where the admin can draft a message (Title and Body) and select an audience (All Users, Active Users, Inactive Users, or Specific User). This must integrate with the previously established push notification logic.

Please generate the UI components, Supabase queries, and route handlers for this Admin Command Center.


