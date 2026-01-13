
# IGIHOZO - Stock Management System

A professional stock management system built with React, Tailwind CSS, and Firebase.

## Production Credentials (Admin)
- **Name**: Admin JOSINE
- **Email**: `josineigihozo14@gmail.com`
- **Password**: `admin12`
- **UID**: `BA6oNMbz5EdkPMMwG35nDSz253U2`

## Setup Instructions

1. **Firebase Project Setup**:
   - Go to [Firebase Console](https://console.firebase.google.com/).
   - Create a new project named `IGIHOZO`.
   - Enable **Authentication** (Email/Password).
   - Enable **Cloud Firestore**.
   - Enable **Cloud Storage**.

2. **Configuration**:
   - Open `firebase.ts`.
   - Replace the `firebaseConfig` object with your project keys from the Firebase Console (Project Settings > General > Your Apps).

3. **Initialize Admin**:
   - Sign in with the credentials provided above. 
   - The application is programmed to automatically create the Firestore profile for the UID `BA6oNMbz5EdkPMMwG35nDSz253U2` as a primary **ADMIN** upon first login.

4. **Security Rules**:
   - Copy the contents of `firestore.rules` into the Rules tab of your Firestore database.

## Key Features
- **Admin Permissions**: Admins have access to ALL pages (Inventory, Users, Sales, Reports) and can Edit/Delete any record.
- **Inventory Tracking**: Real-time stock updates and low-stock indicators.
- **PDF Reporting**: Professional report generation for daily or filtered transactions.
- **Dark Mode**: Fully responsive UI that adapts to user preference.
