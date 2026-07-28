# Architecture

## System Overview

TutorFlow AI is a full-stack web application built for tuition teachers. Its main goal is to reduce the time teachers spend creating assessments and grading student answers while keeping them in complete control of every academic decision.

The system allows teachers to create assessments, manage students, review AI-generated question papers, evaluate student submissions with AI assistance, and publish results. Students can log in, attempt assessments using multiple answer formats, and view their results once they are approved by the teacher.

The architecture is designed to be simple, modular, and easy to extend. Since this is the first version of the product, the focus is on building a maintainable system rather than introducing unnecessary complexity.

---

# Architecture Decisions

## Application Architecture

TutorFlow AI follows a **modular monolith** architecture.

Instead of splitting the application into many microservices, all backend features live inside a single NestJS application. Each feature is organised into its own module with a clear responsibility.

This approach was chosen because the application is still in its early stage and serves a relatively small number of users. A modular monolith is easier to develop, test, deploy, and debug while still keeping the codebase well organised.

If the application grows in the future, modules such as AI processing can be extracted into separate services without redesigning the entire system.

---

## Frontend

The frontend is built with **Next.js**, **React**, **TypeScript**, and **Tailwind CSS**.

The frontend is responsible for:

* User authentication
* Teacher dashboard
* Student dashboard
* Assessment creation
* Assessment attempts
* Viewing results
* Communicating with the backend through REST APIs

The frontend never communicates directly with the AI provider or the database.

---

## Backend

The backend is built using **NestJS**.

It contains separate modules for different business areas.

```text
src/
├── auth/
├── users/
├── students/
├── assessments/
├── submissions/
├── evaluations/
├── ai/
├── database/
└── health/
```

Each module is responsible for its own business logic.

For example:

* Auth handles login and authentication.
* Assessments manages question papers.
* Submissions manages student responses.
* Evaluations manages grading.
* AI communicates with the language model.

Keeping these responsibilities separate makes the project easier to maintain.

---

## API Communication

The frontend communicates with the backend using REST APIs.

REST was chosen because it is simple, easy to understand, easy to test, and fits the application's workflow.

Examples include:

* Create assessment
* Publish assessment
* Submit answers
* Review evaluation
* Publish results

The backend is the only part of the system that can:

* Access the database
* Call AI services
* Apply business rules
* Validate requests
* Enforce permissions

---

## Database

TutorFlow AI uses **PostgreSQL** as its primary database.

Most application data is highly structured and strongly related.

Examples include:

* Teachers
* Students
* Assessments
* Questions
* Submissions
* Answers
* Evaluations

A relational database makes these relationships easier to manage and provides reliable transactions.

---

## ORM

The application uses **Prisma ORM**.

Prisma provides:

* Type safety
* Database migrations
* Auto-generated TypeScript types
* A simple query API

Using Prisma reduces boilerplate code and makes database access safer and easier.

---

## Authentication

TutorFlow AI uses **JWT authentication**.

There are two user roles:

* Teacher
* Student

After a successful login, the backend generates a JWT access token.

Every protected API request must include this token.

The backend verifies both the token and the user's role before allowing access.

This ensures that students cannot perform teacher-only actions.

---

## AI Architecture

The backend is responsible for every interaction with the AI provider.

The frontend never communicates directly with the AI.

All AI requests go through a dedicated `AiService`.

This keeps AI-related logic in one place and makes it easier to replace the AI provider in the future if needed.

---

## Teacher Style Matching

One of the main goals of TutorFlow AI is to generate assessments that match each teacher's own style.

Instead of training a custom AI model, the system stores examples of the teacher's previous questions.

When generating a new assessment, the backend selects relevant examples based on information such as:

* Grade
* Subject
* Topic
* Difficulty

These examples are included in the prompt sent to the AI so the generated assessment better matches the teacher's style.

---

## Assessment Workflow

The assessment workflow is controlled using application states.

Assessment states:

* Draft
* Published
* Closed

A teacher creates an assessment in the Draft state.

Once reviewed, it can be published.

After students finish attempting the assessment, it can be closed to prevent new submissions.

---

## Submission Workflow

Each student submission also follows its own lifecycle.

Submission states:

* In Progress
* Submitted
* AI Evaluated
* Teacher Approved
* Result Published

Separating assessment states from submission states keeps the workflow simple and prevents invalid actions.

---

## Voice Answer Workflow

Students can answer descriptive questions using voice recordings.

The workflow is:

1. Student records audio.
2. Audio is uploaded.
3. Speech-to-text generates a transcript.
4. Student reviews the transcript.
5. Student confirms or edits the transcript.
6. The confirmed transcript is submitted for grading.

The transcript is always reviewed by the student before AI evaluation begins.

---

## AI Grading

AI is used to assist teachers during evaluation.

The AI receives:

* Question
* Rubric
* Maximum marks
* Student answer

The AI returns:

* Suggested marks
* Feedback
* Reasoning
* Confidence score

The teacher reviews every evaluation before marks are published.

The AI never publishes grades automatically.

---

## Human in the Loop

TutorFlow AI follows a human-in-the-loop design.

AI provides suggestions, but teachers always make the final academic decisions.

Teachers must approve:

* Generated assessments
* AI-generated marks
* Final feedback
* Published results

This keeps teachers in control and improves trust in the system.

---

## Error Handling

The backend validates every request before processing it.

Expected errors return appropriate HTTP status codes.

Examples include:

* Invalid login
* Missing assessment
* Unauthorized access
* Invalid request data

Important application events and errors are logged to make debugging easier.

---

## Health Check

The backend exposes a simple health endpoint.

```
GET /health
```

This endpoint can be used to verify that the application and its dependencies are running correctly.

---

## High-Level Architecture

```text
                 Teacher / Student
                         │
                  Next.js Frontend
                         │
                     REST API
                         │
                 NestJS Backend
                         │
      ┌───────────┬─────────────┬────────────┐
      │           │             │            │
   Auth      Assessments   Submissions     AI
      │           │             │            │
      └───────────┴─────────────┴────────────┘
                         │
                     PostgreSQL
```

---

# Future Improvements

The architecture is intentionally simple for Version 1.

As the application grows, possible improvements include:

* Background jobs for AI processing
* Object storage for uploaded files
* Embedding-based retrieval for teacher style matching
* AI performance monitoring
* Parent portal
* Attendance management
* Fee management
* WhatsApp integration

These features are intentionally left out of the MVP to keep the initial system focused and maintainable.
